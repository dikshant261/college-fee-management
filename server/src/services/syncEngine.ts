import fs from 'fs';
import path from 'path';
import { getDB } from '../db';
import {
  getStoredCredentials,
  getAuthenticatedDriveClient,
} from './googleAuthService';
import {
  getOrCreateFolder,
  cleanUpRemoteJsonFiles,
  downloadRemoteFile,
  syncUploadsFolder,
  syncDatabaseSnapshot,
  UploadFileAction,
} from './googleDriveService';
import { syncAllStudentsFees } from './studentService';

export interface SyncStatus {
  connected: boolean;
  syncing: boolean;
  pendingChanges: number;
  lastSyncAt: string | null;
  lastSyncStatus: 'success' | 'failed' | 'idle' | 'never';
  lastError: string | null;
  syncIntervalMinutes: number;
  folderName: string | null;
  userEmail: string | null;
}

export interface SyncQueueRecord {
  id: number;
  table_name: string;
  record_id: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  created_at: string;
  synced_at: string | null;
  retry_count: number;
  last_error: string | null;
}

export interface SyncCommitDetail {
  version: number;
  timestamp: string;
  trigger: string;
  summary: string;
  recordsCount: number;
  filesSyncedCount: number;
  tableChanges: Array<{
    table: string;
    recordId: string;
    operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'SKIP';
  }>;
  filesSynced: UploadFileAction[];
  dbSnapshot?: {
    fileId: string;
    sizeBytes: number;
  };
}

export interface SyncHistoryRecord {
  id: number;
  trigger_type: 'manual' | 'automatic' | 'restore';
  status: 'success' | 'failed' | 'partial';
  items_synced: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  details?: string | null;
}

// Mutex lock ensuring only ONE sync runs at a time
let isSyncing = false;

// Singleton timer reference ensuring only ONE scheduler is active
let schedulerTimer: NodeJS.Timeout | null = null;

// Configuration
export function getSyncIntervalMinutes(): number {
  const parsed = parseInt(process.env.SYNC_INTERVAL_MINUTES || '5', 10);
  return isNaN(parsed) || parsed < 1 ? 5 : parsed;
}

/**
 * Returns current sync status and pending counts
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const db = getDB();
  const creds = await getStoredCredentials();

  const pendingRow = await db.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM sync_queue WHERE synced_at IS NULL`
  );
  const pendingChanges = pendingRow?.count || 0;

  const lastHistory = await db.get<SyncHistoryRecord>(
    `SELECT * FROM sync_history ORDER BY id DESC LIMIT 1`
  );

  return {
    connected: Boolean(creds?.tokens),
    syncing: isSyncing,
    pendingChanges,
    lastSyncAt: lastHistory?.completed_at || lastHistory?.started_at || null,
    lastSyncStatus: (lastHistory?.status as any) || (creds?.tokens ? 'idle' : 'never'),
    lastError: lastHistory?.error_message || null,
    syncIntervalMinutes: getSyncIntervalMinutes(),
    folderName: creds?.folderName || 'College Management System Backup',
    userEmail: creds?.userEmail || null,
  };
}

/**
 * Returns recent synchronization history records
 */
export async function getSyncHistory(limit: number = 20): Promise<SyncHistoryRecord[]> {
  const db = getDB();
  return db.all<SyncHistoryRecord[]>(
    `SELECT * FROM sync_history ORDER BY id DESC LIMIT ?`,
    limit
  );
}

/**
 * Returns count of pending changes grouped by table
 */
export async function getPendingSummary(): Promise<Record<string, number>> {
  const db = getDB();
  const rows = await db.all<{ table_name: string; count: number }[]>(
    `SELECT table_name, COUNT(*) as count FROM sync_queue WHERE synced_at IS NULL GROUP BY table_name`
  );
  const summary: Record<string, number> = {};
  for (const r of rows) {
    summary[r.table_name] = r.count;
  }
  return summary;
}

/**
 * Central Synchronization Function
 * Syncs ONLY uploads folder and college.db file to Google Drive.
 * JSON files are NOT synced, and any legacy JSON files on Drive are cleaned up.
 */
