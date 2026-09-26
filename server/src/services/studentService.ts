import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
// @ts-ignore
import QRCode from 'qrcode';
import { Database } from 'sqlite';
import { getDB } from '../db';

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

export interface StudentRecord extends StudentInput {
  id: number;
  college_roll_no: string;
  photo_path?: string | null;
  qr_code?: string | null;
  total_fees_due: number;
  total_fees_paid: number;
  pending_fees: number;
  overall_total_due: number;
  overall_total_paid: number;
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

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

function getUploadsDir() {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
}

function getAcademicYearCode(academicYear: string) {
  const cleaned = academicYear.trim();
  const match = cleaned.match(/^(\d{4})/);
  if (match) return match[1].slice(2);
  return cleaned.slice(0, 2);
}

async function getNextCollegeSequence(
  db: Database<sqlite3.Database, sqlite3.Statement>,
  courseCode: string,
  academicYear: string
) {
  const row = await db.get<{ max_seq: number | null }>(
    `SELECT MAX(CAST(substr(college_roll_no, -3) AS INTEGER)) AS max_seq
     FROM students
     WHERE course_code = ? AND academic_year = ?`,
    courseCode,
    academicYear
  );
  return String((row?.max_seq || 0) + 1).padStart(3, '0');
}

export async function generateCollegeRollNo(courseCode: string, academicYear: string) {
  const db = getDB();
  const yearCode = getAcademicYearCode(academicYear);
  const sequence = await getNextCollegeSequence(db, courseCode, academicYear);
  return `${yearCode}${courseCode}${sequence}`;
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

export async function createStudent(input: StudentInput) {
  const db = getDB();
  const college_roll_no = await generateCollegeRollNo(input.course_code, input.academic_year);
  const total_fees_due = await calculateTotalFees(input.course_code, input.academic_year, input.current_duration_unit);
  const overall_total_due = total_fees_due;
  const total_fees_paid = 0;
  const overall_total_paid = 0;

  let insertResult;
  try {
    insertResult = await db.run(
      `INSERT INTO students (
        name, college_roll_no, university_roll_no, course_code, current_duration_unit,
        academic_year, class, section, phone, address,
        total_fees_due, total_fees_paid, overall_total_due, overall_total_paid
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      input.name,
      college_roll_no,
      input.university_roll_no || null,
      input.course_code,
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
  } catch (error: any) {
    if (error?.code === 'SQLITE_CONSTRAINT' && error?.message?.includes('students.college_roll_no')) {
      const fallbackRoll = await generateCollegeRollNo(input.course_code, input.academic_year);
      insertResult = await db.run(
        `INSERT INTO students (
          name, college_roll_no, university_roll_no, course_code, current_duration_unit,
          academic_year, class, section, phone, address,
          total_fees_due, total_fees_paid, overall_total_due, overall_total_paid
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        input.name,
        fallbackRoll,
        input.university_roll_no || null,
        input.course_code,
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
    } else {
      throw error;
    }
  }

  const studentId = insertResult.lastID;
  if (!studentId) {
    throw new Error('Unable to create student record');
  }

  const qr_code = await generateStudentQrCode(studentId, college_roll_no);
  await db.run(`UPDATE students SET qr_code = ? WHERE id = ?`, qr_code, studentId);

  await syncStudentFees(studentId);

  return getStudentById(studentId);
}

export async function getStudentById(id: number) {
  const db = getDB();
  return db.get<StudentRecord & { course_name?: string }>(
    `SELECT s.*, 
            c.name AS course_name,
            COALESCE(fs.total_fee, s.total_fees_due, 0) AS total_fees_due,
            COALESCE(
              (SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id AND duration_unit = s.current_duration_unit),
              s.total_fees_paid,
              0
            ) AS total_fees_paid,
            MAX(
              0, 
              COALESCE(fs.total_fee, s.total_fees_due, 0) - COALESCE(
                (SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id AND duration_unit = s.current_duration_unit),
                s.total_fees_paid,
                0
              )
            ) AS pending_fees,
            COALESCE(s.overall_total_due, 0) AS overall_total_due,
            COALESCE((SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id), s.overall_total_paid, 0) AS overall_total_paid
      FROM students s
      LEFT JOIN courses c ON s.course_code = c.code
      LEFT JOIN fee_structures fs ON fs.course_code = s.course_code 
                                 AND fs.academic_year = s.academic_year 
                                 AND fs.duration_unit = s.current_duration_unit
      WHERE s.id = ? AND s.deleted_at IS NULL`,
    id
  );
}

export async function getStudentByRollNo(rollNo: string) {
  const db = getDB();
  return db.get<StudentRecord & { course_name?: string }>(
    `SELECT s.*, 
            c.name AS course_name,
            COALESCE(fs.total_fee, s.total_fees_due, 0) AS total_fees_due,
            COALESCE(
              (SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id AND duration_unit = s.current_duration_unit),
              s.total_fees_paid,
              0
            ) AS total_fees_paid,
            MAX(
              0, 
              COALESCE(fs.total_fee, s.total_fees_due, 0) - COALESCE(
                (SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id AND duration_unit = s.current_duration_unit),
                s.total_fees_paid,
                0
              )
            ) AS pending_fees,
            COALESCE(s.overall_total_due, 0) AS overall_total_due,
            COALESCE((SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id), s.overall_total_paid, 0) AS overall_total_paid
      FROM students s
      LEFT JOIN courses c ON s.course_code = c.code
      LEFT JOIN fee_structures fs ON fs.course_code = s.course_code 
                                 AND fs.academic_year = s.academic_year 
                                 AND fs.duration_unit = s.current_duration_unit
      WHERE s.college_roll_no = ? AND s.deleted_at IS NULL`,
    rollNo
  );
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
        s.academic_year,
        s.class,
        s.section,
        s.phone,
        s.address,
        s.photo_path,
        s.qr_code,
        s.overall_total_due,
        s.overall_total_paid,
        s.created_at,
        s.updated_at,
        c.name AS course_name,
        COALESCE(fs.total_fee, s.total_fees_due, 0) AS total_fees_due,
        COALESCE(
          (SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id AND duration_unit = s.current_duration_unit),
          s.total_fees_paid,
          0
        ) AS total_fees_paid,
        MAX(
          0, 
          COALESCE(fs.total_fee, s.total_fees_due, 0) - COALESCE(
            (SELECT SUM(amount) FROM fee_payments WHERE student_id = s.id AND duration_unit = s.current_duration_unit),
            s.total_fees_paid,
            0
          )
        ) AS pending_fees
      FROM students s
      LEFT JOIN courses c ON s.course_code = c.code
      LEFT JOIN fee_structures fs ON fs.course_code = s.course_code 
                                 AND fs.academic_year = s.academic_year 
                                 AND fs.duration_unit = s.current_duration_unit
      WHERE ${conditions.join(' AND ')}
    ) t
  `;

  if (feeStatus === 'pending' || feeStatus === 'left') {
    sql += ` WHERE t.pending_fees > 0`;
  } else if (feeStatus === 'paid' || feeStatus === 'cleared') {
    sql += ` WHERE t.pending_fees <= 0`;
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
    current_duration_unit: number;
    total_fees_due: number;
    total_fees_paid: number;
    overall_total_due: number;
    overall_total_paid: number;
  }>(
    `SELECT id, course_code, academic_year, current_duration_unit, total_fees_due, total_fees_paid, overall_total_due, overall_total_paid
     FROM students WHERE id = ?`,
    studentId
  );
  if (!s) return null;

  // 1. Fee structure for current unit
  let fsCurrent = await db.get<{ total_fee: number }>(
    `SELECT total_fee FROM fee_structures 
     WHERE course_code = ? AND academic_year = ? AND duration_unit = ?`,
    s.course_code, s.academic_year, s.current_duration_unit
  );
  if (!fsCurrent) {
    fsCurrent = await db.get<{ total_fee: number }>(
      `SELECT total_fee FROM fee_structures 
       WHERE course_code = ? AND duration_unit = ? 
       ORDER BY id DESC LIMIT 1`,
      s.course_code, s.current_duration_unit
    );
  }
  const currentUnitDue = fsCurrent ? Number(fsCurrent.total_fee) : Number(s.total_fees_due || 0);

  // 2. Payments for current unit and overall
  const payments = await db.all<{ duration_unit: number; total: number }[]>(
    `SELECT duration_unit, SUM(amount) as total 
     FROM fee_payments 
     WHERE student_id = ? 
     GROUP BY duration_unit`,
    studentId
  );
  const currentUnitPayment = payments.find((p) => Number(p.duration_unit) === Number(s.current_duration_unit));
  const currentUnitPaid = currentUnitPayment ? Number(currentUnitPayment.total) : 0;
  const overallPaid = payments.reduce((sum, p) => sum + Number(p.total), 0);

  // 3. Overall due calculation across all units 1 .. s.current_duration_unit
  let overallDue = 0;
  for (let u = 1; u <= s.current_duration_unit; u++) {
    let fsU = await db.get<{ total_fee: number }>(
      `SELECT total_fee FROM fee_structures 
       WHERE course_code = ? AND academic_year = ? AND duration_unit = ?`,
      s.course_code, s.academic_year, u
    );
    if (!fsU) {
      fsU = await db.get<{ total_fee: number }>(
        `SELECT total_fee FROM fee_structures 
         WHERE course_code = ? AND duration_unit = ? 
         ORDER BY id DESC LIMIT 1`,
        s.course_code, u
      );
    }
    overallDue += fsU ? Number(fsU.total_fee) : 0;
  }
  if (overallDue < currentUnitDue) overallDue = currentUnitDue;

  // 4. Pending fees for the current duration unit
  const pendingFees = Math.max(0, currentUnitDue - currentUnitPaid);

  await db.run(
    `UPDATE students SET
      total_fees_due = ?,
      total_fees_paid = ?,
      pending_fees = ?,
      overall_total_due = ?,
      overall_total_paid = ?,
      updated_at = datetime('now')
    WHERE id = ?`,
    currentUnitDue,
    currentUnitPaid,
    pendingFees,
    overallDue,
    overallPaid,
    studentId
  );

  return {
    currentUnitDue,
    currentUnitPaid,
    pendingFees,
    overallDue,
    overallPaid
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

export async function getAcademicYears() {
  const db = getDB();
  const years = await db.all<{ academic_year: string }[]>(
    `SELECT DISTINCT academic_year FROM students WHERE academic_year IS NOT NULL ORDER BY academic_year DESC`
  );
  return years.map((row) => row.academic_year);
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
  const url = `${FRONTEND_URL}/student/${collegeRollNo}`;
  await QRCode.toFile(filePath, url, { type: 'png', width: 280, margin: 1 });
  return `/uploads/qrcodes/${fileName}`;
}
