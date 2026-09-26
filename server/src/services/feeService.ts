import { getDB } from '../db';
import { syncStudentFees } from './studentService';

export interface FeePaymentRecord {
  id: number;
  student_id: string | number;
  staff_id?: number | null;
  payment_for: 'current_year' | 'previous_due' | 'advance' | 'other';
  duration_unit: number;
  amount: number;
  paid_at: string;
  note?: string | null;
  created_at: string;
  updated_at: string;
  student_name?: string;
  student_roll_no?: string;
}

export async function getFeePayments(filters?: { student_id?: string | number; payment_for?: string }) {
  const db = getDB();
  const conditions: string[] = [];
  const params: Array<string | number> = [];
  if (filters?.student_id) {
    const rawId = String(filters.student_id).trim();
    const numId = Number(rawId);
    conditions.push('(f.student_id = ? OR LOWER(s.college_roll_no) = LOWER(?))');
    params.push(Number.isNaN(numId) ? -1 : numId, rawId);
  }
  if (filters?.payment_for) {
    conditions.push('f.payment_for = ?');
    params.push(filters.payment_for);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.all<FeePaymentRecord[]>(
    `SELECT f.*, s.name as student_name, s.college_roll_no as student_roll_no
     FROM fee_payments f
     LEFT JOIN students s ON f.student_id = s.id
     ${where}
     ORDER BY f.paid_at DESC`,
    ...params
  );
}

export async function createFeePayment(input: {
  student_id: string | number;
  staff_id?: number;
  payment_for: 'current_year' | 'previous_due' | 'advance' | 'other';
  duration_unit: number;
  amount: number;
  note?: string;
}) {
  const db = getDB();
  const rawId = String(input.student_id).trim();
  const numericId = Number(rawId);

  // Look up student by college_roll_no or numeric id
  const student = await db.get<{ id: number; name: string; college_roll_no: string; current_duration_unit: number }>(
    `SELECT id, name, college_roll_no, current_duration_unit FROM students WHERE LOWER(college_roll_no) = LOWER(?) OR id = ?`,
    rawId,
    Number.isNaN(numericId) ? -1 : numericId
  );

  if (!student) {
    throw new Error(`Student not found with ID or Roll Number: "${rawId}"`);
  }

  const durationUnit = input.duration_unit && Number(input.duration_unit) > 0 
    ? Number(input.duration_unit) 
    : student.current_duration_unit;

  const result = await db.run(
    `INSERT INTO fee_payments (student_id, staff_id, payment_for, duration_unit, amount, note)
      VALUES (?, ?, ?, ?, ?, ?)`,
    student.id,
    input.staff_id || null,
    input.payment_for,
    durationUnit,
    input.amount,
    input.note || null
  );

  // Synchronize student fee totals accurately
  await syncStudentFees(student.id);

  return db.get<FeePaymentRecord>(
    `SELECT f.*, s.name as student_name, s.college_roll_no as student_roll_no 
     FROM fee_payments f 
     LEFT JOIN students s ON f.student_id = s.id 
     WHERE f.id = ?`,
    result.lastID
  );
}

export async function deleteFeePayment(id: number) {
  const db = getDB();
  const payment = await db.get<FeePaymentRecord>(`SELECT * FROM fee_payments WHERE id = ?`, id);
  if (payment) {
    await db.run(`DELETE FROM fee_payments WHERE id = ?`, id);
    await syncStudentFees(Number(payment.student_id));
  }
  return true;
}
