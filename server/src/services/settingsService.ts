import { getDB } from '../db';

export async function getSystemSettings() {
  const db = getDB();
  const rows = await db.all<{ key: string; value: string }[]>(`SELECT key, value FROM system_settings`);
  return rows.reduce<Record<string, string>>((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

export async function updateSystemSettings(values: Record<string, string>) {
  const db = getDB();
  const stmt = await db.prepare(`
    INSERT INTO system_settings(key, value, description, updated_at)
    VALUES (?, ?, '', datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);
  try {
    for (const [key, value] of Object.entries(values)) {
      await stmt.run(key, value);
    }
  } finally {
    await stmt.finalize();
  }
  return getSystemSettings();
}
