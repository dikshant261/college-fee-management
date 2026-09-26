import { drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import { getDB } from '../db';
import { saveDriveFolderInfo } from './googleAuthService';

const DEFAULT_FOLDER_NAME = process.env.GOOGLE_DRIVE_FOLDER_NAME || 'College Management System Backup';

export async function getOrCreateFolder(
  drive: drive_v3.Drive,
  existingFolderId?: string | null
): Promise<string> {
  const folderName = DEFAULT_FOLDER_NAME;

  // 1. If we have a cached folder ID, check if it's still accessible
  if (existingFolderId) {
    try {
      const res = await drive.files.get({
        fileId: existingFolderId,
        fields: 'id, name, trashed',
      });
      if (res.data.id && !res.data.trashed) {
        return res.data.id;
      }
    } catch {
      console.warn('[GoogleDrive] Cached folder ID invalid or inaccessible, searching or creating anew...');
    }
  }

  // 2. Search for existing folder with our app name
  try {
    const listRes = await drive.files.list({
      q: `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    const files = listRes.data.files;
    if (files && files.length > 0 && files[0].id) {
      const foundId = files[0].id;
      await saveDriveFolderInfo(foundId, folderName);
      return foundId;
    }
  } catch (err) {
    console.error('[GoogleDrive] Error searching for folder:', err);
  }

  // 3. Create folder if not found
  const createRes = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id, name',
  });

  if (!createRes.data.id) {
    throw new Error('Failed to create application folder in Google Drive.');
  }

  const newFolderId = createRes.data.id;
  await saveDriveFolderInfo(newFolderId, folderName);
  console.log(`[GoogleDrive] Created new application folder: "${folderName}" (${newFolderId})`);
  return newFolderId;
}

export async function getOrCreateSubfolder(
  drive: drive_v3.Drive,
  parentId: string,
  folderName: string
): Promise<string> {
  const listRes = await drive.files.list({
    q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (listRes.data.files && listRes.data.files.length > 0 && listRes.data.files[0].id) {
    return listRes.data.files[0].id;
  }

  const createRes = await drive.files.create({
    requestBody: {
      name: folderName,
      parents: [parentId],
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id, name',
  });

  if (!createRes.data.id) {
    throw new Error(`Failed to create subfolder "${folderName}" in Google Drive.`);
  }

  return createRes.data.id;
}

export async function getCachedFileId(tableName: string): Promise<string | null> {
  const db = getDB();
  const row = await db.get<{ file_id: string }>(
    `SELECT file_id FROM sync_drive_files WHERE table_name = ?`,
    tableName
  );
  return row?.file_id || null;
}

export async function cacheFileId(tableName: string, fileId: string): Promise<void> {
  const db = getDB();
  await db.run(
    `INSERT INTO sync_drive_files (table_name, file_id, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(table_name) DO UPDATE SET file_id = excluded.file_id, updated_at = datetime('now')`,
    tableName,
    fileId
  );
}

export async function findOrCreateFile(
  drive: drive_v3.Drive,
  folderId: string,
  fileName: string,
  initialContent: string = '[]'
): Promise<string> {
  const cachedId = await getCachedFileId(fileName);
  if (cachedId) {
    try {
      const check = await drive.files.get({ fileId: cachedId, fields: 'id, trashed' });
      if (check.data.id && !check.data.trashed) {
        return check.data.id;
      }
    } catch {
      // Cached file was deleted remotely or inaccessible
    }
  }

  // Search inside folder
  const listRes = await drive.files.list({
    q: `'${folderId}' in parents and name = '${fileName}' and trashed = false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  const files = listRes.data.files;
  if (files && files.length > 0 && files[0].id) {
    const fileId = files[0].id;
    await cacheFileId(fileName, fileId);
    return fileId;
  }

  // Create file inside folder
  const stream = new Readable();
  stream.push(initialContent);
  stream.push(null);

  const createRes = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType: 'application/json',
      body: stream,
    },
    fields: 'id, name',
  });

  if (!createRes.data.id) {
    throw new Error(`Failed to create remote file ${fileName} in Google Drive.`);
  }

  const newFileId = createRes.data.id;
  await cacheFileId(fileName, newFileId);
  return newFileId;
}

export async function readRemoteJson<T = any>(
  drive: drive_v3.Drive,
  folderId: string,
  fileName: string
): Promise<T | null> {
  try {
    const fileId = await findOrCreateFile(drive, folderId, fileName, '[]');
    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'text' }
    );

    const rawData = res.data as any;
    if (typeof rawData === 'string') {
      if (!rawData.trim()) return null;
      return JSON.parse(rawData) as T;
    }
    return rawData as T;
  } catch (err: any) {
    if (err?.code === 404) return null;
    throw err;
  }
}

