import { getDB } from '../db';

export interface CourseRecord {
  code: string;
  name: string;
  duration_type: 'year' | 'semester';
  total_duration: number;
  created_at: string;
  updated_at: string;
}

export async function getCourses() {
  const db = getDB();
  return db.all<CourseRecord[]>(`SELECT code, name, duration_type, total_duration, created_at, updated_at FROM courses ORDER BY name`);
}

export async function getCourseByCode(code: string) {
  const db = getDB();
  return db.get<CourseRecord>(`SELECT code, name, duration_type, total_duration, created_at, updated_at FROM courses WHERE code = ?`, code);
}

export async function createCourse(input: { code: string; name: string; duration_type: 'year' | 'semester'; total_duration: number }) {
  const db = getDB();
  await db.run(`INSERT INTO courses (code, name, duration_type, total_duration) VALUES (?, ?, ?, ?)`, input.code, input.name, input.duration_type, input.total_duration);
  return getCourseByCode(input.code);
}

export async function updateCourse(code: string, input: Partial<{ code?: string; name: string; duration_type: 'year' | 'semester'; total_duration: number }>) {
  const existing = await getCourseByCode(code);
  if (!existing) return null;
  const updatedCode = input.code ? input.code.trim().toUpperCase() : existing.code;
  const updatedName = input.name ?? existing.name;
  const updatedDurationType = input.duration_type ?? existing.duration_type;
  const updatedTotalDuration = input.total_duration !== undefined ? Number(input.total_duration) : existing.total_duration;
  const db = getDB();

  if (updatedCode !== existing.code) {
    const duplicate = await getCourseByCode(updatedCode);
    if (duplicate) {
      throw new Error(`Course code '${updatedCode}' is already taken.`);
    }
    await db.run(`UPDATE fee_structures SET course_code = ? WHERE course_code = ?`, updatedCode, code);
    await db.run(`UPDATE students SET course_code = ? WHERE course_code = ?`, updatedCode, code);
    await db.run(
      `UPDATE courses SET code = ?, name = ?, duration_type = ?, total_duration = ?, updated_at = datetime('now') WHERE code = ?`,
      updatedCode,
      updatedName,
      updatedDurationType,
      updatedTotalDuration,
      code
    );
    return getCourseByCode(updatedCode);
  } else {
    await db.run(
      `UPDATE courses SET name = ?, duration_type = ?, total_duration = ?, updated_at = datetime('now') WHERE code = ?`,
      updatedName,
      updatedDurationType,
      updatedTotalDuration,
      code
    );
    return getCourseByCode(code);
  }
}

export async function deleteCourse(code: string) {
  const db = getDB();
  await db.run(`DELETE FROM fee_structures WHERE course_code = ?`, code);
  await db.run(`DELETE FROM courses WHERE code = ?`, code);
  return true;
}
