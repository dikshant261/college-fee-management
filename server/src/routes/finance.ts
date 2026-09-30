import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthRequest, requireAdmin } from '../middleware/auth';
import { getUploadsDir } from '../utils/paths';
import {
  getExpenseCategories,
  createExpenseCategory,
  toggleExpenseCategory,
  getExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  getStaffEmployees,
  getStaffEmployeeById,
  createStaffEmployee,
  updateStaffEmployee,
  deleteStaffEmployee,
  getPayrollRecords,
  generateOrGetPayroll,
  updatePayrollRecord,
  markPayrollPaid,
  getMoneyOutTransactions,
  getFinanceOverview
} from '../services/financeService';

const router = Router();

// Setup Multer for expense bills/attachments
const uploadsDir = getUploadsDir();
const expensesDir = path.join(uploadsDir, 'expenses');
if (!fs.existsSync(expensesDir)) fs.mkdirSync(expensesDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, expensesDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, `bill-${unique}`);
  }
});

function fileFilter(_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const allowed = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  if (allowed.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only images, PDFs, Word, or Excel documents are allowed as bill attachments'));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// ===========================================================================
// 1. OVERVIEW & ANALYTICS (Option B)
// ===========================================================================

router.get('/overview', async (req, res) => {
  try {
    const overview = await getFinanceOverview({
      academic_year: req.query.academic_year as string,
      month: req.query.month as string,
      course_code: req.query.course_code as string
    });
    res.json(overview);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to fetch financial overview' });
  }
});

// ===========================================================================
// 2. EXPENSE CATEGORIES
// ===========================================================================

router.get('/categories', async (req, res) => {
  try {
    const onlyActive = req.query.all !== 'true';
    const categories = await getExpenseCategories(onlyActive);
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load expense categories' });
  }
});

router.post('/categories', requireAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const cat = await createExpenseCategory(name, description);
    res.status(201).json(cat);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to create category' });
  }
});

router.patch('/categories/:id/toggle', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { is_active } = req.body;
    const cat = await toggleExpenseCategory(id, Boolean(is_active));
    res.json(cat);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to update category status' });
  }
});

// ===========================================================================
// 3. EXPENSES CRUD
// ===========================================================================

router.get('/expenses', async (req, res) => {
  try {
    const expenses = await getExpenses({
      search: req.query.search as string,
      category: req.query.category as string,
      status: req.query.status as string,
      payment_method: req.query.payment_method as string,
      academic_year: req.query.academic_year as string,
      start_date: req.query.start_date as string,
      end_date: req.query.end_date as string
    });
    res.json(expenses);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load expenses' });
  }
});

router.get('/expenses/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const expense = await getExpenseById(id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json(expense);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to fetch expense' });
  }
});

router.post('/expenses', upload.single('attachment'), async (req: AuthRequest, res) => {
  try {
    const {
      expense_date,
      category_id,
      category_name,
      amount,
      paid_to,
      vendor,
      payment_method,
      status,
      invoice_no,
      reference_no,
      description,
      notes,
      academic_year
    } = req.body;

    const attachment_path = req.file ? `/uploads/expenses/${req.file.filename}` : undefined;

    const expense = await createExpense(
      {
        expense_date,
        category_id: category_id ? Number(category_id) : undefined,
        category_name,
        amount: Number(amount),
        paid_to,
        vendor,
        payment_method,
        status: status || 'paid',
        invoice_no,
        reference_no,
        description,
        notes,
        attachment_path,
        academic_year
      },
      req.user?.id
    );

    res.status(201).json(expense);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to record expense' });
  }
});