export async function updateRemoteJson(
  drive: drive_v3.Drive,
  folderId: string,
  fileName: string,
  data: any
): Promise<string> {
  const fileId = await findOrCreateFile(drive, folderId, fileName, '[]');
  const jsonString = JSON.stringify(data, null, 2);

  const stream = new Readable();
  stream.push(jsonString);
  stream.push(null);

  await drive.files.update({
    fileId,
    media: {
      mimeType: 'application/json',
      body: stream,
    },
  });

  return fileId;
}

export async function uploadOrUpdateBinaryFile(
  drive: drive_v3.Drive,
  parentId: string,
  fileName: string,
  localFilePath: string,
  mimeType: string,
  existingFileId?: string | null
): Promise<string> {
  if (existingFileId) {
    try {
      const check = await drive.files.get({ fileId: existingFileId, fields: 'id, trashed' });
      if (check.data.id && !check.data.trashed) {
        const stream = fs.createReadStream(localFilePath);
        await drive.files.update({
          fileId: existingFileId,
          media: {
            mimeType,
            body: stream,
          },
        });
        return existingFileId;
      }
    } catch {
      // Existing file deleted or inaccessible
    }
  }

  // Check if file already exists in parent
  const listRes = await drive.files.list({
    q: `'${parentId}' in parents and name = '${fileName}' and trashed = false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (listRes.data.files && listRes.data.files.length > 0 && listRes.data.files[0].id) {
    const foundId = listRes.data.files[0].id;
    const stream = fs.createReadStream(localFilePath);
    await drive.files.update({
      fileId: foundId,
      media: {
        mimeType,
        body: stream,
      },
    });
    return foundId;
  }

  // Create file
  const stream = fs.createReadStream(localFilePath);
  const createRes = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [parentId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id, name',
  });

  if (!createRes.data.id) {
    throw new Error(`Failed to upload binary file "${fileName}" to Google Drive.`);
  }

  return createRes.data.id;
}

export interface UploadFileAction {
  path: string;
  action: 'uploaded' | 'updated' | 'deleted';
}

/**
 * Scans local uploads folder and incrementally synchronizes all photos, QR codes,
 * and uploaded assets to Google Drive.
 */
export async function syncUploadsFolder(
  drive: drive_v3.Drive,
  rootFolderId: string
): Promise<{
  uploaded: number;
  updated: number;
  deleted: number;
  files: UploadFileAction[];
}> {
  const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const db = getDB();
  const remoteUploadsFolderId = await getOrCreateSubfolder(drive, rootFolderId, 'uploads');

  // Subfolder cache (e.g. 'qrcodes' -> folderId, 'students' -> folderId)
  const subfolderMap = new Map<string, string>();
  subfolderMap.set('', remoteUploadsFolderId);

  async function getDriveSubfolder(subPath: string): Promise<string> {
    if (!subPath) return remoteUploadsFolderId;
    if (subfolderMap.has(subPath)) return subfolderMap.get(subPath)!;

    const parts = subPath.split(/[/\\]+/).filter(Boolean);
    let currentParent = remoteUploadsFolderId;
    let accumulatedPath = '';

    for (const part of parts) {
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
      if (subfolderMap.has(accumulatedPath)) {
        currentParent = subfolderMap.get(accumulatedPath)!;
      } else {
        const folderId = await getOrCreateSubfolder(drive, currentParent, part);
        subfolderMap.set(accumulatedPath, folderId);
        currentParent = folderId;
      }
    }
    return currentParent;
  }

  // Scan local files
  const localFiles: Array<{ relativePath: string; absolutePath: string; size: number; mtime: number }> = [];

  function scanDir(dir: string, baseRelative: string = '') {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = baseRelative ? `${baseRelative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        scanDir(fullPath, relPath);
      } else if (entry.isFile()) {
        const stats = fs.statSync(fullPath);
        localFiles.push({
          relativePath: relPath.replace(/\\/g, '/'),
          absolutePath: fullPath,
          size: stats.size,
          mtime: Math.floor(stats.mtimeMs),
        });
      }
    }
  }

  scanDir(uploadsDir);

  // Read already synced files from SQLite
  const syncedRows = await db.all<{ relative_path: string; file_id: string; file_size: number; mtime_ms: number }[]>(
    `SELECT relative_path, file_id, file_size, mtime_ms FROM sync_uploaded_files`
  );
  const syncedMap = new Map(syncedRows.map((r) => [r.relative_path, r]));

  let uploaded = 0;
  let updated = 0;
  let deleted = 0;
  const fileActions: UploadFileAction[] = [];

  const localPathSet = new Set<string>();

  for (const file of localFiles) {
    localPathSet.add(file.relativePath);
    const existing = syncedMap.get(file.relativePath);
    const subDir = path.dirname(file.relativePath);
    const fileName = path.basename(file.relativePath);
    const targetParentId = await getDriveSubfolder(subDir === '.' ? '' : subDir);

    let mimeType = 'application/octet-stream';
    if (fileName.endsWith('.png')) mimeType = 'image/png';
    else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) mimeType = 'image/jpeg';
    else if (fileName.endsWith('.pdf')) mimeType = 'application/pdf';

    if (!existing) {
      // New file -> Upload
      const fileId = await uploadOrUpdateBinaryFile(
        drive,
        targetParentId,
        fileName,
        file.absolutePath,
        mimeType
      );
      await db.run(
        `INSERT INTO sync_uploaded_files (relative_path, file_id, file_size, mtime_ms, synced_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(relative_path) DO UPDATE SET
           file_id = excluded.file_id,
           file_size = excluded.file_size,
           mtime_ms = excluded.mtime_ms,
           synced_at = datetime('now')`,
        file.relativePath,
        fileId,
        file.size,
        file.mtime
      );
      uploaded++;
      fileActions.push({ path: file.relativePath, action: 'uploaded' });
    } else if (existing.mtime_ms !== file.mtime || existing.file_size !== file.size) {
      // Modified file -> Update
      const fileId = await uploadOrUpdateBinaryFile(
        drive,
        targetParentId,
        fileName,
        file.absolutePath,
        mimeType,
        existing.file_id
      );
      await db.run(
        `UPDATE sync_uploaded_files SET file_id = ?, file_size = ?, mtime_ms = ?, synced_at = datetime('now') WHERE relative_path = ?`,
        fileId,
        file.size,
        file.mtime,
        file.relativePath
      );
      updated++;
      fileActions.push({ path: file.relativePath, action: 'updated' });
    }
  }

  // Handle deletions: Files in sync_uploaded_files that no longer exist locally
  for (const synced of syncedRows) {
    if (!localPathSet.has(synced.relative_path)) {
      try {
        await drive.files.delete({ fileId: synced.file_id });
      } catch (err: any) {
        console.warn(`[GoogleDrive] Could not delete remote file ${synced.relative_path}:`, err?.message);
      }
      await db.run(`DELETE FROM sync_uploaded_files WHERE relative_path = ?`, synced.relative_path);
      deleted++;
      fileActions.push({ path: synced.relative_path, action: 'deleted' });
    }
  }

  return { uploaded, updated, deleted, files: fileActions };
}