export async function syncWithGoogleDrive(
  triggerType: 'manual' | 'automatic' = 'manual'
): Promise<{ success: boolean; message: string; syncedRecords?: number }> {
  // Ensure only one sync can execute at a time
  if (isSyncing) {
    return {
      success: false,
      message: 'A synchronization operation is already in progress.',
    };
  }

  const db = getDB();
  const creds = await getStoredCredentials();

  if (!creds || !creds.tokens) {
    return {
      success: false,
      message: 'Google Drive is not connected. Please connect your Google account first.',
    };
  }

  if (!creds.hasDriveScope) {
    return {
      success: false,
      message: 'Google Drive file permission was not granted. Please click "Reconnect & Grant Permission" and ensure you check the box for Google Drive files on the Google sign-in screen.',
    };
  }

  isSyncing = true;
  const startedAt = new Date().toISOString();
  let historyId: number | null = null;

  try {
    // Record history entry
    const historyRes = await db.run(
      `INSERT INTO sync_history (trigger_type, status, items_synced, started_at)
       VALUES (?, 'failed', 0, ?)`,
      triggerType,
      startedAt
    );
    historyId = historyRes.lastID || null;

    console.log(`[SYNC] Starting ${triggerType} synchronization (college.db & uploads only)...`);

    // 1. Authenticate with Google Drive & get/create app folder
    const { drive } = await getAuthenticatedDriveClient();
    const folderId = await getOrCreateFolder(drive, creds.folderId);

    // 2. Clean up any remote JSON files on Google Drive so only uploads and college.db exist
    await cleanUpRemoteJsonFiles(drive, folderId);

    // 3. Sync uploads folder (student photos, QR codes, receipts)
    console.log('[SYNC] Syncing uploads folder to Google Drive...');
    const uploadsRes = await syncUploadsFolder(drive, folderId);
    const totalFilesChanged = uploadsRes.uploaded + uploadsRes.updated + uploadsRes.deleted;

    // 4. Check pending database changes
    const pendingRows = await db.all<SyncQueueRecord[]>(
      `SELECT * FROM sync_queue WHERE synced_at IS NULL ORDER BY id ASC`
    );

    // In automatic mode, skip if no changes
    if (pendingRows.length === 0 && totalFilesChanged === 0 && triggerType === 'automatic') {
      console.log('[SYNC] No pending database changes or file changes. Skipping auto-sync.');
      if (historyId) {
        await db.run(`DELETE FROM sync_history WHERE id = ?`, historyId);
      }
      return {
        success: true,
        message: 'All data and files are up to date.',
        syncedRecords: 0,
      };
    }

    // 5. Sync complete SQLite binary database file (college.db)
    console.log('[SYNC] Syncing SQLite binary snapshot (college.db) to Google Drive...');
    const dbSnap = await syncDatabaseSnapshot(drive, folderId);

    // 6. Mark pending queue items as synced (college.db includes all changes)
    if (pendingRows.length > 0) {
      await db.run(`UPDATE sync_queue SET synced_at = datetime('now') WHERE synced_at IS NULL`);
    }

    const completedAt = new Date().toISOString();
    const summaryParts: string[] = [];
    if (pendingRows.length > 0) summaryParts.push(`${pendingRows.length} database change(s)`);
    if (uploadsRes.uploaded > 0) summaryParts.push(`${uploadsRes.uploaded} file(s) uploaded`);
    if (uploadsRes.updated > 0) summaryParts.push(`${uploadsRes.updated} file(s) updated`);
    if (uploadsRes.deleted > 0) summaryParts.push(`${uploadsRes.deleted} file(s) deleted`);
    if (summaryParts.length === 0) summaryParts.push(`college.db snapshot refreshed (${Math.round(dbSnap.sizeBytes / 1024)} KB)`);

    const commitData: SyncCommitDetail = {
      version: Date.now(),
      timestamp: completedAt,
      trigger: triggerType,
      summary: `college.db (${Math.round(dbSnap.sizeBytes / 1024)} KB) & ${summaryParts.join(', ')}`,
      recordsCount: pendingRows.length,
      filesSyncedCount: totalFilesChanged,
      tableChanges: [],
      filesSynced: uploadsRes.files,
      dbSnapshot: {
        fileId: dbSnap.fileId,
        sizeBytes: dbSnap.sizeBytes,
      },
    };

    // Update local SQLite sync_history record
    if (historyId) {
      await db.run(
        `UPDATE sync_history SET status = 'success', items_synced = ?, completed_at = ?, details = ?, error_message = NULL WHERE id = ?`,
        pendingRows.length + totalFilesChanged,
        completedAt,
        JSON.stringify(commitData),
        historyId
      );
    }

    console.log(
      `[SYNC] Sync finished: college.db (${Math.round(dbSnap.sizeBytes / 1024)} KB) & ${totalFilesChanged} files.`
    );

    return {
      success: true,
      message: `Successfully synchronized college.db and uploads folder to Google Drive. (${commitData.summary})`,
      syncedRecords: pendingRows.length + totalFilesChanged,
    };
  } catch (err: any) {
    console.error('[SYNC] Fatal synchronization error:', err);
    if (historyId) {
      await db.run(
        `UPDATE sync_history SET status = 'failed', completed_at = datetime('now'), error_message = ? WHERE id = ?`,
        err?.message || 'Sync failed',
        historyId
      );
    }
    return {
      success: false,
      message: err?.message || 'Google Drive synchronization failed.',
    };
  } finally {
    isSyncing = false;
  }
}

