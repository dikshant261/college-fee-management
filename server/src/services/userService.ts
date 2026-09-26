import sqlite3 from 'sqlite3';
import { getDB } from '../db';
import { hashPassword } from './authService';

export interface UserRecord {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  force_password_reset: number;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

function sanitizeUser(row: any): UserRecord {
  const { password, ...rest } = row;
  return rest;
}

export async function getUsers() {
  const db = getDB();
  const rows = await db.all<UserRecord[]>(
    `SELECT id, name, email, role, force_password_reset, last_login_at, created_at, updated_at FROM users ORDER BY created_at DESC`
  );
  return rows;
}

export async function getUserById(id: number) {
  const db = getDB();
  const row = await db.get<UserRecord>(
    `SELECT id, name, email, role, force_password_reset, last_login_at, created_at, updated_at FROM users WHERE id = ?`,
    id
  );
  return row || null;
}

export async function createUser(input: { name: string; email: string; role: 'admin' | 'staff' }) {
  const db = getDB();
  const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'changeme123';
  const passwordHash = await hashPassword(defaultPassword);
  const result = await db.run(
    `INSERT INTO users (name, email, role, password, force_password_reset) VALUES (?, ?, ?, ?, 1)`,
    input.name,
    input.email,
    input.role,
    passwordHash
  );
  return getUserById(result.lastID!);
}

export async function updateUser(
  id: number,
  input: Partial<{
    name: string;
    email: string;
    role: 'admin' | 'staff';
    force_password_reset: number;
    password?: string;
  }>
) {
  const db = getDB();
  const existing = await getUserById(id);
  if (!existing) return null;
  const updatedName = input.name ?? existing.name;
  const updatedEmail = input.email ?? existing.email;
  const updatedRole = input.role ?? existing.role;
  const updatedReset = typeof input.force_password_reset === 'number' ? input.force_password_reset : existing.force_password_reset;

  if (input.password && input.password.trim()) {
    const passwordHash = await hashPassword(input.password.trim());
    await db.run(
      `UPDATE users SET name = ?, email = ?, role = ?, force_password_reset = ?, password = ?, updated_at = datetime('now') WHERE id = ?`,
      updatedName,
      updatedEmail,
      updatedRole,
      updatedReset,
      passwordHash,
      id
    );
  } else {
    await db.run(
      `UPDATE users SET name = ?, email = ?, role = ?, force_password_reset = ?, updated_at = datetime('now') WHERE id = ?`,
      updatedName,
      updatedEmail,
      updatedRole,
      updatedReset,
      id
    );
  }
  return getUserById(id);
}

export async function deleteUser(id: number) {
  const db = getDB();
  await db.run(`DELETE FROM users WHERE id = ?`, id);
  return true;
}