/**
 * Creates a consistent snapshot of the SQLite database and syncs it to Google Drive
 */
export async function syncDatabaseSnapshot(
  drive: drive_v3.Drive,
  rootFolderId: string
): Promise<{ fileId: string; sizeBytes: number }> {
  const db = getDB();
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'college.db');

  // Checkpoint SQLite WAL mode to flush uncommitted writes to main db file
  try {
    await db.run('PRAGMA wal_checkpoint(PASSIVE);');
  } catch (err) {
    console.warn('[GoogleDrive] WAL checkpoint warning:', err);
  }

  const tempSnapshotPath = path.join(path.dirname(dbPath), `snapshot_${Date.now()}.db`);
  fs.copyFileSync(dbPath, tempSnapshotPath);
  const stats = fs.statSync(tempSnapshotPath);

  try {
    const cachedFileId = await getCachedFileId('college.db');
    const fileId = await uploadOrUpdateBinaryFile(
      drive,
      rootFolderId,
      'college.db',
      tempSnapshotPath,
      'application/x-sqlite3',
      cachedFileId
    );
    await cacheFileId('college.db', fileId);
    return { fileId, sizeBytes: stats.size };
  } finally {
    if (fs.existsSync(tempSnapshotPath)) {
      try {
        fs.unlinkSync(tempSnapshotPath);
      } catch { }
    }
  }
}