/**
 * Safe Restore from Google Drive directly using college.db binary snapshot
 */
export async function restoreFromGoogleDrive(): Promise<{
  success: boolean;
  message: string;
  backupFile: string;
}> {
  if (isSyncing) {
    throw new Error('Cannot restore database while a synchronization operation is running.');
  }

  const db = getDB();
  const creds = await getStoredCredentials();
  if (!creds || !creds.tokens) {
    throw new Error('Google Drive is not connected.');
  }

  isSyncing = true;
  let backupFileName = '';

  try {
    const { drive } = await getAuthenticatedDriveClient();
    const folderId = await getOrCreateFolder(drive, creds.folderId);

    // Find college.db in remote folder
    const listRes = await drive.files.list({
      q: `'${folderId}' in parents and name = 'college.db' and trashed = false`,
      fields: 'files(id, name, size)',
      spaces: 'drive',
    });

    const remoteFile = listRes.data.files?.[0];
    if (!remoteFile || !remoteFile.id) {
      throw new Error('No college.db file found on Google Drive to restore from.');
    }

    // 1. Create a local backup of the active SQLite database
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'college.db');
    const dbDir = path.dirname(dbPath);
    backupFileName = `college_backup_${Date.now()}.db`;
    const backupFilePath = path.join(dbDir, backupFileName);
    fs.copyFileSync(dbPath, backupFilePath);
    console.log(`[RESTORE] Created pre-restore local database backup: ${backupFilePath}`);

    // 2. Download remote college.db to a temp file
    const tempRestorePath = path.join(dbDir, `temp_restore_${Date.now()}.db`);
    await downloadRemoteFile(drive, remoteFile.id, tempRestorePath);

    // 3. Flush WAL checkpoint on current db
    try {
      await db.run('PRAGMA wal_checkpoint(PASSIVE);');
    } catch { }

    // 4. Replace college.db with restored file
    fs.copyFileSync(tempRestorePath, dbPath);
    try {
      fs.unlinkSync(tempRestorePath);
    } catch { }

    // 5. Re-sync fee balances across all students
    try {
      await syncAllStudentsFees();
    } catch (feeErr) {
      console.warn('[RESTORE] Fee calculation re-sync warning:', feeErr);
    }

    // 6. Clear sync queue
    await db.run(`DELETE FROM sync_queue`);

    // 7. Log restore history
    await db.run(
      `INSERT INTO sync_history (trigger_type, status, items_synced, started_at, completed_at, error_message)
       VALUES ('restore', 'success', 0, datetime('now'), datetime('now'), NULL)`
    );

    return {
      success: true,
      message: 'Database successfully restored from college.db on Google Drive.',
      backupFile: backupFileName,
    };
  } finally {
    isSyncing = false;
  }
}

/**
 * Requirement 13: Background Auto-Sync Scheduler
 * Ensures only one timer is active in the Node.js server.
 */
export function initSyncScheduler(): void {
  if (schedulerTimer) {
    console.log('[SYNC] Scheduler is already active.');
    return;
  }

  const intervalMinutes = getSyncIntervalMinutes();
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`[SYNC] Initializing automatic sync scheduler (Every ${intervalMinutes} minutes)...`);

  schedulerTimer = setInterval(async () => {
    try {
      if (isSyncing) return;

      const creds = await getStoredCredentials();
      if (!creds || !creds.tokens || !creds.hasDriveScope) return;

      await syncWithGoogleDrive('automatic');
    } catch (err) {
      console.error('[SYNC] Auto-sync scheduled check failed:', err);
    }
  }, intervalMs);
}
