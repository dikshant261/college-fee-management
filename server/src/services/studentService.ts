import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
// @ts-ignore
import QRCode from 'qrcode';
import { Database } from 'sqlite';
import { getDB } from '../db';
import { getPrimaryNetworkIp, isStaticClientAvailable } from '../utils/network';
import { getUploadsDir } from '../utils/paths';

export interface StudentInput {
  name: string;
  course_code: string;
  academic_year: string;
  current_duration_unit: number;
  class?: string;
  section?: string;
  phone?: string;
  address?: string;
  university_roll_no?: string;
}

export interface FeeBreakdownItem {
  duration_unit: number;
  academic_year?: string;
  is_current: boolean;
  total_fee: number;
  paid: number;
  pending: number;
}

export interface StudentRecord extends StudentInput {
  id: number;
  college_roll_no: string;
  photo_path?: string | null;
  qr_code?: string | null;
  admission_duration_unit: number;
  total_fees_due: number;
  total_fees_paid: number;
  pending_fees: number;
  previous_fees_due?: number;
  previous_fees_paid?: number;
  previous_pending_fees?: number;
  overall_total_due: number;
  overall_total_paid: number;
  overall_pending_fees?: number;
  fee_breakdown?: FeeBreakdownItem[];
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  course_name?: string;
}

export interface CourseRecord {
  code: string;
  name: string;
  duration_type: 'year' | 'semester';
  total_duration: number;
}

function getFrontendBaseUrl(): string {
  if (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes('localhost') && !process.env.FRONTEND_URL.includes('127.0.0.1')) {
    return process.env.FRONTEND_URL;
  }
  const primaryIp = getPrimaryNetworkIp();
  const staticAvailable = isStaticClientAvailable();
  const clientPort =
    staticAvailable || process.env.NODE_ENV === 'production'
      ? (process.env.PORT || '5000')
      : (process.env.CLIENT_PORT || '5173');
  return `http://${primaryIp}:${clientPort}`;
}


function getAcademicYearCode(academicYear: string) {
  const cleaned = academicYear.trim();
  const match = cleaned.match(/^(\d{4})/);
  if (match) return match[1].slice(2);
  return cleaned.slice(0, 2);
}

