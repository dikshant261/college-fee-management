import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'college.db');
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

async function hasTable(db: Database<sqlite3.Database, sqlite3.Statement>, table: string) {
  const row = await db.get<{ name?: string }>(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, table);
  return Boolean(row?.name);
}

async function hasColumn(db: Database<sqlite3.Database, sqlite3.Statement>, table: string, column: string) {
  const rows = await db.all<{ name: string }[]>(`PRAGMA table_info(${table})`);
  return rows.some((row) => row.name === column);
}

async function addColumnIfMissing(db: Database<sqlite3.Database, sqlite3.Statement>, table: string, columnDefinition: string) {
  const columnName = columnDefinition.trim().split(' ')[0];
  if (!(await hasColumn(db, table, columnName))) {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDefinition}`);
  }
}

let db: Database<sqlite3.Database, sqlite3.Statement> | null = null;

export async function initDB() {
  if (db) return db;
  db = await open({ filename: dbPath, driver: sqlite3.Database });

  // Pragmas
  await db.exec("PRAGMA journal_mode = WAL;");
  await db.exec('PRAGMA foreign_keys = ON;');
  await db.exec('PRAGMA busy_timeout = 5000;');

  // Users table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      role TEXT NOT NULL CHECK(role IN ('admin', 'staff')),
      password TEXT NOT NULL,
      force_password_reset INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS courses (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      duration_type TEXT NOT NULL CHECK(duration_type IN ('year', 'semester')),
      total_duration INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS fee_structures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_code TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      duration_unit INTEGER NOT NULL,
      tuition_fee REAL NOT NULL DEFAULT 0,
      exam_fee REAL NOT NULL DEFAULT 0,
      library_fee REAL NOT NULL DEFAULT 0,
      other_fee REAL NOT NULL DEFAULT 0,
      total_fee REAL GENERATED ALWAYS AS (tuition_fee + exam_fee + library_fee + other_fee) STORED,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(course_code) REFERENCES courses(code) ON DELETE CASCADE,
      UNIQUE(course_code, academic_year, duration_unit)
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      college_roll_no TEXT UNIQUE NOT NULL,
      university_roll_no TEXT,
      course_code TEXT NOT NULL,
      current_duration_unit INTEGER NOT NULL DEFAULT 1,
      academic_year TEXT NOT NULL,
      class TEXT,
      section TEXT,
      phone TEXT,
      address TEXT,
      photo_path TEXT,
      qr_code TEXT,
      total_fees_due REAL NOT NULL DEFAULT 0,
      total_fees_paid REAL NOT NULL DEFAULT 0,
      pending_fees REAL GENERATED ALWAYS AS (total_fees_due - total_fees_paid) STORED,
      overall_total_due REAL NOT NULL DEFAULT 0,
      overall_total_paid REAL NOT NULL DEFAULT 0,
      deleted_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(course_code) REFERENCES courses(code) ON DELETE SET NULL
    );
  `);

  if (await hasTable(db, 'students')) {
    if ((await hasColumn(db, 'students', 'roll_no')) && !(await hasColumn(db, 'students', 'college_roll_no'))) {
      await db.exec('ALTER TABLE students RENAME COLUMN roll_no TO college_roll_no;');
    } else {
      await addColumnIfMissing(db, 'students', 'college_roll_no TEXT');
    }
    await addColumnIfMissing(db, 'students', 'university_roll_no TEXT');
    await addColumnIfMissing(db, 'students', 'course_code TEXT');
    await addColumnIfMissing(db, 'students', 'current_duration_unit INTEGER NOT NULL DEFAULT 1');
    await addColumnIfMissing(db, 'students', 'academic_year TEXT');
    await addColumnIfMissing(db, 'students', 'photo_path TEXT');
    await addColumnIfMissing(db, 'students', 'qr_code TEXT');
    await addColumnIfMissing(db, 'students', 'total_fees_due REAL NOT NULL DEFAULT 0');
    await addColumnIfMissing(db, 'students', 'total_fees_paid REAL NOT NULL DEFAULT 0');
    await addColumnIfMissing(db, 'students', 'pending_fees REAL DEFAULT 0');
    await addColumnIfMissing(db, 'students', 'overall_total_due REAL NOT NULL DEFAULT 0');
    await addColumnIfMissing(db, 'students', 'overall_total_paid REAL NOT NULL DEFAULT 0');
    await addColumnIfMissing(db, 'students', 'deleted_at TEXT');
    await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_students_college_roll_no ON students(college_roll_no);');
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS fee_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      staff_id INTEGER,
      payment_for TEXT NOT NULL CHECK(payment_for IN ('current_year', 'previous_due', 'advance', 'other')),
      duration_unit INTEGER NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      paid_at TEXT DEFAULT (datetime('now')),
      note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY(staff_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS expenditures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL DEFAULT 0,
      spent_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS users_updated_at
    AFTER UPDATE ON users
    FOR EACH ROW
    BEGIN
      UPDATE users SET updated_at = datetime('now') WHERE id = OLD.id;
    END;
  `);

  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS courses_updated_at
    AFTER UPDATE ON courses
    FOR EACH ROW
    BEGIN
      UPDATE courses SET updated_at = datetime('now') WHERE code = OLD.code;
    END;
  `);

  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS fee_structures_updated_at
    AFTER UPDATE ON fee_structures
    FOR EACH ROW
    BEGIN
      UPDATE fee_structures SET updated_at = datetime('now') WHERE id = OLD.id;
    END;
  `);

  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS students_updated_at
    AFTER UPDATE ON students
    FOR EACH ROW
    BEGIN
      UPDATE students SET updated_at = datetime('now') WHERE id = OLD.id;
    END;
  `);

  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS fee_payments_updated_at
    AFTER UPDATE ON fee_payments
    FOR EACH ROW
    BEGIN
      UPDATE fee_payments SET updated_at = datetime('now') WHERE id = OLD.id;
    END;
  `);

  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS expenditures_updated_at
    AFTER UPDATE ON expenditures
    FOR EACH ROW
    BEGIN
      UPDATE expenditures SET updated_at = datetime('now') WHERE id = OLD.id;
    END;
  `);

  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS system_settings_updated_at
    AFTER UPDATE ON system_settings
    FOR EACH ROW
    BEGIN
      UPDATE system_settings SET updated_at = datetime('now') WHERE key = OLD.key;
    END;
  `);

  // =========================================================================
  // GOOGLE DRIVE SYNC SYSTEM: Tables & Triggers
  // =========================================================================

  await db.exec(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('CREATE', 'UPDATE', 'DELETE')),
      created_at TEXT DEFAULT (datetime('now')),
      synced_at TEXT,
      retry_count INTEGER DEFAULT 0,
      last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sync_queue_synced ON sync_queue(synced_at);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_table_record ON sync_queue(table_name, record_id);

    CREATE TABLE IF NOT EXISTS sync_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trigger_type TEXT NOT NULL CHECK(trigger_type IN ('manual', 'automatic', 'restore')),
      status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'partial')),
      items_synced INTEGER DEFAULT 0,
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      error_message TEXT,
      details TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_google_tokens (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      encrypted_tokens TEXT NOT NULL,
      user_email TEXT,
      folder_id TEXT,
      folder_name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_drive_files (
      table_name TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_uploaded_files (
      relative_path TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mtime_ms INTEGER NOT NULL,
      synced_at TEXT DEFAULT (datetime('now'))
    );
  `);

  await addColumnIfMissing(db, 'sync_history', 'details TEXT');

  // Triggers for students
  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS students_sync_insert
    AFTER INSERT ON students
    FOR EACH ROW
    WHEN (SELECT value FROM system_settings WHERE key = 'sync_triggers_disabled') IS NOT 'true'
    BEGIN
      INSERT INTO sync_queue (table_name, record_id, operation, created_at)
      VALUES ('students', CAST(NEW.id AS TEXT), 'CREATE', datetime('now'));
    END;

    CREATE TRIGGER IF NOT EXISTS students_sync_update
    AFTER UPDATE ON students
    FOR EACH ROW
    WHEN (SELECT value FROM system_settings WHERE key = 'sync_triggers_disabled') IS NOT 'true'
    BEGIN
      INSERT INTO sync_queue (table_name, record_id, operation, created_at)
      VALUES ('students', CAST(NEW.id AS TEXT), 'UPDATE', datetime('now'));
    END;

    CREATE TRIGGER IF NOT EXISTS students_sync_delete
    AFTER DELETE ON students
    FOR EACH ROW
    WHEN (SELECT value FROM system_settings WHERE key = 'sync_triggers_disabled') IS NOT 'true'
    BEGIN
      INSERT INTO sync_queue (table_name, record_id, operation, created_at)
      VALUES ('students', CAST(OLD.id AS TEXT), 'DELETE', datetime('now'));
    END;
  `);

  // Triggers for fee_payments
  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS fee_payments_sync_insert
    AFTER INSERT ON fee_payments
    FOR EACH ROW
    WHEN (SELECT value FROM system_settings WHERE key = 'sync_triggers_disabled') IS NOT 'true'
    BEGIN
      INSERT INTO sync_queue (table_name, record_id, operation, created_at)
      VALUES ('fee_payments', CAST(NEW.id AS TEXT), 'CREATE', datetime('now'));
    END;

    CREATE TRIGGER IF NOT EXISTS fee_payments_sync_update
    AFTER UPDATE ON fee_payments
    FOR EACH ROW
    WHEN (SELECT value FROM system_settings WHERE key = 'sync_triggers_disabled') IS NOT 'true'
    BEGIN
      INSERT INTO sync_queue (table_name, record_id, operation, created_at)
      VALUES ('fee_payments', CAST(NEW.id AS TEXT), 'UPDATE', datetime('now'));
    END;

    CREATE TRIGGER IF NOT EXISTS fee_payments_sync_delete
    AFTER DELETE ON fee_payments
    FOR EACH ROW
    WHEN (SELECT value FROM system_settings WHERE key = 'sync_triggers_disabled') IS NOT 'true'
    BEGIN
      INSERT INTO sync_queue (table_name, record_id, operation, created_at)
      VALUES ('fee_payments', CAST(OLD.id AS TEXT), 'DELETE', datetime('now'));
    END;
  `);

  // Triggers for fee_structures
  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS fee_structures_sync_insert
    AFTER INSERT ON fee_structures
    FOR EACH ROW
    WHEN (SELECT value FROM system_settings WHERE key = 'sync_triggers_disabled') IS NOT 'true'
    BEGIN
      INSERT INTO sync_queue (table_name, record_id, operation, created_at)
      VALUES ('fee_structures', CAST(NEW.id AS TEXT), 'CREATE', datetime('now'));
    END;

    CREATE TRIGGER IF NOT EXISTS fee_structures_sync_update
    AFTER UPDATE ON fee_structures
    FOR EACH ROW
    WHEN (SELECT value FROM system_settings WHERE key = 'sync_triggers_disabled') IS NOT 'true'
    BEGIN
      INSERT INTO sync_queue (table_name, record_id, operation, created_at)
      VALUES ('fee_structures', CAST(NEW.id AS TEXT), 'UPDATE', datetime('now'));
    END;

    CREATE TRIGGER IF NOT EXISTS fee_structures_sync_delete
    AFTER DELETE ON fee_structures
    FOR EACH ROW
    WHEN (SELECT value FROM system_settings WHERE key = 'sync_triggers_disabled') IS NOT 'true'
    BEGIN
      INSERT INTO sync_queue (table_name, record_id, operation, created_at)
      VALUES ('fee_structures', CAST(OLD.id AS TEXT), 'DELETE', datetime('now'));
    END;
  `);

  // Triggers for courses
  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS courses_sync_insert
    AFTER INSERT ON courses
    FOR EACH ROW
    WHEN (SELECT value FROM system_settings WHERE key = 'sync_triggers_disabled') IS NOT 'true'
    BEGIN
      INSERT INTO sync_queue (table_name, record_id, operation, created_at)
      VALUES ('courses', NEW.code, 'CREATE', datetime('now'));
    END;

    CREATE TRIGGER IF NOT EXISTS courses_sync_update
    AFTER UPDATE ON courses
    FOR EACH ROW
    WHEN (SELECT value FROM system_settings WHERE key = 'sync_triggers_disabled') IS NOT 'true'
    BEGIN
      INSERT INTO sync_queue (table_name, record_id, operation, created_at)
      VALUES ('courses', NEW.code, 'UPDATE', datetime('now'));
    END;

    CREATE TRIGGER IF NOT EXISTS courses_sync_delete
    AFTER DELETE ON courses
    FOR EACH ROW
    WHEN (SELECT value FROM system_settings WHERE key = 'sync_triggers_disabled') IS NOT 'true'
    BEGIN
      INSERT INTO sync_queue (table_name, record_id, operation, created_at)
      VALUES ('courses', OLD.code, 'DELETE', datetime('now'));
    END;
  `);

  // Triggers for expenditures
  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS expenditures_sync_insert
    AFTER INSERT ON expenditures
    FOR EACH ROW
    WHEN (SELECT value FROM system_settings WHERE key = 'sync_triggers_disabled') IS NOT 'true'
    BEGIN
      INSERT INTO sync_queue (table_name, record_id, operation, created_at)
      VALUES ('expenditures', CAST(NEW.id AS TEXT), 'CREATE', datetime('now'));
    END;

    CREATE TRIGGER IF NOT EXISTS expenditures_sync_update
    AFTER UPDATE ON expenditures
    FOR EACH ROW
    WHEN (SELECT value FROM system_settings WHERE key = 'sync_triggers_disabled') IS NOT 'true'
    BEGIN
      INSERT INTO sync_queue (table_name, record_id, operation, created_at)
      VALUES ('expenditures', CAST(NEW.id AS TEXT), 'UPDATE', datetime('now'));
    END;

    CREATE TRIGGER IF NOT EXISTS expenditures_sync_delete
    AFTER DELETE ON expenditures
    FOR EACH ROW
    WHEN (SELECT value FROM system_settings WHERE key = 'sync_triggers_disabled') IS NOT 'true'
    BEGIN
      INSERT INTO sync_queue (table_name, record_id, operation, created_at)
      VALUES ('expenditures', CAST(OLD.id AS TEXT), 'DELETE', datetime('now'));
    END;
  `);

  // Triggers for users
  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS users_sync_insert
    AFTER INSERT ON users
    FOR EACH ROW
    WHEN (SELECT value FROM system_settings WHERE key = 'sync_triggers_disabled') IS NOT 'true'
    BEGIN
      INSERT INTO sync_queue (table_name, record_id, operation, created_at)
      VALUES ('users', CAST(NEW.id AS TEXT), 'CREATE', datetime('now'));
    END;

    CREATE TRIGGER IF NOT EXISTS users_sync_update
    AFTER UPDATE ON users
    FOR EACH ROW
    WHEN (SELECT value FROM system_settings WHERE key = 'sync_triggers_disabled') IS NOT 'true'
    BEGIN
      INSERT INTO sync_queue (table_name, record_id, operation, created_at)
      VALUES ('users', CAST(NEW.id AS TEXT), 'UPDATE', datetime('now'));
    END;

    CREATE TRIGGER IF NOT EXISTS users_sync_delete
    AFTER DELETE ON users
    FOR EACH ROW
    WHEN (SELECT value FROM system_settings WHERE key = 'sync_triggers_disabled') IS NOT 'true'
    BEGIN
      INSERT INTO sync_queue (table_name, record_id, operation, created_at)
      VALUES ('users', CAST(OLD.id AS TEXT), 'DELETE', datetime('now'));
    END;
  `);

  // Triggers for system_settings (excluding internal sync settings)
  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS system_settings_sync_insert
    AFTER INSERT ON system_settings
    FOR EACH ROW
    WHEN NEW.key NOT LIKE 'sync_%' AND (SELECT value FROM system_settings WHERE key = 'sync_triggers_disabled') IS NOT 'true'
    BEGIN
      INSERT INTO sync_queue (table_name, record_id, operation, created_at)
      VALUES ('system_settings', NEW.key, 'CREATE', datetime('now'));
    END;

    CREATE TRIGGER IF NOT EXISTS system_settings_sync_update
    AFTER UPDATE ON system_settings
    FOR EACH ROW
    WHEN NEW.key NOT LIKE 'sync_%' AND (SELECT value FROM system_settings WHERE key = 'sync_triggers_disabled') IS NOT 'true'
    BEGIN
      INSERT INTO sync_queue (table_name, record_id, operation, created_at)
      VALUES ('system_settings', NEW.key, 'UPDATE', datetime('now'));
    END;

    CREATE TRIGGER IF NOT EXISTS system_settings_sync_delete
    AFTER DELETE ON system_settings
    FOR EACH ROW
    WHEN OLD.key NOT LIKE 'sync_%' AND (SELECT value FROM system_settings WHERE key = 'sync_triggers_disabled') IS NOT 'true'
    BEGIN
      INSERT INTO sync_queue (table_name, record_id, operation, created_at)
      VALUES ('system_settings', OLD.key, 'DELETE', datetime('now'));
    END;
  `);

  await db.exec(`
    INSERT OR IGNORE INTO courses(code, name, duration_type, total_duration) VALUES
      ('CS', 'Computer Science', 'year', 4),
      ('ME', 'Mechanical Engineering', 'year', 4),
      ('BT', 'Biotechnology', 'year', 4),
      ('COM', 'Commerce', 'year', 3)
  `);

  await db.exec(`
    INSERT OR IGNORE INTO system_settings(key, value, description) VALUES
      ('college_name', 'My College', 'Official college display name'),
      ('current_academic_year', '2025-26', 'Current academic year'),
      ('default_password', 'changeme123', 'Initial default password for new users')
  `);

  const defaultEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@college.local';
  const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'changeme123';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  await db.run(
    `INSERT OR IGNORE INTO users (name, email, role, password, force_password_reset)
      VALUES (?, ?, 'admin', ?, 1);`,
    'Administrator',
    defaultEmail,
    passwordHash
  );

  return db;
}

export function getDB() {
  if (!db) throw new Error('Database not initialized. Call initDB() first.');
  return db;
}

