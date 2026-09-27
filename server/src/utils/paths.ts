import path from 'path';
import fs from 'fs';

export function getDatabasePath(): string {
  if (process.env.DATABASE_PATH && process.env.DATABASE_PATH.trim()) {
    return path.resolve(process.env.DATABASE_PATH.trim());
  }
  if (process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'CollegeFeeManagement', 'college.db');
  }
  return path.resolve(process.cwd(), 'college.db');
}

export function getUploadsDir(): string {
  if (process.env.UPLOADS_DIR && process.env.UPLOADS_DIR.trim()) {
    return path.resolve(process.env.UPLOADS_DIR.trim());
  }
  if (process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'CollegeFeeManagement', 'uploads');
  }
  return path.resolve(process.cwd(), 'uploads');
}

export function ensureStorageDirs() {
  const dbPath = getDatabasePath();
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const uploadsDir = getUploadsDir();
  const studentsDir = path.join(uploadsDir, 'students');
  const qrcodesDir = path.join(uploadsDir, 'qrcodes');

  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(studentsDir)) fs.mkdirSync(studentsDir, { recursive: true });
  if (!fs.existsSync(qrcodesDir)) fs.mkdirSync(qrcodesDir, { recursive: true });

  return { dbPath, uploadsDir, studentsDir, qrcodesDir };
}
