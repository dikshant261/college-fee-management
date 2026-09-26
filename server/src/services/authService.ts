import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sqlite3 from 'sqlite3';
import { getDB } from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES_IN = '8h';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  force_password_reset: number;
  last_login_at?: string | null;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function getUserByEmail(email: string) {
  const db = getDB();
  return db.get<AuthUser & { password: string }>(
    `SELECT id, name, email, role, force_password_reset, last_login_at, password
      FROM users
      WHERE LOWER(email) = LOWER(?)`,
    email
  );
}

export async function getAuthUserById(id: number) {
  const db = getDB();
  return db.get<AuthUser>(
    `SELECT id, name, email, role, force_password_reset, last_login_at
      FROM users
      WHERE id = ?`,
    id
  );
}

export function signToken(user: AuthUser) {
  return jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as { userId: number; role: string; iat: number; exp: number };
}

export async function loginUser(email: string, password: string) {
  const user = await getUserByEmail(email);
  if (!user) return null;
  const passwordMatches = await verifyPassword(password, user.password);
  if (!passwordMatches) return null;

  const db = getDB();
  await db.run(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`, user.id);

  const authUser: AuthUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as 'admin' | 'staff',
    force_password_reset: user.force_password_reset,
    last_login_at: user.last_login_at
  };

  return { user: authUser, token: signToken(authUser) };
}

export async function resetPassword(userId: number, newPassword: string) {
  const db = getDB();
  const passwordHash = await hashPassword(newPassword);
  await db.run(
    `UPDATE users SET password = ?, force_password_reset = 0, updated_at = datetime('now') WHERE id = ?`,
    passwordHash,
    userId
  );
  return getAuthUserById(userId);
}