router.put('/expenses/:id', upload.single('attachment'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const {
      expense_date,
      category_id,
      category_name,
      amount,
      paid_to,
      vendor,
      payment_method,
      status,
      invoice_no,
      reference_no,
      description,
      notes,
      academic_year,
      remove_attachment
    } = req.body;

    let attachment_path: string | undefined = undefined;
    if (req.file) {
      attachment_path = `/uploads/expenses/${req.file.filename}`;
    } else if (remove_attachment === 'true') {
      attachment_path = '';
    }

    const updated = await updateExpense(
      id,
      {
        expense_date,
        category_id: category_id ? Number(category_id) : undefined,
        category_name,
        amount: Number(amount),
        paid_to,
        vendor,
        payment_method,
        status,
        invoice_no,
        reference_no,
        description,
        notes,
        attachment_path,
        academic_year
      },
      req.user?.id
    );

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to update expense' });
  }
});

router.delete('/expenses/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await deleteExpense(id);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to delete expense' });
  }
});

// ===========================================================================
// 4. STAFF EMPLOYEES
// ===========================================================================

router.get('/employees', async (req, res) => {
  try {
    const onlyActive = req.query.all !== 'true';
    const employees = await getStaffEmployees(onlyActive);
    res.json(employees);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load staff employees' });
  }
});

router.get('/employees/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const emp = await getStaffEmployeeById(id);
    if (!emp) return res.status(404).json({ error: 'Staff member not found' });
    res.json(emp);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to fetch staff member' });
  }
});

router.post('/employees', requireAdmin, async (req, res) => {
  try {
    const { emp_code, name, department, designation, phone, email, basic_salary, bank_name, account_no, ifsc_code } =
      req.body;
    const emp = await createStaffEmployee({
      emp_code,
      name,
      department,
      designation,
      phone,
      email,
      basic_salary: Number(basic_salary) || 0,
      bank_name,
      account_no,
      ifsc_code
    });
    res.status(201).json(emp);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to create staff employee' });
  }
});

router.put('/employees/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { emp_code, name, department, designation, phone, email, basic_salary, bank_name, account_no, ifsc_code, is_active } =
      req.body;
    const emp = await updateStaffEmployee(id, {
      emp_code,
      name,
      department,
      designation,
      phone,
      email,
      basic_salary: Number(basic_salary) || 0,
      bank_name,
      account_no,
      ifsc_code,
      is_active: is_active !== undefined ? Boolean(is_active) : undefined
    });
    res.json(emp);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to update staff employee' });
  }
});

router.delete('/employees/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await deleteStaffEmployee(id);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to delete staff employee' });
  }
});

// ===========================================================================
// 5. MONTHLY PAYROLL
// ===========================================================================

router.get('/payroll', async (req, res) => {
  try {
    const academic_year = (req.query.academic_year as string) || '2025-26';
    const month = (req.query.month as string) || new Date().toLocaleString('en-US', { month: 'long' });
    const year = Number(req.query.year) || new Date().getFullYear();

    const records = await generateOrGetPayroll(academic_year, month, year);
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load payroll records' });
  }
});

router.put('/payroll/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { basic_salary, allowances, deductions, notes } = req.body;
    const updated = await updatePayrollRecord(id, {
      basic_salary: Number(basic_salary),
      allowances: Number(allowances),
      deductions: Number(deductions),
      notes
    });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to update payroll' });
  }
});

router.post('/payroll/:id/pay', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { payment_method, payment_date, reference_no, notes } = req.body;
    const updated = await markPayrollPaid(
      id,
      {
        payment_method,
        payment_date: payment_date || new Date().toISOString().split('T')[0],
        reference_no,
        notes
      },
      req.user?.id
    );
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to mark salary as paid' });
  }
});

// ===========================================================================
// 6. MONEY OUT TRANSACTIONS
// ===========================================================================

router.get('/transactions', async (req, res) => {
  try {
    const data = await getMoneyOutTransactions({
      type: req.query.type as string,
      source: req.query.source as string,
      category: req.query.category as string,
      payment_method: req.query.payment_method as string,
      academic_year: req.query.academic_year as string,
      search: req.query.search as string,
      start_date: req.query.start_date as string,
      end_date: req.query.end_date as string
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load transactions' });
  }
});

export default router;
