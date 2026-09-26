import fs from 'fs';
import path from 'path';
import { getDB } from '../db';
import {
  getStoredCredentials,
  getAuthenticatedDriveClient,
} from './googleAuthService';
import {
  getOrCreateFolder,
  readRemoteJson,
  updateRemoteJson,
  syncUploadsFolder,
  syncDatabaseSnapshot,
  recordCommitOnDrive,
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
 * Helper to fetch a single record from SQLite safely by table and primary key
 */
async function fetchLocalRecord(table: string, id: string): Promise<any | null> {
  const db = getDB();
  switch (table) {
    case 'students':
      return db.get(`SELECT * FROM students WHERE id = ?`, id);
    case 'fee_payments':
      return db.get(`SELECT * FROM fee_payments WHERE id = ?`, id);
    case 'fee_structures':
      return db.get(`SELECT * FROM fee_structures WHERE id = ?`, id);
    case 'courses':
      return db.get(`SELECT * FROM courses WHERE code = ?`, id);
    case 'expenditures':
      return db.get(`SELECT * FROM expenditures WHERE id = ?`, id);
    case 'system_settings':
      return db.get(`SELECT * FROM system_settings WHERE key = ? AND key NOT LIKE 'sync_%'`, id);
    case 'users':
      // STRICT REQUIREMENT 5: NEVER synchronize password hashes or auth secrets
      return db.get(
        `SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ?`,
        id
      );
    default:
      return null;
  }
}

/**
 * Primary key getter for a given table
 */
function getPrimaryKeyField(table: string): string {
  if (table === 'courses') return 'code';
  if (table === 'system_settings') return 'key';
  return 'id';
}

/**
 * Central Synchronization Function
 * Handles both manual "Sync Now" and automatic periodic sync
 */
export async function syncWithGoogleDrive(
  triggerType: 'manual' | 'automatic' = 'manual'
): Promise<{ success: boolean; message: string; syncedRecords?: number }> {
  // Requirement 12: Ensure only one sync can execute at a time
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

    console.log(`[SYNC] Starting ${triggerType} synchronization...`);

    // 1. Authenticate with Google Drive & get/create app folder
    const { drive } = await getAuthenticatedDriveClient();
    const folderId = await getOrCreateFolder(drive, creds.folderId);

    // 2. Check if remote metadata exists; if not, perform Initial Backup
    const remoteMeta = await readRemoteJson<{ sync_version: number; last_sync_at: string }>(
      drive,
      folderId,
      'sync_metadata.json'
    );

    const pendingRows = await db.all<SyncQueueRecord[]>(
      `SELECT * FROM sync_queue WHERE synced_at IS NULL ORDER BY id ASC`
    );

    if (!remoteMeta) {
      console.log('[SYNC] First-time sync detected. Performing initial full backup to Google Drive...');
      const { totalCount, commitData } = await performInitialBackup(drive, folderId);

      // Mark any existing queue records as synced
      await db.run(`UPDATE sync_queue SET synced_at = datetime('now') WHERE synced_at IS NULL`);

      const completedAt = new Date().toISOString();
      if (historyId) {
        await db.run(
          `UPDATE sync_history SET status = 'success', items_synced = ?, completed_at = ?, details = ?, error_message = NULL WHERE id = ?`,
          totalCount + commitData.filesSyncedCount,
          completedAt,
          JSON.stringify(commitData),
          historyId
        );
      }

      console.log(`[SYNC] Initial backup finished successfully (${totalCount} records, ${commitData.filesSyncedCount} files).`);
      return {
        success: true,
        message: `Initial backup completed (${totalCount} records, ${commitData.filesSyncedCount} files, and college.db snapshot).`,
        syncedRecords: totalCount + commitData.filesSyncedCount,
      };
    }

    // 3. Incremental Synchronization
    // First, sync any new/modified/deleted files in uploads folder
    console.log('[SYNC] Checking uploads folder for changes...');
    const uploadsRes = await syncUploadsFolder(drive, folderId);
    const totalFilesChanged = uploadsRes.uploaded + uploadsRes.updated + uploadsRes.deleted;

    if (pendingRows.length === 0 && totalFilesChanged === 0) {
      if (triggerType === 'automatic') {
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

      // Manual sync clicked with no pending changes: Refresh database snapshot to be certain
      console.log('[SYNC] Manual sync triggered: refreshing SQLite database snapshot on Google Drive...');
      const dbSnap = await syncDatabaseSnapshot(drive, folderId);
      const currentVersion = (remoteMeta?.sync_version || 1) + 1;
      const completedAt = new Date().toISOString();

      const commitData: SyncCommitDetail = {
        version: currentVersion,
        timestamp: completedAt,
        trigger: triggerType,
        summary: `Verified up to date; college.db snapshot refreshed (${Math.round(dbSnap.sizeBytes / 1024)} KB)`,
        recordsCount: 0,
        filesSyncedCount: 0,
        tableChanges: [],
        filesSynced: [],
        dbSnapshot: {
          fileId: dbSnap.fileId,
          sizeBytes: dbSnap.sizeBytes,
        },
      };

      await recordCommitOnDrive(drive, folderId, commitData);
      await updateRemoteJson(drive, folderId, 'sync_metadata.json', {
        sync_version: currentVersion,
        last_sync_at: completedAt,
        last_sync_status: 'success',
        total_pending_remaining: 0,
        latest_commit: {
          version: currentVersion,
          summary: commitData.summary,
          timestamp: completedAt,
        },
      });

      if (historyId) {
        await db.run(
          `UPDATE sync_history SET status = 'success', items_synced = 0, completed_at = ?, details = ?, error_message = NULL WHERE id = ?`,
          completedAt,
          JSON.stringify(commitData),
          historyId
        );
      }

      return {
        success: true,
        message: 'All records and uploads are up to date. Database snapshot refreshed.',
        syncedRecords: 0,
      };
    }

    console.log(`[SYNC] Consolidating ${pendingRows.length} pending changes and ${totalFilesChanged} file changes...`);

    // Requirement 7: Consolidate changes by (table_name, record_id)
    const grouped = new Map<string, SyncQueueRecord[]>();
    for (const item of pendingRows) {
      const key = `${item.table_name}::${item.record_id}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    }

    // Organize consolidated actions per table
    const tablesToSync = new Set<string>();
    const tableActions = new Map<
      string,
      Map<string, { op: 'UPSERT' | 'DELETE' | 'SKIP'; queueIds: number[] }>
    >();

    for (const [key, items] of grouped.entries()) {
      const [tableName, recordId] = key.split('::');
      tablesToSync.add(tableName);

      if (!tableActions.has(tableName)) {
        tableActions.set(tableName, new Map());
      }

      const allQueueIds = items.map((i) => i.id);
      const firstOp = items[0].operation;
      const lastOp = items[items.length - 1].operation;

      let consolidatedOp: 'UPSERT' | 'DELETE' | 'SKIP' = 'UPSERT';
      if (firstOp === 'CREATE' && lastOp === 'DELETE') {
        // Record was created and deleted locally before ever being synced
        consolidatedOp = 'SKIP';
      } else if (lastOp === 'DELETE') {
        consolidatedOp = 'DELETE';
      } else {
        consolidatedOp = 'UPSERT';
      }

      tableActions.get(tableName)!.set(recordId, {
        op: consolidatedOp,
        queueIds: allQueueIds,
      });
    }

    let totalSyncedRecords = 0;
    const successfullySyncedQueueIds: number[] = [];
    const detailedTableChanges: Array<{
      table: string;
      recordId: string;
      operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'SKIP';
    }> = [];

    // Process each modified table independently for fault-tolerance (Requirement 9)
    for (const tableName of tablesToSync) {
      const pkField = getPrimaryKeyField(tableName);
      const actions = tableActions.get(tableName)!;
      const fileName = `${tableName}.json`;

      try {
        console.log(`[SYNC] Synchronizing table "${tableName}" (${actions.size} changes)...`);

        // Read current remote records
        const remoteList =
          (await readRemoteJson<any[]>(drive, folderId, fileName)) || [];
        const recordMap = new Map<string, any>();

        for (const r of remoteList) {
          if (r && r[pkField] !== undefined) {
            recordMap.set(String(r[pkField]), r);
          }
        }

        const tableSyncedQueueIds: number[] = [];

        for (const [recordId, action] of actions.entries()) {
          const originalOps = grouped.get(`${tableName}::${recordId}`) || [];
          if (action.op === 'SKIP') {
            tableSyncedQueueIds.push(...action.queueIds);
            detailedTableChanges.push({ table: tableName, recordId, operation: 'SKIP' });
            continue;
          }

          if (action.op === 'DELETE') {
            recordMap.delete(recordId);
            tableSyncedQueueIds.push(...action.queueIds);
            totalSyncedRecords++;
            detailedTableChanges.push({ table: tableName, recordId, operation: 'DELETE' });
            continue;
          }

          // UPSERT: Fetch latest local state
          const currentRecord = await fetchLocalRecord(tableName, recordId);
          const opType = originalOps[0]?.operation === 'CREATE' ? 'CREATE' : 'UPDATE';
          if (currentRecord) {
            recordMap.set(recordId, currentRecord);
            tableSyncedQueueIds.push(...action.queueIds);
            totalSyncedRecords++;
            detailedTableChanges.push({ table: tableName, recordId, operation: opType });
          } else {
            // Record was deleted in the interim
            recordMap.delete(recordId);
            tableSyncedQueueIds.push(...action.queueIds);
            totalSyncedRecords++;
            detailedTableChanges.push({ table: tableName, recordId, operation: 'DELETE' });
          }
        }

        // Upload updated table JSON to Google Drive
        const updatedArray = Array.from(recordMap.values());
        await updateRemoteJson(drive, folderId, fileName, updatedArray);

        // Mark this table's queue records as synced in SQLite
        if (tableSyncedQueueIds.length > 0) {
          const placeholders = tableSyncedQueueIds.map(() => '?').join(',');
          await db.run(
            `UPDATE sync_queue SET synced_at = datetime('now') WHERE id IN (${placeholders})`,
            ...tableSyncedQueueIds
          );
          successfullySyncedQueueIds.push(...tableSyncedQueueIds);
        }

        console.log(`[SYNC] Table "${tableName}" synced successfully.`);
      } catch (tableErr: any) {
        console.error(`[SYNC] Failed to sync table "${tableName}":`, tableErr);
        // Requirement 9: Mark affected items as failed with retry_count incremented
        const failedIds: number[] = [];
        for (const act of actions.values()) {
          failedIds.push(...act.queueIds);
        }
        if (failedIds.length > 0) {
          const placeholders = failedIds.map(() => '?').join(',');
          await db.run(
            `UPDATE sync_queue SET retry_count = retry_count + 1, last_error = ? WHERE id IN (${placeholders})`,
            tableErr?.message || 'Drive sync error',
            ...failedIds
          );
        }
      }
    }

    // Sync database snapshot to Google Drive
    console.log('[SYNC] Syncing SQLite binary snapshot (college.db) to Google Drive...');
    const dbSnap = await syncDatabaseSnapshot(drive, folderId);

    // Update remote sync_metadata.json & record commit on Drive
    const currentVersion = (remoteMeta?.sync_version || 1) + 1;
    const completedAt = new Date().toISOString();

    const summaryParts: string[] = [];
    if (totalSyncedRecords > 0) summaryParts.push(`${totalSyncedRecords} record change(s)`);
    if (uploadsRes.uploaded > 0) summaryParts.push(`${uploadsRes.uploaded} file(s) added`);
    if (uploadsRes.updated > 0) summaryParts.push(`${uploadsRes.updated} file(s) updated`);
    if (uploadsRes.deleted > 0) summaryParts.push(`${uploadsRes.deleted} file(s) removed`);
    if (summaryParts.length === 0) summaryParts.push(`Database snapshot updated (${Math.round(dbSnap.sizeBytes / 1024)} KB)`);

    const commitData: SyncCommitDetail = {
      version: currentVersion,
      timestamp: completedAt,
      trigger: triggerType,
      summary: summaryParts.join(', '),
      recordsCount: totalSyncedRecords,
      filesSyncedCount: totalFilesChanged,
      tableChanges: detailedTableChanges,
      filesSynced: uploadsRes.files,
      dbSnapshot: {
        fileId: dbSnap.fileId,
        sizeBytes: dbSnap.sizeBytes,
      },
    };

    await recordCommitOnDrive(drive, folderId, commitData);

    await updateRemoteJson(drive, folderId, 'sync_metadata.json', {
      sync_version: currentVersion,
      last_sync_at: completedAt,
      last_sync_status: 'success',
      total_pending_remaining: pendingRows.length - successfullySyncedQueueIds.length,
      latest_commit: {
        version: currentVersion,
        summary: commitData.summary,
        timestamp: completedAt,
      },
    });

    const isPartial = successfullySyncedQueueIds.length < pendingRows.length;
    const finalStatus: 'success' | 'partial' = isPartial ? 'partial' : 'success';

    if (historyId) {
      await db.run(
        `UPDATE sync_history SET status = ?, items_synced = ?, completed_at = ?, details = ?, error_message = NULL WHERE id = ?`,
        finalStatus,
        totalSyncedRecords + totalFilesChanged,
        completedAt,
        JSON.stringify(commitData),
        historyId
      );
    }

    console.log(
      `[SYNC] Synchronization completed (${totalSyncedRecords} records, ${totalFilesChanged} files, status: ${finalStatus}).`
    );

    return {
      success: true,
      message: `Successfully synchronized to Google Drive: ${commitData.summary}.`,
      syncedRecords: totalSyncedRecords + totalFilesChanged,
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
 * Performs full initial backup of all existing SQLite tables to Google Drive
 */
async function performInitialBackup(drive: any, folderId: string): Promise<{ totalCount: number; commitData: SyncCommitDetail }> {
  const db = getDB();
  let totalCount = 0;

  // 1. Courses
  const courses = await db.all(`SELECT * FROM courses ORDER BY code`);
  await updateRemoteJson(drive, folderId, 'courses.json', courses);
  totalCount += courses.length;

  // 2. Fee Structures
  const feeStructures = await db.all(`SELECT * FROM fee_structures ORDER BY id`);
  await updateRemoteJson(drive, folderId, 'fee_structures.json', feeStructures);
  totalCount += feeStructures.length;

  // 3. Students
  const students = await db.all(`SELECT * FROM students ORDER BY id`);
  await updateRemoteJson(drive, folderId, 'students.json', students);
  totalCount += students.length;

  // 4. Fee Payments
  const feePayments = await db.all(`SELECT * FROM fee_payments ORDER BY id`);
  await updateRemoteJson(drive, folderId, 'fee_payments.json', feePayments);
  totalCount += feePayments.length;

  // 5. Expenditures
  const expenditures = await db.all(`SELECT * FROM expenditures ORDER BY id`);
  await updateRemoteJson(drive, folderId, 'expenditures.json', expenditures);
  totalCount += expenditures.length;

  // 6. Users (SAFE non-sensitive fields only)
  const users = await db.all(
    `SELECT id, name, email, role, created_at, updated_at FROM users ORDER BY id`
  );
  await updateRemoteJson(drive, folderId, 'users.json', users);
  totalCount += users.length;

  // 7. System Settings (excluding sync internal keys)
  const settings = await db.all(
    `SELECT * FROM system_settings WHERE key NOT LIKE 'sync_%' ORDER BY key`
  );
  await updateRemoteJson(drive, folderId, 'system_settings.json', settings);
  totalCount += settings.length;

  // 8. Sync all uploads folder files (photos, QR codes, receipts)
  console.log('[SYNC] Backing up uploads folder to Google Drive...');
  const uploadsRes = await syncUploadsFolder(drive, folderId);

  // 9. Sync complete SQLite database snapshot (college.db)
  console.log('[SYNC] Backing up SQLite database binary snapshot (college.db)...');
  const dbSnap = await syncDatabaseSnapshot(drive, folderId);

  const completedAt = new Date().toISOString();

  // 10. Initial Commit record
  const commitData: SyncCommitDetail = {
    version: 1,
    timestamp: completedAt,
    trigger: 'initial_backup',
    summary: `Initial backup of ${totalCount} records, ${uploadsRes.uploaded} file(s), and college.db snapshot (${Math.round(dbSnap.sizeBytes / 1024)} KB)`,
    recordsCount: totalCount,
    filesSyncedCount: uploadsRes.uploaded,
    tableChanges: [
      { table: 'courses', recordId: `All (${courses.length})`, operation: 'CREATE' },
      { table: 'fee_structures', recordId: `All (${feeStructures.length})`, operation: 'CREATE' },
      { table: 'students', recordId: `All (${students.length})`, operation: 'CREATE' },
      { table: 'fee_payments', recordId: `All (${feePayments.length})`, operation: 'CREATE' },
      { table: 'expenditures', recordId: `All (${expenditures.length})`, operation: 'CREATE' },
      { table: 'users', recordId: `All (${users.length})`, operation: 'CREATE' },
      { table: 'system_settings', recordId: `All (${settings.length})`, operation: 'CREATE' },
    ],
    filesSynced: uploadsRes.files,
    dbSnapshot: {
      fileId: dbSnap.fileId,
      sizeBytes: dbSnap.sizeBytes,
    },
  };

  await recordCommitOnDrive(drive, folderId, commitData);

  // 11. Metadata
  await updateRemoteJson(drive, folderId, 'sync_metadata.json', {
    sync_version: 1,
    last_sync_at: completedAt,
    last_sync_status: 'success',
    total_records: totalCount,
    latest_commit: {
      version: 1,
      summary: commitData.summary,
      timestamp: completedAt,
    },
  });

  return { totalCount, commitData };
}

/**
 * Requirement 10: Safe Restore from Google Drive
 * 1. Takes an automatic local SQLite database file backup.
 * 2. Downloads and validates remote data.
 * 3. Imports into SQLite within a transaction with triggers disabled.
 * 4. Re-enables triggers and re-syncs fee calculations.
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
    // 1. Create a local backup of the active SQLite database
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'college.db');
    const dbDir = path.dirname(dbPath);
    backupFileName = `college_backup_${Date.now()}.db`;
    const backupFilePath = path.join(dbDir, backupFileName);
    fs.copyFileSync(dbPath, backupFilePath);
    console.log(`[RESTORE] Created pre-restore local database backup: ${backupFilePath}`);

    // 2. Fetch remote files
    const { drive } = await getAuthenticatedDriveClient();
    const folderId = await getOrCreateFolder(drive, creds.folderId);

    const [courses, feeStructures, students, feePayments, expenditures, users, settings] =
      await Promise.all([
        readRemoteJson<any[]>(drive, folderId, 'courses.json'),
        readRemoteJson<any[]>(drive, folderId, 'fee_structures.json'),
        readRemoteJson<any[]>(drive, folderId, 'students.json'),
        readRemoteJson<any[]>(drive, folderId, 'fee_payments.json'),
        readRemoteJson<any[]>(drive, folderId, 'expenditures.json'),
        readRemoteJson<any[]>(drive, folderId, 'users.json'),
        readRemoteJson<any[]>(drive, folderId, 'system_settings.json'),
      ]);

    // 3. Disable sync triggers temporarily so imported data is not re-queued
    await db.run(
      `INSERT INTO system_settings (key, value, description)
       VALUES ('sync_triggers_disabled', 'true', 'Suppresses sync triggers during restore')
       ON CONFLICT(key) DO UPDATE SET value = 'true'`
    );

    // 4. Import data inside a transaction
    await db.exec('BEGIN TRANSACTION;');

    try {
      if (Array.isArray(courses) && courses.length > 0) {
        for (const c of courses) {
          await db.run(
            `INSERT INTO courses (code, name, duration_type, total_duration, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(code) DO UPDATE SET
               name = excluded.name,
               duration_type = excluded.duration_type,
               total_duration = excluded.total_duration,
               updated_at = excluded.updated_at`,
            c.code,
            c.name,
            c.duration_type,
            c.total_duration,
            c.created_at,
            c.updated_at
          );
        }
      }

      if (Array.isArray(feeStructures) && feeStructures.length > 0) {
        for (const fsItem of feeStructures) {
          await db.run(
            `INSERT INTO fee_structures (id, course_code, academic_year, duration_unit, tuition_fee, exam_fee, library_fee, other_fee, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               course_code = excluded.course_code,
               academic_year = excluded.academic_year,
               duration_unit = excluded.duration_unit,
               tuition_fee = excluded.tuition_fee,
               exam_fee = excluded.exam_fee,
               library_fee = excluded.library_fee,
               other_fee = excluded.other_fee,
               updated_at = excluded.updated_at`,
            fsItem.id,
            fsItem.course_code,
            fsItem.academic_year,
            fsItem.duration_unit,
            fsItem.tuition_fee,
            fsItem.exam_fee,
            fsItem.library_fee,
            fsItem.other_fee,
            fsItem.created_at,
            fsItem.updated_at
          );
        }
      }

      if (Array.isArray(students) && students.length > 0) {
        for (const s of students) {
          await db.run(
            `INSERT INTO students (id, name, college_roll_no, university_roll_no, course_code, current_duration_unit, academic_year, class, section, phone, address, photo_path, qr_code, total_fees_due, total_fees_paid, pending_fees, overall_total_due, overall_total_paid, deleted_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               name = excluded.name,
               college_roll_no = excluded.college_roll_no,
               university_roll_no = excluded.university_roll_no,
               course_code = excluded.course_code,
               current_duration_unit = excluded.current_duration_unit,
               academic_year = excluded.academic_year,
               class = excluded.class,
               section = excluded.section,
               phone = excluded.phone,
               address = excluded.address,
               photo_path = excluded.photo_path,
               qr_code = excluded.qr_code,
               total_fees_due = excluded.total_fees_due,
               total_fees_paid = excluded.total_fees_paid,
               pending_fees = excluded.pending_fees,
               overall_total_due = excluded.overall_total_due,
               overall_total_paid = excluded.overall_total_paid,
               deleted_at = excluded.deleted_at,
               updated_at = excluded.updated_at`,
            s.id,
            s.name,
            s.college_roll_no,
            s.university_roll_no,
            s.course_code,
            s.current_duration_unit,
            s.academic_year,
            s.class,
            s.section,
            s.phone,
            s.address,
            s.photo_path,
            s.qr_code,
            s.total_fees_due || 0,
            s.total_fees_paid || 0,
            s.pending_fees || 0,
            s.overall_total_due || 0,
            s.overall_total_paid || 0,
            s.deleted_at || null,
            s.created_at,
            s.updated_at
          );
        }
      }

      if (Array.isArray(feePayments) && feePayments.length > 0) {
        for (const p of feePayments) {
          await db.run(
            `INSERT INTO fee_payments (id, student_id, staff_id, payment_for, duration_unit, amount, paid_at, note, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               student_id = excluded.student_id,
               staff_id = excluded.staff_id,
               payment_for = excluded.payment_for,
               duration_unit = excluded.duration_unit,
               amount = excluded.amount,
               paid_at = excluded.paid_at,
               note = excluded.note,
               updated_at = excluded.updated_at`,
            p.id,
            p.student_id,
            p.staff_id,
            p.payment_for,
            p.duration_unit,
            p.amount,
            p.paid_at,
            p.note,
            p.created_at,
            p.updated_at
          );
        }
      }

      if (Array.isArray(expenditures) && expenditures.length > 0) {
        for (const e of expenditures) {
          await db.run(
            `INSERT INTO expenditures (id, category, description, amount, spent_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               category = excluded.category,
               description = excluded.description,
               amount = excluded.amount,
               spent_at = excluded.spent_at,
               updated_at = excluded.updated_at`,
            e.id,
            e.category,
            e.description,
            e.amount,
            e.spent_at,
            e.created_at,
            e.updated_at
          );
        }
      }

      if (Array.isArray(settings) && settings.length > 0) {
        for (const st of settings) {
          if (st.key && !st.key.startsWith('sync_')) {
            await db.run(
              `INSERT INTO system_settings (key, value, description, updated_at)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(key) DO UPDATE SET
                 value = excluded.value,
                 description = excluded.description,
                 updated_at = excluded.updated_at`,
              st.key,
              st.value,
              st.description,
              st.updated_at
            );
          }
        }
      }

      // Safe update for users (never wipe existing local passwords)
      if (Array.isArray(users) && users.length > 0) {
        for (const u of users) {
          await db.run(
            `INSERT INTO users (id, name, email, role, password, force_password_reset, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'changeme123', 1, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               name = excluded.name,
               email = excluded.email,
               role = excluded.role,
               updated_at = excluded.updated_at`,
            u.id,
            u.name,
            u.email,
            u.role,
            u.created_at,
            u.updated_at
          );
        }
      }

      await db.exec('COMMIT;');
    } catch (importErr) {
      await db.exec('ROLLBACK;');
      throw importErr;
    } finally {
      // Re-enable sync triggers
      await db.run(
        `UPDATE system_settings SET value = 'false' WHERE key = 'sync_triggers_disabled'`
      );
    }

    // Re-sync fee balances across all students
    try {
      await syncAllStudentsFees();
    } catch (feeErr) {
      console.warn('[RESTORE] Fee calculation re-sync warning:', feeErr);
    }

    // Clear sync queue because local SQLite matches remote Drive state
    await db.run(`DELETE FROM sync_queue`);

    // Log restore history
    await db.run(
      `INSERT INTO sync_history (trigger_type, status, items_synced, started_at, completed_at, error_message)
       VALUES ('restore', 'success', 0, datetime('now'), datetime('now'), NULL)`
    );

    return {
      success: true,
      message: 'Data successfully restored from Google Drive.',
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
