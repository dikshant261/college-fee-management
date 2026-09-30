import api from './api';

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

export interface SessionFeeItem {
  academic_year: string;
  student_count: number;
  total_due: number;
  total_paid: number;
  total_pending: number;
  recovery_percentage: number;
}

export interface CourseFeeItem {
  course_code: string;
  course_name: string;
  student_count: number;
  total_due: number;
  total_paid: number;
  total_pending: number;
  recovery_percentage: number;
}

export interface FinanceOverviewData {
  inflow: {
    grand_total_due: number;
    grand_total_paid: number;
    grand_total_pending: number;
    total_students: number;
    recovery_percentage: number;
    session_wise: SessionFeeItem[];
    course_wise: CourseFeeItem[];
  };
  outflow: {
    total_outflow: number;
    this_month_outflow: number;
    total_salary: number;
    other_expenses: number;
    pending_payments: number;
    transaction_count: number;
    category_breakdown: Array<{ category: string; amount: number; count: number }>;
    payment_method_breakdown: Array<{ payment_method: string; amount: number; count: number }>;
    monthly_trend: Array<{ month_key: string; total: number; salary: number; expenses: number }>;
  };
  net: {
    inflow: number;
    outflow: number;
    balance: number;
    is_surplus: boolean;
  };
}

export function formatINR(val?: number | null): string {
  const num = val ?? 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(num);
}

// ---------------------------------------------------------------------------
// API METHODS
// ---------------------------------------------------------------------------

export function fetchFinanceOverview(params?: { academic_year?: string; month?: string; course_code?: string }) {
  return api.get<FinanceOverviewData>('/api/finance/overview', { params }).then((res) => res.data);
}

export function fetchExpenseCategories(all = false) {
  return api.get<ExpenseCategory[]>('/api/finance/categories', { params: { all } }).then((res) => res.data);
}

export function createExpenseCategory(data: { name: string; description?: string }) {
  return api.post<ExpenseCategory>('/api/finance/categories', data).then((res) => res.data);
}

export function toggleExpenseCategory(id: number, is_active: boolean) {
  return api.patch<ExpenseCategory>(`/api/finance/categories/${id}/toggle`, { is_active }).then((res) => res.data);
}

export function fetchExpenses(params?: {
  search?: string;
  category?: string;
  status?: string;
  payment_method?: string;
  academic_year?: string;
  start_date?: string;
  end_date?: string;
}) {
  return api.get<ExpenseRecord[]>('/api/finance/expenses', { params }).then((res) => res.data);
}

export function fetchExpense(id: number) {
  return api.get<ExpenseRecord>(`/api/finance/expenses/${id}`).then((res) => res.data);
}

export function createExpense(formData: FormData) {
  return api
    .post<ExpenseRecord>('/api/finance/expenses', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    .then((res) => res.data);
}

export function updateExpense(id: number, formData: FormData) {
  return api
    .put<ExpenseRecord>(`/api/finance/expenses/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    .then((res) => res.data);
}

export function deleteExpense(id: number) {
  return api.delete(`/api/finance/expenses/${id}`);
}

export function fetchStaffEmployees(all = false) {
  return api.get<StaffEmployee[]>('/api/finance/employees', { params: { all } }).then((res) => res.data);
}

export function fetchStaffEmployee(id: number) {
  return api.get<StaffEmployee>(`/api/finance/employees/${id}`).then((res) => res.data);
}

export function createStaffEmployee(data: Partial<StaffEmployee>) {
  return api.post<StaffEmployee>('/api/finance/employees', data).then((res) => res.data);
}

export function updateStaffEmployee(id: number, data: Partial<StaffEmployee>) {
  return api.put<StaffEmployee>(`/api/finance/employees/${id}`, data).then((res) => res.data);
}

export function deleteStaffEmployee(id: number) {
  return api.delete(`/api/finance/employees/${id}`);
}

export function fetchPayroll(params: { academic_year: string; month: string; year: number }) {
  return api.get<PayrollRecord[]>('/api/finance/payroll', { params }).then((res) => res.data);
}

export function updatePayrollRecord(
  id: number,
  data: { basic_salary: number; allowances: number; deductions: number; notes?: string }
) {
  return api.put<PayrollRecord>(`/api/finance/payroll/${id}`, data).then((res) => res.data);
}

export function markPayrollPaid(
  id: number,
  data: { payment_method: string; payment_date: string; reference_no?: string; notes?: string }
) {
  return api.post<PayrollRecord>(`/api/finance/payroll/${id}/pay`, data).then((res) => res.data);
}

export function fetchMoneyOutTransactions(params?: {
  type?: string;
  source?: string;
  category?: string;
  payment_method?: string;
  academic_year?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
}) {
  return api
    .get<{ transactions: MoneyOutTransaction[]; summary: { totalAmount: number; count: number } }>(
      '/api/finance/transactions',
      { params }
    )
    .then((res) => res.data);
}
