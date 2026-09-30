import React, { useEffect, useState, useMemo } from 'react';
import {
  StaffEmployee,
  PayrollRecord,
  fetchStaffEmployees,
  fetchPayroll,
  updatePayrollRecord,
  deleteStaffEmployee,
  formatINR
} from '../lib/financeApi';
import { useAuth } from '../contexts/AuthContext';
import Toast from '../components/Toast';
import StaffModal from '../components/StaffModal';
import PaySalaryModal from '../components/PaySalaryModal';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

export default function PayrollPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Active Tab: 'payroll' | 'staff'
  const [activeTab, setActiveTab] = useState<'payroll' | 'staff'>('payroll');

  // Month & Year selection for Payroll Sheet
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>(
    MONTH_NAMES[currentDate.getMonth()]
  );
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedAy, setSelectedAy] = useState<string>('2025-26');

  // Data states
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [staffList, setStaffList] = useState<StaffEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant?: 'success' | 'error' | 'info' } | null>(null);

  // Modals state
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [staffToEdit, setStaffToEdit] = useState<StaffEmployee | null>(null);
  const [payRecord, setPayRecord] = useState<PayrollRecord | null>(null);

  // Quick edit allowances / deductions modal/state
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [editBasic, setEditBasic] = useState<number>(0);
  const [editAllowances, setEditAllowances] = useState<number>(0);
  const [editDeductions, setEditDeductions] = useState<number>(0);

  useEffect(() => {
    loadStaff();
  }, []);

  useEffect(() => {
    if (activeTab === 'payroll') {
      loadPayroll();
    }
  }, [activeTab, selectedMonth, selectedYear, selectedAy]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function loadStaff() {
    try {
      const data = await fetchStaffEmployees(true);
      setStaffList(data);
    } catch (err) {
      console.error('Failed to load staff list', err);
    }
  }

  async function loadPayroll() {
    setLoading(true);
    try {
      const data = await fetchPayroll({
        academic_year: selectedAy,
        month: selectedMonth,
        year: selectedYear
      });
      setPayrollRecords(data);
    } catch (err: any) {
      setToast({ message: 'Failed to load payroll sheet.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  function startEditingRow(record: PayrollRecord) {
    setEditingRowId(record.id);
    setEditBasic(record.basic_salary);
    setEditAllowances(record.allowances);
    setEditDeductions(record.deductions);
  }

  async function saveRowEdit(id: number) {
    try {
      const updated = await updatePayrollRecord(id, {
        basic_salary: Number(editBasic),
        allowances: Number(editAllowances),
        deductions: Number(editDeductions)
      });
      setPayrollRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
      setEditingRowId(null);
      setToast({ message: 'Payroll line updated.', variant: 'success' });
    } catch (err: any) {
      setToast({ message: 'Failed to update payroll line.', variant: 'error' });
    }
  }

  async function handleDeleteStaff(id: number, name: string) {
    if (!window.confirm(`Are you sure you want to remove staff member "${name}"?`)) return;
    try {
      await deleteStaffEmployee(id);
      setStaffList((prev) => prev.filter((s) => s.id !== id));
      setToast({ message: 'Staff member removed.', variant: 'success' });
      loadPayroll();
    } catch (err: any) {
      setToast({ message: 'Failed to delete staff member.', variant: 'error' });
    }
  }

  // Aggregate stats for payroll sheet
  const payrollTotals = useMemo(() => {
    let totalBase = 0;
    let totalAllowances = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    let paidAmount = 0;
    let pendingAmount = 0;
    let paidCount = 0;

    for (const r of payrollRecords) {
      totalBase += r.basic_salary;
      totalAllowances += r.allowances;
      totalDeductions += r.deductions;
      totalNet += r.net_salary;
      if (r.status === 'paid') {
        paidAmount += r.net_salary;
        paidCount++;
      } else {
        pendingAmount += r.net_salary;
      }
    }

    return {
      totalStaff: payrollRecords.length,
      totalBase,
      totalAllowances,
      totalDeductions,
      totalNet,
      paidAmount,
      pendingAmount,
      paidCount
    };
  }, [payrollRecords]);

  // Export payroll sheet to CSV
  function exportPayrollCSV() {
    if (payrollRecords.length === 0) {
      setToast({ message: 'No records to export', variant: 'info' });
      return;
    }
    const headers = [
      'Emp Code',
      'Name',
      'Department',
      'Designation',
      'Month',
      'Year',
      'Academic Year',
      'Basic Salary',
      'Allowances',
      'Deductions',
      'Net Salary',
      'Status',
      'Payment Date',
      'Payment Method',
      'Reference No'
    ];
    const rows = payrollRecords.map((r) => [
      `"${r.emp_code || ''}"`,
      `"${r.employee_name || ''}"`,
      `"${r.department || ''}"`,
      `"${r.designation || ''}"`,
      r.month,
      r.year,
      `"${r.academic_year}"`,
      r.basic_salary,
      r.allowances,
      r.deductions,
      r.net_salary,
      r.status,
      r.payment_date || '',
      r.payment_method || '',
      `"${r.reference_no || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `payroll-${selectedMonth}-${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToast({ message: 'Payroll exported to CSV.', variant: 'success' });
  }

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.message} variant={toast.variant} />}

      {/* Top Header Card */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Salary &amp; Payroll</h1>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-2xs font-bold text-indigo-700 border border-indigo-200">
                Staff Compensation
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage faculty remuneration, monthly salary disbursement, and staff directory.
            </p>
          </div>

          {/* Navigation Pill Tabs */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('payroll')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'payroll'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Monthly Payroll Sheet
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('staff')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'staff'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Staff Directory ({staffList.length})
            </button>
          </div>
        </div>

        {/* Tab 1 Quick Controls: Month Selector & Summary */}
        {activeTab === 'payroll' && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            {/* Period Selector Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-600">Payroll Period:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-md border border-slate-300 px-2.5 py-1 font-semibold text-slate-800 bg-white outline-none focus:border-blue-500"
              >
                {MONTH_NAMES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="rounded-md border border-slate-300 px-2.5 py-1 font-semibold text-slate-800 bg-white outline-none focus:border-blue-500"
              >
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                <span className="text-slate-500 text-3xs font-semibold uppercase">Session:</span>
                <input
                  type="text"
                  value={selectedAy}
                  onChange={(e) => setSelectedAy(e.target.value)}
                  placeholder="2025-26"
                  className="w-20 rounded-md border border-slate-300 px-2 py-1 text-2xs font-mono font-semibold outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="button"
                onClick={loadPayroll}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
              >
                ↻ Refresh
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportPayrollCSV}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export CSV
              </button>
            </div>
          </div>
        )}

        {/* Tab 2 Header Controls: Add Staff Button */}
        {activeTab === 'staff' && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Active staff members are automatically populated into the monthly payroll sheet.
            </span>
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setStaffToEdit(null);
                  setIsStaffModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs transition"
              >
                + Register New Staff
              </button>
            )}
          </div>
        )}
      </div>

      {/* =====================================================================
          TAB 1: MONTHLY PAYROLL SHEET
          ===================================================================== */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
              <span className="text-3xs uppercase font-bold text-slate-400 block">Total Staff on Sheet</span>
              <span className="text-base font-extrabold text-slate-800">{payrollTotals.totalStaff} staff members</span>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
              <span className="text-3xs uppercase font-bold text-slate-400 block">Total Net Payable</span>
              <span className="text-base font-extrabold text-slate-900">{formatINR(payrollTotals.totalNet)}</span>
            </div>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 shadow-xs">
              <span className="text-3xs uppercase font-bold text-emerald-700 block">
                Disbursed / Paid ({payrollTotals.paidCount})
              </span>
              <span className="text-base font-extrabold text-emerald-700">{formatINR(payrollTotals.paidAmount)}</span>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 shadow-xs">
              <span className="text-3xs uppercase font-bold text-amber-700 block">Pending Clearance</span>
              <span className="text-base font-extrabold text-amber-700">{formatINR(payrollTotals.pendingAmount)}</span>
            </div>
          </div>

          {/* Payroll Sheet Data Table */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto min-h-[350px]">
              <table className="w-full min-w-[950px] text-sm border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50/80 text-2xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4 text-left border-b border-slate-200">Staff / Employee</th>
                    <th className="py-3 px-3 text-left border-b border-slate-200">Department</th>
                    <th className="py-3 px-3 text-right border-b border-slate-200">Basic</th>
                    <th className="py-3 px-3 text-right border-b border-slate-200">Allowances</th>
                    <th className="py-3 px-3 text-right border-b border-slate-200">Deductions</th>
                    <th className="py-3 px-3 text-right border-b border-slate-200">Net Salary</th>
                    <th className="py-3 px-3 text-center border-b border-slate-200">Status</th>
                    <th className="py-3 px-3 text-left border-b border-slate-200">Payment Info</th>
                    <th className="py-3 px-4 text-right border-b border-slate-200">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                          <span>Generating / Loading payroll records…</span>
                        </div>
                      </td>
                    </tr>
                  ) : payrollRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <span className="font-semibold text-slate-700">No staff employees enrolled</span>
                          <span className="text-3xs text-slate-400">
                            Switch to the "Staff Directory" tab to register employees.
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    payrollRecords.map((record) => {
                      const isRowEditing = editingRowId === record.id;
                      const calculatedNet = Math.max(0, Number(editBasic) + Number(editAllowances) - Number(editDeductions));

                      return (
                        <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block">{record.employee_name}</span>
                            <span className="font-mono text-3xs text-slate-400">
                              {record.emp_code} • {record.designation}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-slate-700 font-medium whitespace-nowrap">
                            {record.department}
                          </td>

                          {/* Basic Salary */}
                          <td className="py-3 px-3 text-right font-mono">
                            {isRowEditing ? (
                              <input
                                type="number"
                                value={editBasic}
                                onChange={(e) => setEditBasic(Number(e.target.value))}
                                className="w-20 rounded border border-blue-400 px-1.5 py-0.5 text-right font-mono text-xs outline-none"
                              />
                            ) : (
                              <span>{formatINR(record.basic_salary)}</span>
                            )}
                          </td>

                          {/* Allowances */}
                          <td className="py-3 px-3 text-right font-mono text-emerald-700">
                            {isRowEditing ? (
                              <input
                                type="number"
                                value={editAllowances}
                                onChange={(e) => setEditAllowances(Number(e.target.value))}
                                className="w-16 rounded border border-emerald-400 px-1.5 py-0.5 text-right font-mono text-xs outline-none"
                              />
                            ) : (
                              <span>+{formatINR(record.allowances)}</span>
                            )}
                          </td>

                          {/* Deductions */}
                          <td className="py-3 px-3 text-right font-mono text-rose-600">
                            {isRowEditing ? (
                              <input
                                type="number"
                                value={editDeductions}
                                onChange={(e) => setEditDeductions(Number(e.target.value))}
                                className="w-16 rounded border border-rose-400 px-1.5 py-0.5 text-right font-mono text-xs outline-none"
                              />
                            ) : (
                              <span>-{formatINR(record.deductions)}</span>
                            )}
                          </td>

                          {/* Net Salary */}
                          <td className="py-3 px-3 text-right font-extrabold text-slate-900 whitespace-nowrap">
                            {isRowEditing ? (
                              <span className="text-blue-600">{formatINR(calculatedNet)}</span>
                            ) : (
                              formatINR(record.net_salary)
                            )}
                          </td>

                          {/* Payment Status */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider ${
                                record.status === 'paid'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full mr-1 ${
                                  record.status === 'paid' ? 'bg-emerald-500' : 'bg-amber-500'
                                }`}
                              />
                              {record.status === 'paid' ? 'Paid' : 'Pending'}
                            </span>
                          </td>

                          {/* Payment Info */}
                          <td className="py-3 px-3 whitespace-nowrap text-3xs text-slate-600">
                            {record.status === 'paid' ? (
                              <div>
                                <span className="font-semibold text-slate-800">
                                  {record.payment_date} ({record.payment_method?.replace('_', ' ')})
                                </span>
                                {record.reference_no && (
                                  <span className="block font-mono text-slate-400">{record.reference_no}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Awaiting clearance</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {isRowEditing ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => saveRowEdit(record.id)}
                                  className="rounded bg-emerald-600 px-2 py-1 text-2xs font-semibold text-white hover:bg-emerald-700"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingRowId(null)}
                                  className="rounded bg-slate-200 px-2 py-1 text-2xs font-semibold text-slate-700 hover:bg-slate-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5">
                                {isAdmin && record.status === 'pending' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => startEditingRow(record)}
                                      className="rounded border border-slate-200 px-2 py-1 text-2xs font-medium text-slate-700 hover:bg-slate-50 transition"
                                      title="Adjust basic, allowances or deductions"
                                    >
                                      Adjust
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setPayRecord(record)}
                                      className="rounded bg-emerald-600 px-2.5 py-1 text-2xs font-semibold text-white hover:bg-emerald-700 shadow-xs transition"
                                    >
                                      Mark Paid
                                    </button>
                                  </>
                                )}

                                {record.status === 'paid' && (
                                  <button
                                    type="button"
                                    onClick={() => setPayRecord(record)}
                                    className="rounded border border-slate-200 px-2 py-1 text-2xs font-medium text-slate-500 hover:bg-slate-50"
                                    title="View or update payment reference"
                                  >
                                    View Receipt
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: STAFF & FACULTY DIRECTORY
          ===================================================================== */}
      {activeTab === 'staff' && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto min-h-[350px]">
            <table className="w-full min-w-[850px] text-sm border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50/80 text-2xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="py-3 px-4 text-left border-b border-slate-200">Emp ID</th>
                  <th className="py-3 px-3 text-left border-b border-slate-200">Staff Name</th>
                  <th className="py-3 px-3 text-left border-b border-slate-200">Department</th>
                  <th className="py-3 px-3 text-left border-b border-slate-200">Designation</th>
                  <th className="py-3 px-3 text-right border-b border-slate-200">Base Salary</th>
                  <th className="py-3 px-3 text-left border-b border-slate-200">Bank Details</th>
                  <th className="py-3 px-3 text-center border-b border-slate-200">Status</th>
                  <th className="py-3 px-4 text-right border-b border-slate-200">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {staffList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500">
                      No staff members registered. Click "+ Register New Staff" to get started.
                    </td>
                  </tr>
                ) : (
                  staffList.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">{emp.emp_code}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {emp.name}
                        {emp.email && <span className="block text-3xs font-normal text-slate-400">{emp.email}</span>}
                      </td>
                      <td className="py-3 px-3 text-slate-700">{emp.department}</td>
                      <td className="py-3 px-3 text-slate-700">{emp.designation}</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {formatINR(emp.basic_salary)}
                      </td>
                      <td className="py-3 px-3 text-3xs text-slate-600 font-mono">
                        {emp.account_no ? (
                          <div>
                            <span className="font-semibold text-slate-800">{emp.bank_name}</span>
                            <div>A/C: {emp.account_no}</div>
                            <div>IFSC: {emp.ifsc_code}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No bank recorded</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-3xs font-semibold ${
                            emp.is_active === 1
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {emp.is_active === 1 ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isAdmin && (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setStaffToEdit(emp);
                                setIsStaffModalOpen(true);
                              }}
                              className="rounded p-1 text-blue-600 hover:bg-blue-50"
                              title="Edit Staff"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStaff(emp.id, emp.name)}
                              className="rounded p-1 text-rose-600 hover:bg-rose-50"
                              title="Delete Staff"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Staff Modal (Add / Edit) */}
      <StaffModal
        isOpen={isStaffModalOpen}
        onClose={() => setIsStaffModalOpen(false)}
        staffToEdit={staffToEdit}
        onSaved={(_saved) => {
          loadStaff();
          if (activeTab === 'payroll') loadPayroll();
          setToast({
            message: staffToEdit ? 'Staff member updated.' : 'Staff member registered successfully.',
            variant: 'success'
          });
        }}
      />

      {/* Pay Salary Disbursement Modal */}
      <PaySalaryModal
        isOpen={Boolean(payRecord)}
        onClose={() => setPayRecord(null)}
        payroll={payRecord}
        onSuccess={(updated) => {
          setPayrollRecords((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
          setToast({
            message: `Salary disbursement recorded for ${updated.employee_name || 'Staff'}.`,
            variant: 'success'
          });
        }}
      />
    </div>
  );
}
