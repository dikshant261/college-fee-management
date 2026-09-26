import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function resetAdmin() {
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'college.db');
  const defaultEmail = (process.env.DEFAULT_ADMIN_EMAIL || 'admin@college.local').trim();
  const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'changeme123';

  console.log(`Connecting to database at: ${dbPath}`);
  const db = await open({ filename: dbPath, driver: sqlite3.Database });

  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const existingAdmin = await db.get<{ id: number; email: string; name: string }>(
    `SELECT id, name, email FROM users WHERE LOWER(email) = LOWER(?)`,
    defaultEmail
  );

  if (existingAdmin) {
    await db.run(
      `UPDATE users SET password = ?, force_password_reset = 1, updated_at = datetime('now') WHERE id = ?`,
      passwordHash,
      existingAdmin.id
    );
    console.log(`Successfully reset admin credentials for: ${existingAdmin.email} (ID: ${existingAdmin.id})`);
  } else {
    const anyAdmin = await db.get<{ id: number; email: string }>(
      `SELECT id, email FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1`
    );

    if (anyAdmin) {
      await db.run(
        `UPDATE users SET email = ?, password = ?, force_password_reset = 1, updated_at = datetime('now') WHERE id = ?`,
        defaultEmail,
        passwordHash,
        anyAdmin.id
      );
      console.log(`Successfully updated existing admin (ID: ${anyAdmin.id}) to ${defaultEmail}`);
    } else {
      await db.run(
        `INSERT INTO users (name, email, role, password, force_password_reset) VALUES (?, ?, 'admin', ?, 1)`,
        'Administrator',
        defaultEmail,
        passwordHash
      );
      console.log(`Created new admin account for ${defaultEmail}`);
    }
  }

  console.log(`Credentials:`);
  console.log(`  Email:    ${defaultEmail}`);
  console.log(`  Password: ${defaultPassword}`);
  console.log(`  Force Password Reset: 1 (Active)`);

  await db.close();
}

resetAdmin().catch((err) => {
  console.error('Error resetting admin:', err);
  process.exit(1);
});
