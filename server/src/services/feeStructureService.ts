import { getDB } from '../db';
import { syncAllStudentsFees } from './studentService';

export interface FeeStructureRecord {
  id: number;
  course_code: string;
  academic_year: string;
  duration_unit: number;
  tuition_fee: number;
  exam_fee: number;
  library_fee: number;
  other_fee: number;
  total_fee: number;
  created_at: string;
  updated_at: string;
}

export async function getFeeStructures() {
  const db = getDB();
  return db.all<FeeStructureRecord[]>(`SELECT * FROM fee_structures ORDER BY academic_year DESC, course_code, duration_unit`);
}

export async function getFeeStructureById(id: number) {
  const db = getDB();
  return db.get<FeeStructureRecord>(`SELECT * FROM fee_structures WHERE id = ?`, id);
}

export async function createFeeStructure(input: {
  course_code: string;
  academic_year: string;
  duration_unit: number;
  tuition_fee: number;
  exam_fee: number;
  library_fee: number;
  other_fee: number;
}) {
  const db = getDB();
  // Check if a fee structure already exists for this course, session, and year
  const existing = await db.get<FeeStructureRecord>(
    `SELECT id FROM fee_structures WHERE course_code = ? AND academic_year = ? AND duration_unit = ?`,
    input.course_code,
    input.academic_year,
    input.duration_unit
  );

  if (existing) {
    // Safely update existing record instead of throwing SQLite constraint error
    return updateFeeStructure(existing.id, input);
  }

  const result = await db.run(
    `INSERT INTO fee_structures (course_code, academic_year, duration_unit, tuition_fee, exam_fee, library_fee, other_fee)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    input.course_code,
    input.academic_year,
    input.duration_unit,
    input.tuition_fee,
    input.exam_fee,
    input.library_fee,
    input.other_fee
  );
  const created = await getFeeStructureById(result.lastID!);
  await syncAllStudentsFees(input.course_code);
  return created;
}

export async function updateFeeStructure(id: number, input: Partial<{
  course_code: string;
  academic_year: string;
  duration_unit: number;
  tuition_fee: number;
  exam_fee: number;
  library_fee: number;
  other_fee: number;
}>) {
  const existing = await getFeeStructureById(id);
  if (!existing) return null;
  const updated = {
    course_code: input.course_code ?? existing.course_code,
    academic_year: input.academic_year ?? existing.academic_year,
    duration_unit: input.duration_unit ?? existing.duration_unit,
    tuition_fee: input.tuition_fee ?? existing.tuition_fee,
    exam_fee: input.exam_fee ?? existing.exam_fee,
    library_fee: input.library_fee ?? existing.library_fee,
    other_fee: input.other_fee ?? existing.other_fee
  };

  const db = getDB();
  // Check if updating this record conflicts with another existing record
  const conflict = await db.get<FeeStructureRecord>(
    `SELECT id FROM fee_structures WHERE course_code = ? AND academic_year = ? AND duration_unit = ? AND id != ?`,
    updated.course_code,
    updated.academic_year,
    updated.duration_unit,
    id
  );

  if (conflict) {
    // Update the existing conflicting record with new fee amounts and remove the redundant record
    await db.run(
      `UPDATE fee_structures SET tuition_fee = ?, exam_fee = ?, library_fee = ?, other_fee = ?, updated_at = datetime('now') WHERE id = ?`,
      updated.tuition_fee,
      updated.exam_fee,
      updated.library_fee,
      updated.other_fee,
      conflict.id
    );
    await db.run(`DELETE FROM fee_structures WHERE id = ?`, id);
    await syncAllStudentsFees(updated.course_code);
    return getFeeStructureById(conflict.id);
  }

  await db.run(
    `UPDATE fee_structures SET course_code = ?, academic_year = ?, duration_unit = ?, tuition_fee = ?, exam_fee = ?, library_fee = ?, other_fee = ?, updated_at = datetime('now') WHERE id = ?`,
    updated.course_code,
    updated.academic_year,
    updated.duration_unit,
    updated.tuition_fee,
    updated.exam_fee,
    updated.library_fee,
    updated.other_fee,
    id
  );
  await syncAllStudentsFees(updated.course_code);
  return getFeeStructureById(id);
}

export async function deleteFeeStructure(id: number) {
  const db = getDB();
  const existing = await getFeeStructureById(id);
  await db.run(`DELETE FROM fee_structures WHERE id = ?`, id);
  if (existing) {
    await syncAllStudentsFees(existing.course_code);
  }
  return true;
}
