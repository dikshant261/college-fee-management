import fs from 'fs';
import path from 'path';
import { getDB } from '../db';
import { getUploadsDir } from '../utils/paths';

export interface ExpenseCategory {
  id: number;
  name: string;
  description?: string | null;
  is_default: number;
  is_active: number;
  created_at: string;
}

export interface ExpenseRecord {
  id: number;
  expense_date: string;
  category_id?: number | null;
  category_name: string;
  amount: number;
  paid_to: string;
  vendor?: string | null;
  payment_method?: 'cash' | 'upi' | 'bank_transfer' | 'card' | 'cheque' | 'other' | null;
  status: 'paid' | 'pending';
  invoice_no?: string | null;
  reference_no?: string | null;
  description?: string | null;
  notes?: string | null;
  attachment_path?: string | null;
  academic_year: string;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffEmployee {
  id: number;
  emp_code: string;
  name: string;
  department: string;
  designation: string;
  phone?: string | null;
  email?: string | null;
  basic_salary: number;
  bank_name?: string | null;
  account_no?: string | null;
  ifsc_code?: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface PayrollRecord {
  id: number;
  employee_id: number;
  emp_code?: string;
  employee_name?: string;
  department?: string;
  designation?: string;
  bank_name?: string | null;
  account_no?: string | null;
  ifsc_code?: string | null;
  academic_year: string;
  month: string;
  year: number;
  basic_salary: number;
  allowances: number;
  deductions: number;
  net_salary: number;
  status: 'pending' | 'paid';
  payment_method?: string | null;
  payment_date?: string | null;
  reference_no?: string | null;
  notes?: string | null;
  paid_by?: number | null;
  created_at: string;
  updated_at: string;
}

export interface MoneyOutTransaction {
  id: number;
  transaction_date: string;
  type: 'EXPENSE' | 'SALARY' | 'OTHER';
  source: 'EXPENSE_MODULE' | 'PAYROLL_MODULE';
  source_id: number;
  category: string;
  amount: number;
  paid_to: string;
  payment_method: string;
  reference_no?: string | null;
  description?: string | null;
  status: string;
  academic_year: string;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// CATEGORIES
// ---------------------------------------------------------------------------

export async function getExpenseCategories(onlyActive = false) {
  const db = getDB();
  const query = onlyActive
    ? `SELECT * FROM expense_categories WHERE is_active = 1 ORDER BY name ASC`
    : `SELECT * FROM expense_categories ORDER BY name ASC`;
  return db.all<ExpenseCategory[]>(query);
}

export async function createExpenseCategory(name: string, description?: string) {
  const db = getDB();
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Category name cannot be empty');
  const res = await db.run(
    `INSERT INTO expense_categories (name, description, is_default, is_active) VALUES (?, ?, 0, 1)`,
    cleanName,
    description?.trim() || null
  );
  return db.get<ExpenseCategory>(`SELECT * FROM expense_categories WHERE id = ?`, res.lastID);
}

export async function toggleExpenseCategory(id: number, isActive: boolean) {
  const db = getDB();
  await db.run(`UPDATE expense_categories SET is_active = ? WHERE id = ?`, isActive ? 1 : 0, id);
  return db.get<ExpenseCategory>(`SELECT * FROM expense_categories WHERE id = ?`, id);
}

// ---------------------------------------------------------------------------
// EXPENSES
// ---------------------------------------------------------------------------

export async function getExpenses(filters?: {
  search?: string;
  category?: string;
  status?: string;
  payment_method?: string;
  academic_year?: string;
  start_date?: string;
  end_date?: string;
}) {
  const db = getDB();
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters?.search && filters.search.trim()) {
    const q = `%${filters.search.trim()}%`;
    conditions.push('(e.paid_to LIKE ? OR e.description LIKE ? OR e.vendor LIKE ? OR e.invoice_no LIKE ? OR e.reference_no LIKE ?)');
    params.push(q, q, q, q, q);
  }

  if (filters?.category && filters.category.trim()) {
    conditions.push('e.category_name = ?');
    params.push(filters.category.trim());
  }

  if (filters?.status && filters.status.trim()) {
    conditions.push('e.status = ?');
    params.push(filters.status.trim());
  }

  if (filters?.payment_method && filters.payment_method.trim()) {
    conditions.push('e.payment_method = ?');
    params.push(filters.payment_method.trim());
  }

  if (filters?.academic_year && filters.academic_year.trim()) {
    conditions.push('e.academic_year = ?');
    params.push(filters.academic_year.trim());
  }

  if (filters?.start_date && filters.start_date.trim()) {
    conditions.push('e.expense_date >= ?');
    params.push(filters.start_date.trim());
  }

  if (filters?.end_date && filters.end_date.trim()) {
    conditions.push('e.expense_date <= ?');
    params.push(filters.end_date.trim());
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return db.all<ExpenseRecord[]>(
    `SELECT e.*, u.name as created_by_name
     FROM expenses e
     LEFT JOIN users u ON e.created_by = u.id
     ${where}
     ORDER BY e.expense_date DESC, e.id DESC`,
    ...params
  );
}

export async function getExpenseById(id: number) {
  const db = getDB();
  return db.get<ExpenseRecord>(
    `SELECT e.*, u.name as created_by_name
     FROM expenses e
     LEFT JOIN users u ON e.created_by = u.id
     WHERE e.id = ?`,
    id
  );
}

export async function createExpense(
  input: {
    expense_date: string;
    category_id?: number;
    category_name: string;
    amount: number;
    paid_to: string;
    vendor?: string;
    payment_method?: string;
    status: 'paid' | 'pending';
    invoice_no?: string;
    reference_no?: string;
    description?: string;
    notes?: string;
    attachment_path?: string;
    academic_year: string;
  },
  userId?: number
) {
  const db = getDB();

  if (!input.amount || input.amount <= 0) {
    throw new Error('Expense amount must be greater than zero');
  }
  if (!input.expense_date) throw new Error('Expense date is required');
  if (!input.category_name) throw new Error('Expense category is required');
  if (!input.paid_to) throw new Error('Paid To is required');
  if (input.status === 'paid' && !input.payment_method) {
    throw new Error('Payment method is required when status is Paid');
  }

  const res = await db.run(
    `INSERT INTO expenses (
      expense_date, category_id, category_name, amount, paid_to, vendor,
      payment_method, status, invoice_no, reference_no, description, notes,
      attachment_path, academic_year, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.expense_date,
    input.category_id || null,
    input.category_name.trim(),
    input.amount,
    input.paid_to.trim(),
    input.vendor?.trim() || null,
    input.payment_method || null,
    input.status,
    input.invoice_no?.trim() || null,
    input.reference_no?.trim() || null,
    input.description?.trim() || null,
    input.notes?.trim() || null,
    input.attachment_path || null,
    input.academic_year.trim(),
    userId || null
  );

  const newExpenseId = res.lastID;

  // Sync with Outgoing Financial Transaction layer if marked Paid
  if (input.status === 'paid') {
    await db.run(
      `INSERT INTO money_out_transactions (
        transaction_date, type, source, source_id, category, amount, paid_to,
        payment_method, reference_no, description, status, academic_year, created_by
      ) VALUES (?, 'EXPENSE', 'EXPENSE_MODULE', ?, ?, ?, ?, ?, ?, ?, 'PAID', ?, ?)`,
      input.expense_date,
      newExpenseId,
      input.category_name.trim(),
      input.amount,
      input.paid_to.trim(),
      input.payment_method || 'other',
      input.reference_no?.trim() || null,
      input.description?.trim() || `Expense payment to ${input.paid_to.trim()}`,
      input.academic_year.trim(),
      userId || null
    );
  }

  return getExpenseById(Number(newExpenseId));
}

export async function updateExpense(
  id: number,
  input: {
    expense_date: string;
    category_id?: number;
    category_name: string;
    amount: number;
    paid_to: string;
    vendor?: string;
    payment_method?: string;
    status: 'paid' | 'pending';
    invoice_no?: string;
    reference_no?: string;
    description?: string;
    notes?: string;
    attachment_path?: string;
    academic_year: string;
  },
  userId?: number
) {
  const db = getDB();
  const existing = await getExpenseById(id);
  if (!existing) throw new Error('Expense not found');

  if (!input.amount || input.amount <= 0) {
    throw new Error('Expense amount must be greater than zero');
  }
  if (!input.expense_date) throw new Error('Expense date is required');
  if (!input.category_name) throw new Error('Expense category is required');
  if (!input.paid_to) throw new Error('Paid To is required');
  if (input.status === 'paid' && !input.payment_method) {
    throw new Error('Payment method is required when status is Paid');
  }

  const finalAttachment = input.attachment_path !== undefined ? input.attachment_path : existing.attachment_path;

  await db.run(
    `UPDATE expenses SET
      expense_date = ?, category_id = ?, category_name = ?, amount = ?,
      paid_to = ?, vendor = ?, payment_method = ?, status = ?,
      invoice_no = ?, reference_no = ?, description = ?, notes = ?,
      attachment_path = ?, academic_year = ?
    WHERE id = ?`,
    input.expense_date,
    input.category_id || null,
    input.category_name.trim(),
    input.amount,
    input.paid_to.trim(),
    input.vendor?.trim() || null,
    input.payment_method || null,
    input.status,
    input.invoice_no?.trim() || null,
    input.reference_no?.trim() || null,
    input.description?.trim() || null,
    input.notes?.trim() || null,
    finalAttachment,
    input.academic_year.trim(),
    id
  );

  // Sync Outgoing Transaction Layer
  if (input.status === 'paid') {
    const existingTx = await db.get(
      `SELECT id FROM money_out_transactions WHERE source = 'EXPENSE_MODULE' AND source_id = ?`,
      id
    );

    if (existingTx) {
      await db.run(
        `UPDATE money_out_transactions SET
          transaction_date = ?, category = ?, amount = ?, paid_to = ?,
          payment_method = ?, reference_no = ?, description = ?,
          academic_year = ?
        WHERE id = ?`,
        input.expense_date,
        input.category_name.trim(),
        input.amount,
        input.paid_to.trim(),
        input.payment_method || 'other',
        input.reference_no?.trim() || null,
        input.description?.trim() || `Expense payment to ${input.paid_to.trim()}`,
        input.academic_year.trim(),
        existingTx.id
      );
    } else {
      await db.run(
        `INSERT INTO money_out_transactions (
          transaction_date, type, source, source_id, category, amount, paid_to,
          payment_method, reference_no, description, status, academic_year, created_by
        ) VALUES (?, 'EXPENSE', 'EXPENSE_MODULE', ?, ?, ?, ?, ?, ?, ?, 'PAID', ?, ?)`,
        input.expense_date,
        id,
        input.category_name.trim(),
        input.amount,
        input.paid_to.trim(),
        input.payment_method || 'other',
        input.reference_no?.trim() || null,
        input.description?.trim() || `Expense payment to ${input.paid_to.trim()}`,
        input.academic_year.trim(),
        userId || null
      );
    }
  } else {
    // If marked Pending, remove any transaction if it previously existed
    await db.run(`DELETE FROM money_out_transactions WHERE source = 'EXPENSE_MODULE' AND source_id = ?`, id);
  }

  return getExpenseById(id);
}

export async function deleteExpense(id: number) {
  const db = getDB();
  const existing = await getExpenseById(id);
  if (!existing) return true;

  // Remove from expenses
  await db.run(`DELETE FROM expenses WHERE id = ?`, id);

  // Remove associated outgoing transaction
  await db.run(`DELETE FROM money_out_transactions WHERE source = 'EXPENSE_MODULE' AND source_id = ?`, id);

  // Optionally remove attachment file
  if (existing.attachment_path) {
    try {
      const cleanPath = existing.attachment_path.replace(/^\/uploads\//, '');
      const fullPath = path.join(getUploadsDir(), cleanPath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (err) {
      // ignore deletion error
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// STAFF EMPLOYEES
// ---------------------------------------------------------------------------

export async function getStaffEmployees(onlyActive = true) {
  const db = getDB();
  const query = onlyActive
    ? `SELECT * FROM staff_employees WHERE is_active = 1 ORDER BY name ASC`
    : `SELECT * FROM staff_employees ORDER BY name ASC`;
  return db.all<StaffEmployee[]>(query);
}

export async function getStaffEmployeeById(id: number) {
  const db = getDB();
  return db.get<StaffEmployee>(`SELECT * FROM staff_employees WHERE id = ?`, id);
}

export async function createStaffEmployee(input: {
  emp_code: string;
  name: string;
  department: string;
  designation: string;
  phone?: string;
  email?: string;
  basic_salary: number;
  bank_name?: string;
  account_no?: string;
  ifsc_code?: string;
}) {
  const db = getDB();
  if (!input.name?.trim()) throw new Error('Employee name is required');
  if (!input.emp_code?.trim()) throw new Error('Employee code is required');
  if (input.basic_salary < 0) throw new Error('Basic salary cannot be negative');

  const res = await db.run(
    `INSERT INTO staff_employees (
      emp_code, name, department, designation, phone, email,
      basic_salary, bank_name, account_no, ifsc_code
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.emp_code.trim().toUpperCase(),
    input.name.trim(),
    input.department.trim(),
    input.designation.trim(),
    input.phone?.trim() || null,
    input.email?.trim() || null,
    input.basic_salary || 0,
    input.bank_name?.trim() || null,
    input.account_no?.trim() || null,
    input.ifsc_code?.trim() || null
  );

  return getStaffEmployeeById(Number(res.lastID));
}

export async function updateStaffEmployee(
  id: number,
  input: {
    emp_code: string;
    name: string;
    department: string;
    designation: string;
    phone?: string;
    email?: string;
    basic_salary: number;
    bank_name?: string;
    account_no?: string;
    ifsc_code?: string;
    is_active?: boolean;
  }
) {
  const db = getDB();
  await db.run(
    `UPDATE staff_employees SET
      emp_code = ?, name = ?, department = ?, designation = ?,
      phone = ?, email = ?, basic_salary = ?, bank_name = ?,
      account_no = ?, ifsc_code = ?, is_active = COALESCE(?, is_active)
    WHERE id = ?`,
    input.emp_code.trim().toUpperCase(),
    input.name.trim(),
    input.department.trim(),
    input.designation.trim(),
    input.phone?.trim() || null,
    input.email?.trim() || null,
    input.basic_salary || 0,
    input.bank_name?.trim() || null,
    input.account_no?.trim() || null,
    input.ifsc_code?.trim() || null,
    input.is_active !== undefined ? (input.is_active ? 1 : 0) : null,
    id
  );

  return getStaffEmployeeById(id);
}

export async function deleteStaffEmployee(id: number) {
  const db = getDB();
  await db.run(`DELETE FROM staff_employees WHERE id = ?`, id);
  return true;
}

// ---------------------------------------------------------------------------
// MONTHLY PAYROLL
// ---------------------------------------------------------------------------

export async function getPayrollRecords(academicYear: string, month: string, year: number) {
  const db = getDB();
  return db.all<PayrollRecord[]>(
    `SELECT p.*, s.emp_code, s.name as employee_name, s.department, s.designation,
            s.bank_name, s.account_no, s.ifsc_code
     FROM payroll_records p
     JOIN staff_employees s ON p.employee_id = s.id
     WHERE p.academic_year = ? AND p.month = ? AND p.year = ?
     ORDER BY s.name ASC`,
    academicYear,
    month,
    year
  );
}

export async function generateOrGetPayroll(academicYear: string, month: string, year: number) {
  const db = getDB();
  // Get all active employees
  const employees = await getStaffEmployees(true);

  for (const emp of employees) {
    const existing = await db.get(
      `SELECT id FROM payroll_records WHERE employee_id = ? AND academic_year = ? AND month = ? AND year = ?`,
      emp.id,
      academicYear,
      month,
      year
    );

    if (!existing) {
      await db.run(
        `INSERT INTO payroll_records (
          employee_id, academic_year, month, year, basic_salary,
          allowances, deductions, net_salary, status
        ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, 'pending')`,
        emp.id,
        academicYear,
        month,
        year,
        emp.basic_salary,
        emp.basic_salary
      );
    }
  }

  return getPayrollRecords(academicYear, month, year);
}

export async function updatePayrollRecord(
  id: number,
  input: {
    basic_salary: number;
    allowances: number;
    deductions: number;
    notes?: string;
  }
) {
  const db = getDB();
  const netSalary = Math.max(0, Number(input.basic_salary) + Number(input.allowances) - Number(input.deductions));

  await db.run(
    `UPDATE payroll_records SET
      basic_salary = ?, allowances = ?, deductions = ?, net_salary = ?, notes = ?
    WHERE id = ?`,
    input.basic_salary,
    input.allowances,
    input.deductions,
    netSalary,
    input.notes?.trim() || null,
    id
  );

  return db.get<PayrollRecord>(`SELECT * FROM payroll_records WHERE id = ?`, id);
}

export async function markPayrollPaid(
  id: number,
  input: {
    payment_method: string;
    payment_date: string;
    reference_no?: string;
    notes?: string;
  },
  userId?: number
) {
  const db = getDB();
  const payroll = await db.get<PayrollRecord>(
    `SELECT p.*, s.name as employee_name, s.emp_code
     FROM payroll_records p
     JOIN staff_employees s ON p.employee_id = s.id
     WHERE p.id = ?`,
    id
  );
  if (!payroll) throw new Error('Payroll record not found');

  if (!input.payment_method) throw new Error('Payment method is required');
  if (!input.payment_date) throw new Error('Payment date is required');

  await db.run(
    `UPDATE payroll_records SET
      status = 'paid', payment_method = ?, payment_date = ?,
      reference_no = ?, notes = COALESCE(?, notes), paid_by = ?
    WHERE id = ?`,
    input.payment_method,
    input.payment_date,
    input.reference_no?.trim() || null,
    input.notes?.trim() || null,
    userId || null,
    id
  );

  // Sync to Money Out Transaction Layer
  const existingTx = await db.get(
    `SELECT id FROM money_out_transactions WHERE source = 'PAYROLL_MODULE' AND source_id = ?`,
    id
  );

  const description = `Salary: ${payroll.employee_name} (${payroll.emp_code}) for ${payroll.month} ${payroll.year}`;

  if (existingTx) {
    await db.run(
      `UPDATE money_out_transactions SET
        transaction_date = ?, category = 'Staff Salary', amount = ?, paid_to = ?,
        payment_method = ?, reference_no = ?, description = ?, academic_year = ?
      WHERE id = ?`,
      input.payment_date,
      payroll.net_salary,
      payroll.employee_name || 'Staff Member',
      input.payment_method,
      input.reference_no?.trim() || null,
      description,
      payroll.academic_year,
      existingTx.id
    );
  } else {
    await db.run(
      `INSERT INTO money_out_transactions (
        transaction_date, type, source, source_id, category, amount, paid_to,
        payment_method, reference_no, description, status, academic_year, created_by
      ) VALUES (?, 'SALARY', 'PAYROLL_MODULE', ?, 'Staff Salary', ?, ?, ?, ?, ?, 'PAID', ?, ?)`,
      input.payment_date,
      id,
      payroll.net_salary,
      payroll.employee_name || 'Staff Member',
      input.payment_method,
      input.reference_no?.trim() || null,
      description,
      payroll.academic_year,
      userId || null
    );
  }

  return db.get<PayrollRecord>(`SELECT * FROM payroll_records WHERE id = ?`, id);
}

// ---------------------------------------------------------------------------
// MONEY OUT TRANSACTIONS
// ---------------------------------------------------------------------------

export async function getMoneyOutTransactions(filters?: {
  type?: string;
  source?: string;
  category?: string;
  payment_method?: string;
  academic_year?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
}) {
  const db = getDB();
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters?.type && filters.type.trim()) {
    conditions.push('t.type = ?');
    params.push(filters.type.trim().toUpperCase());
  }

  if (filters?.source && filters.source.trim()) {
    conditions.push('t.source = ?');
    params.push(filters.source.trim());
  }

  if (filters?.category && filters.category.trim()) {
    conditions.push('t.category = ?');
    params.push(filters.category.trim());
  }

  if (filters?.payment_method && filters.payment_method.trim()) {
    conditions.push('t.payment_method = ?');
    params.push(filters.payment_method.trim());
  }

  if (filters?.academic_year && filters.academic_year.trim()) {
    conditions.push('t.academic_year = ?');
    params.push(filters.academic_year.trim());
  }

  if (filters?.search && filters.search.trim()) {
    const q = `%${filters.search.trim()}%`;
    conditions.push('(t.paid_to LIKE ? OR t.description LIKE ? OR t.reference_no LIKE ?)');
    params.push(q, q, q);
  }

  if (filters?.start_date && filters.start_date.trim()) {
    conditions.push('t.transaction_date >= ?');
    params.push(filters.start_date.trim());
  }

  if (filters?.end_date && filters.end_date.trim()) {
    conditions.push('t.transaction_date <= ?');
    params.push(filters.end_date.trim());
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const transactions = await db.all<MoneyOutTransaction[]>(
    `SELECT t.*, u.name as created_by_name
     FROM money_out_transactions t
     LEFT JOIN users u ON t.created_by = u.id
     ${where}
     ORDER BY t.transaction_date DESC, t.id DESC`,
    ...params
  );

  const totalAmount = transactions.reduce((acc, t) => acc + (t.amount || 0), 0);

  return {
    transactions,
    summary: {
      totalAmount,
      count: transactions.length
    }
  };
}

// ---------------------------------------------------------------------------
// FINANCE & EXECUTIVE OVERVIEW (Option B: Money In + Out + Session/Course Breakdowns)
// ---------------------------------------------------------------------------

export async function getFinanceOverview(filters?: {
  academic_year?: string;
  month?: string;
  course_code?: string;
}) {
  const db = getDB();
  const selectedAy = filters?.academic_year?.trim();

  // 1. MONEY IN (Student Fees) - OPTION B
  const feeTotalsRow = await db.get<{
    grand_total_due: number;
    grand_total_paid: number;
    grand_total_pending: number;
    total_students: number;
  }>(`
    SELECT
      COALESCE(SUM(overall_total_due), 0) as grand_total_due,
      COALESCE(SUM(overall_total_paid), 0) as grand_total_paid,
      COALESCE(SUM(overall_pending_fees), 0) as grand_total_pending,
      COUNT(*) as total_students
    FROM students
    WHERE deleted_at IS NULL
  `);

  // Session-wise fee breakdown
  const sessionBreakdown = await db.all<
    Array<{
      academic_year: string;
      student_count: number;
      total_due: number;
      total_paid: number;
      total_pending: number;
    }>
  >(`
    SELECT
      academic_year,
      COUNT(*) as student_count,
      COALESCE(SUM(overall_total_due), 0) as total_due,
      COALESCE(SUM(overall_total_paid), 0) as total_paid,
      COALESCE(SUM(overall_pending_fees), 0) as total_pending
    FROM students
    WHERE deleted_at IS NULL
    GROUP BY academic_year
    ORDER BY academic_year DESC
  `);

  // Course-wise fee breakdown (optionally filtered by selected session)
  const courseConditions: string[] = ['s.deleted_at IS NULL'];
  const courseParams: any[] = [];
  if (selectedAy) {
    courseConditions.push('s.academic_year = ?');
    courseParams.push(selectedAy);
  }

  const courseBreakdown = await db.all<
    Array<{
      course_code: string;
      course_name: string;
      student_count: number;
      total_due: number;
      total_paid: number;
      total_pending: number;
    }>
  >(
    `
    SELECT
      s.course_code,
      COALESCE(c.name, s.course_code) as course_name,
      COUNT(*) as student_count,
      COALESCE(SUM(s.overall_total_due), 0) as total_due,
      COALESCE(SUM(s.overall_total_paid), 0) as total_paid,
      COALESCE(SUM(s.overall_pending_fees), 0) as total_pending
    FROM students s
    LEFT JOIN courses c ON s.course_code = c.code
    WHERE ${courseConditions.join(' AND ')}
    GROUP BY s.course_code
    ORDER BY s.course_code ASC
  `,
    ...courseParams
  );

  // 2. MONEY OUT (Institutional Outflow)
  const outAyCondition = selectedAy ? 'AND academic_year = ?' : '';
  const outAyParams = selectedAy ? [selectedAy] : [];

  // Total Outflow (Paid money in selected period)
  const totalOutflowRow = await db.get<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM money_out_transactions WHERE status = 'PAID' ${outAyCondition}`,
    ...outAyParams
  );

  // This Month Outflow (Paid transactions in current calendar month)
  const thisMonthRow = await db.get<{ total: number }>(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM money_out_transactions
    WHERE status = 'PAID' AND strftime('%Y-%m', transaction_date) = strftime('%Y-%m', 'now')
  `);

  // Total Salary Paid
  const totalSalaryRow = await db.get<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM money_out_transactions WHERE status = 'PAID' AND type = 'SALARY' ${outAyCondition}`,
    ...outAyParams
  );

  // Other Expenses Paid
  const otherExpensesRow = await db.get<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM money_out_transactions WHERE status = 'PAID' AND type = 'EXPENSE' ${outAyCondition}`,
    ...outAyParams
  );

  // Pending Payments (Expenses recorded as pending + pending payroll)
  const pendingExpensesRow = await db.get<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE status = 'pending' ${selectedAy ? 'AND academic_year = ?' : ''}`,
    ...outAyParams
  );

  const pendingPayrollRow = await db.get<{ total: number }>(
    `SELECT COALESCE(SUM(net_salary), 0) as total FROM payroll_records WHERE status = 'pending' ${selectedAy ? 'AND academic_year = ?' : ''}`,
    ...outAyParams
  );

  // Transaction Count
  const txCountRow = await db.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM money_out_transactions WHERE 1=1 ${outAyCondition}`,
    ...outAyParams
  );

  // Expense by Category Breakdown
  const categoryBreakdown = await db.all<Array<{ category: string; amount: number; count: number }>>(
    `SELECT category, SUM(amount) as amount, COUNT(*) as count
     FROM money_out_transactions
     WHERE status = 'PAID' ${outAyCondition}
     GROUP BY category
     ORDER BY amount DESC`,
    ...outAyParams
  );

  // Payment Method Breakdown
  const methodBreakdown = await db.all<Array<{ payment_method: string; amount: number; count: number }>>(
    `SELECT payment_method, SUM(amount) as amount, COUNT(*) as count
     FROM money_out_transactions
     WHERE status = 'PAID' ${outAyCondition}
     GROUP BY payment_method
     ORDER BY amount DESC`,
    ...outAyParams
  );

  // Monthly Outflow Trend (past 6 months)
  const monthlyTrend = await db.all<
    Array<{
      month_key: string;
      total: number;
      salary: number;
      expenses: number;
    }>
  >(`
    SELECT
      strftime('%Y-%m', transaction_date) as month_key,
      SUM(amount) as total,
      SUM(CASE WHEN type = 'SALARY' THEN amount ELSE 0 END) as salary,
      SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) as expenses
    FROM money_out_transactions
    WHERE status = 'PAID'
    GROUP BY strftime('%Y-%m', transaction_date)
    ORDER BY month_key DESC
    LIMIT 6
  `);

  const grandDue = feeTotalsRow?.grand_total_due || 0;
  const grandPaid = feeTotalsRow?.grand_total_paid || 0;
  const grandPending = feeTotalsRow?.grand_total_pending || 0;
  const totalOutflow = totalOutflowRow?.total || 0;
  const netOperatingBalance = grandPaid - totalOutflow;

  return {
    inflow: {
      grand_total_due: grandDue,
      grand_total_paid: grandPaid,
      grand_total_pending: grandPending,
      total_students: feeTotalsRow?.total_students || 0,
      recovery_percentage: grandDue > 0 ? Math.round((grandPaid / grandDue) * 1000) / 10 : 0,
      session_wise: sessionBreakdown.map((s) => ({
        ...s,
        recovery_percentage: s.total_due > 0 ? Math.round((s.total_paid / s.total_due) * 1000) / 10 : 0
      })),
      course_wise: courseBreakdown.map((c) => ({
        ...c,
        recovery_percentage: c.total_due > 0 ? Math.round((c.total_paid / c.total_due) * 1000) / 10 : 0
      }))
    },
    outflow: {
      total_outflow: totalOutflow,
      this_month_outflow: thisMonthRow?.total || 0,
      total_salary: totalSalaryRow?.total || 0,
      other_expenses: otherExpensesRow?.total || 0,
      pending_payments: (pendingExpensesRow?.total || 0) + (pendingPayrollRow?.total || 0),
      transaction_count: txCountRow?.count || 0,
      category_breakdown: categoryBreakdown,
      payment_method_breakdown: methodBreakdown,
      monthly_trend: monthlyTrend.reverse()
    },
    net: {
      inflow: grandPaid,
      outflow: totalOutflow,
      balance: netOperatingBalance,
      is_surplus: netOperatingBalance >= 0
    }
  };
}