export async function generateCollegeRollNo(courseCode: string, academicYear: string): Promise<string> {
  const db = getDB();
  const yearCode = getAcademicYearCode(academicYear);
  const prefix = `${yearCode}${courseCode}`;

  // Find all existing roll numbers with this prefix across the entire table (regardless of academic_year or soft delete)
  const rows = await db.all<Array<{ college_roll_no: string }>>(
    `SELECT college_roll_no FROM students WHERE college_roll_no LIKE ?`,
    `${prefix}%`
  );

  let maxSeq = 0;
  for (const row of rows) {
    const roll = row?.college_roll_no || '';
    if (roll.startsWith(prefix)) {
      const suffix = roll.slice(prefix.length);
      const parsed = parseInt(suffix, 10);
      if (!isNaN(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  }

  // Find the next truly available roll number that doesn't collide with ANY existing record
  let nextSeq = maxSeq + 1;
  let candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;

  while (true) {
    const existing = await db.get<{ id: number }>(
      `SELECT id FROM students WHERE college_roll_no = ?`,
      candidate
    );
    if (!existing) {
      break;
    }
    nextSeq++;
    candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;
  }

  return candidate;
}

export async function calculateTotalFees(
  courseCode: string,
  academicYear: string,
  durationUnit: number
) {
  const db = getDB();
  const row = await db.get<{ total_fee: number | null }>(
    `SELECT total_fee FROM fee_structures
     WHERE course_code = ? AND academic_year = ? AND duration_unit = ?`,
    courseCode,
    academicYear,
    durationUnit
  );
  return row?.total_fee ?? 0;
}

export async function createStudent(input: StudentInput & { admission_duration_unit?: number }) {
  const db = getDB();
  const admissionUnit = Number(input.admission_duration_unit || input.current_duration_unit || 1);
  const total_fees_due = await calculateTotalFees(input.course_code, input.academic_year, input.current_duration_unit);
  const overall_total_due = total_fees_due;
  const total_fees_paid = 0;
  const overall_total_paid = 0;

  let insertResult: any = null;
  let college_roll_no = '';
  let attempts = 0;

  while (attempts < 5) {
    attempts++;
    college_roll_no = await generateCollegeRollNo(input.course_code, input.academic_year);

    try {
      insertResult = await db.run(
        `INSERT INTO students (
          name, college_roll_no, university_roll_no, course_code, admission_duration_unit, current_duration_unit,
          academic_year, class, section, phone, address,
          total_fees_due, total_fees_paid, overall_total_due, overall_total_paid
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        input.name,
        college_roll_no,
        input.university_roll_no || null,
        input.course_code,
        admissionUnit,
        input.current_duration_unit,
        input.academic_year,
        input.class || null,
        input.section || null,
        input.phone || null,
        input.address || null,
        total_fees_due,
        total_fees_paid,
        overall_total_due,
        overall_total_paid
      );
      break;
    } catch (error: any) {
      if (
        error?.code === 'SQLITE_CONSTRAINT' &&
        error?.message?.includes('students.college_roll_no') &&
        attempts < 5
      ) {
        console.warn(`[StudentService] Roll number collision detected (${college_roll_no}), retrying with next sequence (attempt ${attempts})...`);
        continue;
      }
      throw error;
    }
  }

  const studentId = insertResult?.lastID;
  if (!studentId) {
    throw new Error('Unable to create student record');
  }

  const qr_code = await generateStudentQrCode(studentId, college_roll_no);
  await db.run(`UPDATE students SET qr_code = ? WHERE id = ?`, qr_code, studentId);

  await syncStudentFees(studentId);

  return getStudentById(studentId);
}

export async function getStudentFeeBreakdown(
  db: Database<sqlite3.Database, sqlite3.Statement>,
  student: StudentRecord
): Promise<FeeBreakdownItem[]> {
  const admissionUnit = Number(student.admission_duration_unit || 1);
  const currentUnit = Number(student.current_duration_unit || 1);

  const payments = await db.all<Array<{ duration_unit: number; total: number }>>(
    `SELECT duration_unit, SUM(amount) as total 
     FROM fee_payments 
     WHERE student_id = ? 
     GROUP BY duration_unit`,
    student.id
  );
  const paymentMap = new Map<number, number>();
  for (const p of payments) {
    paymentMap.set(Number(p.duration_unit), Number(p.total) || 0);
  }

  const breakdown: FeeBreakdownItem[] = [];

  for (let u = admissionUnit; u <= currentUnit; u++) {
    const isCurrent = (u === currentUnit);
    let unitDue = 0;
    let unitYear = student.academic_year;

    if (isCurrent) {
      unitDue = Number(student.total_fees_due) || 0;
    } else {
      const delta = currentUnit - u;
      const m = student.academic_year.match(/^(\d{4})-(\d{2})/);
      if (m && delta > 0) {
        const startY = parseInt(m[1], 10) - delta;
        const endY = parseInt(m[2], 10) - delta;
        unitYear = `${startY}-${String(endY).padStart(2, '0')}`;
      }

      let fsU = await db.get<{ total_fee: number }>(
        `SELECT total_fee FROM fee_structures 
         WHERE course_code = ? AND academic_year = ? AND duration_unit = ?`,
        student.course_code, unitYear, u
      );
      if (!fsU) {
        fsU = await db.get<{ total_fee: number }>(
          `SELECT total_fee FROM fee_structures 
           WHERE course_code = ? AND academic_year = ? AND duration_unit = ?`,
          student.course_code, student.academic_year, u
        );
      }
      if (!fsU) {
        fsU = await db.get<{ total_fee: number }>(
          `SELECT total_fee FROM fee_structures 
           WHERE course_code = ? AND duration_unit = ? 
           ORDER BY id DESC LIMIT 1`,
          student.course_code, u
        );
      }
      unitDue = fsU ? Number(fsU.total_fee) : 0;
    }

    const unitPaid = paymentMap.get(u) || 0;
    const unitPending = Math.max(0, unitDue - unitPaid);

    breakdown.push({
      duration_unit: u,
      academic_year: unitYear,
      is_current: isCurrent,
      total_fee: unitDue,
      paid: unitPaid,
      pending: unitPending
    });
  }

  return breakdown;
}

export async function getStudentById(id: number) {
  const db = getDB();
  const student = await db.get<StudentRecord & { course_name?: string }>(
    `SELECT s.*, 
            c.name AS course_name,
            COALESCE(s.total_fees_due, 0) AS total_fees_due,
            COALESCE(
              (SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id AND duration_unit = s.current_duration_unit),
              s.total_fees_paid,
              0
            ) AS total_fees_paid,
            MAX(
              0, 
              COALESCE(s.total_fees_due, 0) - COALESCE(
                (SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id AND duration_unit = s.current_duration_unit),
                s.total_fees_paid,
                0
              )
            ) AS pending_fees,
            COALESCE(s.previous_fees_due, 0) AS previous_fees_due,
            COALESCE(
              (SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id AND duration_unit < s.current_duration_unit),
              s.previous_fees_paid,
              0
            ) AS previous_fees_paid,
            MAX(
              0,
              COALESCE(s.previous_fees_due, 0) - COALESCE(
                (SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id AND duration_unit < s.current_duration_unit),
                s.previous_fees_paid,
                0
              )
            ) AS previous_pending_fees,
            COALESCE(s.overall_total_due, 0) AS overall_total_due,
            COALESCE((SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id), s.overall_total_paid, 0) AS overall_total_paid,
            MAX(
              0,
              COALESCE(s.overall_total_due, 0) - COALESCE((SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id), s.overall_total_paid, 0)
            ) AS overall_pending_fees
      FROM students s
      LEFT JOIN courses c ON s.course_code = c.code
      WHERE s.id = ? AND s.deleted_at IS NULL`,
    id
  );

  if (student) {
    student.fee_breakdown = await getStudentFeeBreakdown(db, student);
  }
  return student;
}

export async function getStudentByRollNo(rollNo: string) {
  const db = getDB();
  const student = await db.get<StudentRecord & { course_name?: string }>(
    `SELECT s.*, 
            c.name AS course_name,
            COALESCE(s.total_fees_due, 0) AS total_fees_due,
            COALESCE(
              (SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id AND duration_unit = s.current_duration_unit),
              s.total_fees_paid,
              0
            ) AS total_fees_paid,
            MAX(
              0, 
              COALESCE(s.total_fees_due, 0) - COALESCE(
                (SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id AND duration_unit = s.current_duration_unit),
                s.total_fees_paid,
                0
              )
            ) AS pending_fees,
            COALESCE(s.previous_fees_due, 0) AS previous_fees_due,
            COALESCE(
              (SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id AND duration_unit < s.current_duration_unit),
              s.previous_fees_paid,
              0
            ) AS previous_fees_paid,
            MAX(
              0,
              COALESCE(s.previous_fees_due, 0) - COALESCE(
                (SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id AND duration_unit < s.current_duration_unit),
                s.previous_fees_paid,
                0
              )
            ) AS previous_pending_fees,
            COALESCE(s.overall_total_due, 0) AS overall_total_due,
            COALESCE((SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id), s.overall_total_paid, 0) AS overall_total_paid,
            MAX(
              0,
              COALESCE(s.overall_total_due, 0) - COALESCE((SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id), s.overall_total_paid, 0)
            ) AS overall_pending_fees
      FROM students s
      LEFT JOIN courses c ON s.course_code = c.code
      WHERE s.college_roll_no = ? AND s.deleted_at IS NULL`,
    rollNo
  );

  if (student) {
    student.fee_breakdown = await getStudentFeeBreakdown(db, student);
  }
  return student;
}

export async function getStudents(filters: {
  q?: string;
  course?: string;
  academic_year?: string;
  current_duration_unit?: number;
  fee_status?: string;
}) {
  const db = getDB();
  const conditions = ['s.deleted_at IS NULL'];
  const params: Array<string | number> = [];

  let querySearch = filters.q ? filters.q.trim() : '';
  let feeStatus = filters.fee_status;

  // Smart search parsing if user types terms like "pending", "fee left", "fee pending", "paid", etc.
  const pendingKeywords = ['pending fee', 'fee pending', 'pending fees', 'fees pending', 'fee left', 'fees left', 'pending', 'left', 'unpaid', 'due'];
  const paidKeywords = ['paid fee', 'fee paid', 'paid fees', 'fees paid', 'cleared', 'paid'];

  if (querySearch) {
    const lowerQ = querySearch.toLowerCase();
    if (pendingKeywords.includes(lowerQ)) {
      if (!feeStatus) feeStatus = 'pending';
      querySearch = '';
    } else if (paidKeywords.includes(lowerQ)) {
      if (!feeStatus) feeStatus = 'paid';
      querySearch = '';
    } else {
      for (const kw of pendingKeywords) {
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        if (regex.test(querySearch)) {
          if (!feeStatus) feeStatus = 'pending';
          querySearch = querySearch.replace(regex, '').trim();
          break;
        }
      }
      if (!feeStatus) {
        for (const kw of paidKeywords) {
          const regex = new RegExp(`\\b${kw}\\b`, 'i');
          if (regex.test(querySearch)) {
            feeStatus = 'paid';
            querySearch = querySearch.replace(regex, '').trim();
            break;
          }
        }
      }
    }
  }

  if (querySearch) {
    conditions.push(`(s.name LIKE ? OR s.college_roll_no LIKE ? OR s.university_roll_no LIKE ?)`);
    const search = `%${querySearch}%`;
    params.push(search, search, search);
  }
  if (filters.course) {
    conditions.push('s.course_code = ?');
    params.push(filters.course);
  }
  if (filters.academic_year) {
    conditions.push('s.academic_year = ?');
    params.push(filters.academic_year);
  }
  if (typeof filters.current_duration_unit === 'number') {
    conditions.push('s.current_duration_unit = ?');
    params.push(filters.current_duration_unit);
  }

  let sql = `
    SELECT * FROM (
      SELECT 
        s.id,
        s.name,
        s.college_roll_no,
        s.university_roll_no,
        s.course_code,
        s.current_duration_unit,
        COALESCE(s.admission_duration_unit, 1) as admission_duration_unit,
        s.academic_year,
        s.class,
        s.section,
        s.phone,
        s.address,
        s.photo_path,
        s.qr_code,
        s.created_at,
        s.updated_at,
        c.name AS course_name,
        COALESCE(s.total_fees_due, 0) AS total_fees_due,
        COALESCE(
          (SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id AND duration_unit = s.current_duration_unit),
          s.total_fees_paid,
          0
        ) AS total_fees_paid,
        MAX(
          0, 
          COALESCE(s.total_fees_due, 0) - COALESCE(
            (SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id AND duration_unit = s.current_duration_unit),
            s.total_fees_paid,
            0
          )
        ) AS pending_fees,
        COALESCE(s.previous_fees_due, 0) AS previous_fees_due,
        COALESCE(
          (SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id AND duration_unit < s.current_duration_unit),
          s.previous_fees_paid,
          0
        ) AS previous_fees_paid,
        MAX(
          0,
          COALESCE(s.previous_fees_due, 0) - COALESCE(
            (SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id AND duration_unit < s.current_duration_unit),
            s.previous_fees_paid,
            0
          )
        ) AS previous_pending_fees,
        COALESCE(s.overall_total_due, 0) AS overall_total_due,
        COALESCE((SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id), s.overall_total_paid, 0) AS overall_total_paid,
        MAX(
          0,
          COALESCE(s.overall_total_due, 0) - COALESCE((SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id), s.overall_total_paid, 0)
        ) AS overall_pending_fees
      FROM students s
      LEFT JOIN courses c ON s.course_code = c.code
      WHERE ${conditions.join(' AND ')}
    ) t
  `;

  if (feeStatus === 'pending' || feeStatus === 'left') {
    sql += ` WHERE (t.pending_fees > 0 OR t.overall_pending_fees > 0 OR t.previous_pending_fees > 0)`;
  } else if (feeStatus === 'paid' || feeStatus === 'cleared') {
    sql += ` WHERE (t.overall_pending_fees <= 0 AND t.pending_fees <= 0)`;
  }

  sql += ` ORDER BY t.created_at DESC`;

  return db.all<StudentRecord & { course_name?: string }[]>(sql, ...params);
}

export async function syncStudentFees(studentId: number) {
  const db = getDB();
  const s = await db.get<{
    id: number;
    course_code: string;
    academic_year: string;
    admission_duration_unit: number;
    current_duration_unit: number;
    total_fees_due: number;
    total_fees_paid: number;
    overall_total_due: number;
    overall_total_paid: number;
  }>(
    `SELECT id, course_code, academic_year, COALESCE(admission_duration_unit, 1) as admission_duration_unit, current_duration_unit, total_fees_due, total_fees_paid, overall_total_due, overall_total_paid
     FROM students WHERE id = ?`,
    studentId
  );
  if (!s) return null;

  const admissionUnit = Number(s.admission_duration_unit || 1);
  const currentUnit = Number(s.current_duration_unit || 1);

  // 1. Fee structure for current unit
  let fsCurrent = await db.get<{ total_fee: number }>(
    `SELECT total_fee FROM fee_structures 
     WHERE course_code = ? AND academic_year = ? AND duration_unit = ?`,
    s.course_code, s.academic_year, currentUnit
  );
  if (!fsCurrent) {
    fsCurrent = await db.get<{ total_fee: number }>(
      `SELECT total_fee FROM fee_structures 
       WHERE course_code = ? AND duration_unit = ? 
       ORDER BY id DESC LIMIT 1`,
      s.course_code, currentUnit
    );
  }
  const currentUnitDue = fsCurrent ? Number(fsCurrent.total_fee) : 0;

  // 2. Payments grouped by duration_unit
  const payments = await db.all<Array<{ duration_unit: number; total: number }>>(
    `SELECT duration_unit, SUM(amount) as total 
     FROM fee_payments 
     WHERE student_id = ? 
     GROUP BY duration_unit`,
    studentId
  );
  const paymentMap = new Map<number, number>();
  let overallPaid = 0;
  for (const p of payments) {
    const amt = Number(p.total) || 0;
    paymentMap.set(Number(p.duration_unit), amt);
    overallPaid += amt;
  }

  const currentUnitPaid = paymentMap.get(currentUnit) || 0;
  const currentUnitPending = Math.max(0, currentUnitDue - currentUnitPaid);

  // 3. Overall due calculation across attended units (admissionUnit .. currentUnit)
  let overallDue = 0;
  let previousFeesDue = 0;
  let previousFeesPaid = 0;

  for (let u = admissionUnit; u <= currentUnit; u++) {
    const isCurrent = (u === currentUnit);
    let unitDue = 0;

    if (isCurrent) {
      unitDue = currentUnitDue;
    } else {
      const delta = currentUnit - u;
      let pastYear = s.academic_year;
      const m = s.academic_year.match(/^(\d{4})-(\d{2})/);
      if (m && delta > 0) {
        const startY = parseInt(m[1], 10) - delta;
        const endY = parseInt(m[2], 10) - delta;
        pastYear = `${startY}-${String(endY).padStart(2, '0')}`;
      }

      let fsU = await db.get<{ total_fee: number }>(
        `SELECT total_fee FROM fee_structures 
         WHERE course_code = ? AND academic_year = ? AND duration_unit = ?`,
        s.course_code, pastYear, u
      );
      if (!fsU) {
        fsU = await db.get<{ total_fee: number }>(
          `SELECT total_fee FROM fee_structures 
           WHERE course_code = ? AND academic_year = ? AND duration_unit = ?`,
          s.course_code, s.academic_year, u
        );
      }
      if (!fsU) {
        fsU = await db.get<{ total_fee: number }>(
          `SELECT total_fee FROM fee_structures 
           WHERE course_code = ? AND duration_unit = ? 
           ORDER BY id DESC LIMIT 1`,
          s.course_code, u
        );
      }
      unitDue = fsU ? Number(fsU.total_fee) : 0;
    }

    const unitPaid = paymentMap.get(u) || 0;

    overallDue += unitDue;

    if (!isCurrent) {
      previousFeesDue += unitDue;
      previousFeesPaid += unitPaid;
    }
  }

  if (overallDue < currentUnitDue) overallDue = currentUnitDue;

  const previousPendingFees = Math.max(0, previousFeesDue - previousFeesPaid);
  const overallPendingFees = Math.max(0, overallDue - overallPaid);

  try {
    await db.run(
      `UPDATE students SET
        total_fees_due = ?,
        total_fees_paid = ?,
        pending_fees = ?,
        previous_fees_due = ?,
        previous_fees_paid = ?,
        previous_pending_fees = ?,
        overall_total_due = ?,
        overall_total_paid = ?,
        overall_pending_fees = ?,
        updated_at = datetime('now')
      WHERE id = ?`,
      currentUnitDue,
      currentUnitPaid,
      currentUnitPending,
      previousFeesDue,
      previousFeesPaid,
      previousPendingFees,
      overallDue,
      overallPaid,
      overallPendingFees,
      studentId
    );
  } catch (err: any) {
    if (err?.message?.includes('generated column')) {
      await db.run(
        `UPDATE students SET
          total_fees_due = ?,
          total_fees_paid = ?,
          previous_fees_due = ?,
          previous_fees_paid = ?,
          previous_pending_fees = ?,
          overall_total_due = ?,
          overall_total_paid = ?,
          overall_pending_fees = ?,
          updated_at = datetime('now')
        WHERE id = ?`,
        currentUnitDue,
        currentUnitPaid,
        previousFeesDue,
        previousFeesPaid,
        previousPendingFees,
        overallDue,
        overallPaid,
        overallPendingFees,
        studentId
      );
    } else {
      throw err;
    }
  }

  return {
    currentUnitDue,
    currentUnitPaid,
    pendingFees: currentUnitPending,
    previousFeesDue,
    previousFeesPaid,
    previousPendingFees,
    overallDue,
    overallPaid,
    overallPendingFees
  };
}

export async function syncAllStudentsFees(courseCode?: string) {
  const db = getDB();
  const students = courseCode
    ? await db.all<{ id: number }[]>(`SELECT id FROM students WHERE course_code = ? AND deleted_at IS NULL`, courseCode)
    : await db.all<{ id: number }[]>(`SELECT id FROM students WHERE deleted_at IS NULL`);
  for (const st of students) {
    await syncStudentFees(st.id);
  }
}

export async function updateStudent(id: number, updates: Partial<StudentInput>) {
  const db = getDB();
  const current = await getStudentById(id);
  if (!current) return null;

  const newCourse = updates.course_code ?? current.course_code;
  const newAcademicYear = updates.academic_year ?? current.academic_year;
  const newDurationUnit = updates.current_duration_unit !== undefined ? Number(updates.current_duration_unit) : current.current_duration_unit;

  await db.run(
    `UPDATE students SET
      name = ?,
      university_roll_no = ?,
      course_code = ?,
      current_duration_unit = ?,
      academic_year = ?,
      class = ?,
      section = ?,
      phone = ?,
      address = ?,
      updated_at = datetime('now')
      WHERE id = ?`,
    updates.name ?? current.name,
    updates.university_roll_no ?? current.university_roll_no,
    newCourse,
    newDurationUnit,
    newAcademicYear,
    updates.class ?? current.class,
    updates.section ?? current.section,
    updates.phone ?? current.phone,
    updates.address ?? current.address,
    id
  );

  await syncStudentFees(id);

  return getStudentById(id);
}

export async function softDeleteStudent(id: number) {
  const db = getDB();
  await db.run(`UPDATE students SET deleted_at = datetime('now') WHERE id = ?`, id);
  return true;
}

export async function uploadStudentPhoto(studentId: number, photoPath: string) {
  const db = getDB();
  await db.run(`UPDATE students SET photo_path = ? WHERE id = ?`, photoPath, studentId);
  return getStudentById(studentId);
}

export async function getCourses() {
  const db = getDB();
  return db.all<CourseRecord[]>(`SELECT code, name, duration_type, total_duration FROM courses ORDER BY name`);
}

export async function getAcademicYears(): Promise<string[]> {
  const db = getDB();

  // 1. Get current academic year from system settings
  const settingRow = await db.get<{ value: string }>(
    `SELECT value FROM system_settings WHERE key = 'current_academic_year'`
  );
  const currentAcademicYear = settingRow?.value?.trim() || '2026-27';

  const yearSet = new Set<string>();

  // 2. Generate past 5 sessions, current session, and next 2 upcoming sessions
  // This fully accommodates 4-year (B.Tech) and 5-year curriculum cohorts
  const m = currentAcademicYear.match(/^(\d{4})/);
  if (m) {
    const start = parseInt(m[1], 10);
    for (let y = start - 5; y <= start + 2; y++) {
      const next = String(y + 1).slice(-2);
      yearSet.add(`${y}-${next}`);
    }
  } else {
    yearSet.add(currentAcademicYear);
  }

  // 3. Append all existing distinct academic years from students table
  const studentYears = await db.all<{ academic_year: string }[]>(
    `SELECT DISTINCT academic_year FROM students WHERE academic_year IS NOT NULL AND academic_year != ''`
  );
  for (const row of studentYears) {
    if (row.academic_year?.trim()) {
      yearSet.add(row.academic_year.trim());
    }
  }

  // 4. Append all existing distinct academic years from fee_structures table
  const feeYears = await db.all<{ academic_year: string }[]>(
    `SELECT DISTINCT academic_year FROM fee_structures WHERE academic_year IS NOT NULL AND academic_year != ''`
  );
  for (const row of feeYears) {
    if (row.academic_year?.trim()) {
      yearSet.add(row.academic_year.trim());
    }
  }

  // 5. Sort descending (newest session first)
  const sorted = Array.from(yearSet).sort((a, b) => {
    const matchA = a.match(/^(\d{4})/);
    const matchB = b.match(/^(\d{4})/);
    if (matchA && matchB) {
      return parseInt(matchB[1], 10) - parseInt(matchA[1], 10);
    }
    return b.localeCompare(a);
  });

  return sorted;
}

export async function getSystemSettings() {
  const db = getDB();
  const rows = await db.all<{ key: string; value: string }[]>(
    `SELECT key, value FROM system_settings`
  );
  return rows.reduce<Record<string, string>>((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

async function generateStudentQrCode(studentId: number, collegeRollNo: string) {
  const uploadsDir = getUploadsDir();
  const qrcodeDir = path.join(uploadsDir, 'qrcodes');
  if (!fs.existsSync(qrcodeDir)) fs.mkdirSync(qrcodeDir, { recursive: true });

  const fileName = `${collegeRollNo}-${studentId}.png`;
  const filePath = path.join(qrcodeDir, fileName);
  const frontendBase = getFrontendBaseUrl();
  const url = `${frontendBase}/student/${collegeRollNo}`;
  await QRCode.toFile(filePath, url, { type: 'png', width: 280, margin: 1 });
  return `/uploads/qrcodes/${fileName}`;
}