/**
 * Appends a GitHub-like sync commit to sync_history.json on Google Drive
 */
export async function recordCommitOnDrive(
  drive: drive_v3.Drive,
  rootFolderId: string,
  commitData: any
): Promise<void> {
  try {
    const historyList = (await readRemoteJson<any[]>(drive, rootFolderId, 'sync_history.json')) || [];
    historyList.unshift(commitData);
    // Keep last 100 commits
    const trimmed = historyList.slice(0, 100);
    await updateRemoteJson(drive, rootFolderId, 'sync_history.json', trimmed);
  } catch (err) {
    console.error('[GoogleDrive] Failed to record commit on Drive:', err);
  }
}

/**
 * Deletes any legacy or stray .json files (e.g. students.json, sync_metadata.json) from Google Drive
 * so only uploads folder and college.db exist.
 */
export async function cleanUpRemoteJsonFiles(
  drive: drive_v3.Drive,
  rootFolderId: string
): Promise<number> {
  let deletedCount = 0;
  try {
    const listRes = await drive.files.list({
      q: `'${rootFolderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType)',
      spaces: 'drive',
    });

    const files = listRes.data.files || [];
    for (const file of files) {
      if (file.id && file.name && (file.name.endsWith('.json') || file.mimeType === 'application/json')) {
        try {
          await drive.files.delete({ fileId: file.id });
          deletedCount++;
          console.log(`[GoogleDrive] Cleaned up remote JSON file: ${file.name} (${file.id})`);
        } catch (delErr: any) {
          console.warn(`[GoogleDrive] Failed to delete remote JSON file ${file.name}:`, delErr?.message);
        }
      }
    }

    // Also clean up local sync_drive_files cache for any json files
    const db = getDB();
    await db.run(`DELETE FROM sync_drive_files WHERE table_name LIKE '%.json'`);
  } catch (err) {
    console.error('[GoogleDrive] Error cleaning up remote JSON files:', err);
  }
  return deletedCount;
}

/**
 * Downloads a remote binary file from Google Drive to a local file path
 */
export async function downloadRemoteFile(
  drive: drive_v3.Drive,
  fileId: string,
  destinationPath: string
): Promise<void> {
  const destStream = fs.createWriteStream(destinationPath);
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );

  return new Promise((resolve, reject) => {
    (res.data as any)
      .pipe(destStream)
      .on('finish', () => resolve())
      .on('error', (err: any) => reject(err));
  });
}

