import React, { useEffect, useState, useMemo } from 'react';
import {
  ExpenseRecord,
  ExpenseCategory,
  fetchExpenses,
  fetchExpenseCategories,
  deleteExpense,
  formatINR
} from '../lib/financeApi';
import { useAuth } from '../contexts/AuthContext';
import Toast from '../components/Toast';
import Pagination from '../components/Pagination';
import ExpenseModal from '../components/ExpenseModal';
import ExpenseDetailsModal from '../components/ExpenseDetailsModal';
import CategoryManagerModal from '../components/CategoryManagerModal';

export default function ExpensesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant?: 'success' | 'error' | 'info' } | null>(null);

  // Filters state
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [selectedAy, setSelectedAy] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Modals state
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<ExpenseRecord | null>(null);
  const [viewExpense, setViewExpense] = useState<ExpenseRecord | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  useEffect(() => {
    loadCategories();
    loadExpenses();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function loadCategories() {
    try {
      const list = await fetchExpenseCategories(false);
      setCategories(list);
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  }

  async function loadExpenses() {
    setLoading(true);
    try {
      const list = await fetchExpenses({
        search: search || undefined,
        category: selectedCategory || undefined,
        status: selectedStatus || undefined,
        payment_method: selectedMethod || undefined,
        academic_year: selectedAy || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined
      });
      setExpenses(list);
      setCurrentPage(1);
    } catch (err: any) {
      setToast({ message: 'Unable to load expenses history.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  // Trigger search on filter apply
  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadExpenses();
  }

  function handleResetFilters() {
    setSearch('');
    setSelectedCategory('');
    setSelectedStatus('');
    setSelectedMethod('');
    setSelectedAy('');
    setStartDate('');
    setEndDate('');
    setTimeout(() => {
      fetchExpenses().then(setExpenses).catch(console.error);
    }, 0);
  }

  async function handleDelete(id: number) {
    if (!window.confirm(`Are you sure you want to delete expense voucher #${id}? This will also reverse any associated financial transactions.`)) {
      return;
    }
    setLoading(true);
    try {
      await deleteExpense(id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      if (viewExpense?.id === id) setViewExpense(null);
      setToast({ message: 'Expense record and transaction removed.', variant: 'success' });
    } catch (err: any) {
      setToast({ message: err?.response?.data?.error || 'Failed to delete expense', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  // Calculate totals for filtered view
  const summaryTotals = useMemo(() => {
    let paidTotal = 0;
    let pendingTotal = 0;
    for (const exp of expenses) {
      if (exp.status === 'paid') paidTotal += exp.amount;
      else pendingTotal += exp.amount;
    }
    return {
      paidTotal,
      pendingTotal,
      combined: paidTotal + pendingTotal,
      count: expenses.length
    };
  }, [expenses]);

  // Paginated records
  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return expenses.slice(start, start + pageSize);
  }, [expenses, currentPage, pageSize]);

  // Export to CSV
  function exportCSV() {
    if (expenses.length === 0) {
      setToast({ message: 'No expenses to export', variant: 'info' });
      return;
    }
    const headers = [
      'ID',
      'Date',
      'Academic Year',
      'Category',
      'Paid To',
      'Vendor',
      'Amount',
      'Status',
      'Payment Method',
      'Invoice No',
      'Reference No',
      'Description'
    ];
    const rows = expenses.map((e) => [
      e.id,
      e.expense_date,
      `"${e.academic_year}"`,
      `"${e.category_name}"`,
      `"${e.paid_to}"`,
      `"${e.vendor || ''}"`,
      e.amount,
      e.status,
      e.payment_method || '',
      `"${e.invoice_no || ''}"`,
      `"${e.reference_no || ''}"`,
      `"${(e.description || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `institutional-expenses-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToast({ message: 'Expenses exported to CSV successfully.', variant: 'success' });
  }

  // Print Report / PDF
  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.message} variant={toast.variant} />}

      {/* Page Header Card */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Expenses</h1>
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-2xs font-bold text-rose-700 border border-rose-200">
                Institutional Outflow
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Track and manage all institutional expenses.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setExpenseToEdit(null);
                setIsAddEditModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              + Add Expense
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs transition"
              >
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                Categories
              </button>
            )}

            <button
              type="button"
              onClick={exportCSV}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs transition"
              title="Export CSV"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              CSV
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs transition"
              title="Print"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
          </div>
        </div>

        {/* Quick Summary Pill Bar */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="rounded-md bg-slate-50 p-2.5 border border-slate-100">
            <span className="text-3xs font-semibold text-slate-400 uppercase tracking-wider block">Total Entries</span>
            <span className="text-base font-bold text-slate-800">{summaryTotals.count} records</span>
          </div>

          <div className="rounded-md bg-emerald-50/60 p-2.5 border border-emerald-100">
            <span className="text-3xs font-semibold text-emerald-700 uppercase tracking-wider block">Actual Paid Outflow</span>
            <span className="text-base font-bold text-emerald-700">{formatINR(summaryTotals.paidTotal)}</span>
          </div>

          <div className="rounded-md bg-amber-50/60 p-2.5 border border-amber-100">
            <span className="text-3xs font-semibold text-amber-700 uppercase tracking-wider block">Pending Commitments</span>
            <span className="text-base font-bold text-amber-700">{formatINR(summaryTotals.pendingTotal)}</span>
          </div>

          <div className="rounded-md bg-blue-50/60 p-2.5 border border-blue-100">
            <span className="text-3xs font-semibold text-blue-700 uppercase tracking-wider block">Combined Expense Value</span>
            <span className="text-base font-bold text-blue-700">{formatINR(summaryTotals.combined)}</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
        <form onSubmit={handleFilterSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-3xs font-bold uppercase text-slate-400 mb-1">Search Details</label>
              <input
                type="text"
                placeholder="Search paid to, desc, inv, ref…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-blue-500"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-3xs font-bold uppercase text-slate-400 mb-1">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs bg-white outline-none focus:border-blue-500"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-3xs font-bold uppercase text-slate-400 mb-1">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs bg-white outline-none focus:border-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-3xs font-bold uppercase text-slate-400 mb-1">Method</label>
              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs bg-white outline-none focus:border-blue-500"
              >
                <option value="">All Methods</option>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="card">Card</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Academic Year */}
            <div>
              <label className="block text-3xs font-bold uppercase text-slate-400 mb-1">Academic Year</label>
              <input
                type="text"
                placeholder="e.g. 2025-26"
                value={selectedAy}
                onChange={(e) => setSelectedAy(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
              />
            </div>

            {/* Date Range Start */}
            <div>
              <label className="block text-3xs font-bold uppercase text-slate-400 mb-1">Date Range</label>
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-1.5 py-1.5 text-2xs outline-none focus:border-blue-500"
                  title="From Date"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
            <span className="text-3xs text-slate-400">
              Showing matching filtered expenditures
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetFilters}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 font-medium"
              >
                Reset
              </button>
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-4 py-1.5 text-xs text-white hover:bg-slate-800 font-semibold"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Main Expenses Data Table */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto min-h-[350px]">
          <table className="w-full min-w-[950px] text-sm border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50/80 text-2xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4 text-left border-b border-slate-200">Date</th>
                <th className="py-3 px-3 text-left border-b border-slate-200">Category</th>
                <th className="py-3 px-3 text-left border-b border-slate-200">Paid To</th>
                <th className="py-3 px-3 text-left border-b border-slate-200">Description</th>
                <th className="py-3 px-3 text-left border-b border-slate-200">Method</th>
                <th className="py-3 px-3 text-right border-b border-slate-200">Amount</th>
                <th className="py-3 px-3 text-center border-b border-slate-200">Status</th>
                <th className="py-3 px-3 text-left border-b border-slate-200">Reference</th>
                <th className="py-3 px-4 text-right border-b border-slate-200">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      <span>Loading institutional expenses…</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                      </svg>
                      <span className="font-semibold text-slate-700">No expenses found</span>
                      <span className="text-3xs text-slate-400">Try adjusting your filters or click "+ Add Expense"</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-700 whitespace-nowrap">
                      {exp.expense_date}
                      <span className="block text-3xs text-slate-400">{exp.academic_year}</span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="inline-block bg-slate-100 text-slate-800 font-semibold px-2 py-0.5 rounded text-2xs border border-slate-200">
                        {exp.category_name}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-semibold text-slate-900">
                      {exp.paid_to}
                      {exp.vendor && (
                        <span className="block text-3xs text-slate-400 font-normal">
                          Vendor: {exp.vendor}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 max-w-xs truncate text-slate-600 font-normal" title={exp.description || ''}>
                      {exp.description || '—'}
                      {exp.attachment_path && (
                        <span className="inline-block ml-1 text-blue-600 font-semibold text-3xs" title="Has bill attachment">
                          📎 Bill
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 uppercase text-2xs font-semibold text-slate-600 whitespace-nowrap">
                      {exp.payment_method?.replace('_', ' ') || '—'}
                    </td>

                    <td className="py-3 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                      <span className="text-rose-600 mr-0.5">▼</span>
                      {formatINR(exp.amount)}
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider ${
                          exp.status === 'paid'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full mr-1 ${
                            exp.status === 'paid' ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        />
                        {exp.status === 'paid' ? 'Paid' : 'Pending'}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-mono text-3xs text-slate-600 whitespace-nowrap">
                      {exp.reference_no || exp.invoice_no || '—'}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewExpense(exp)}
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
                          title="View Details"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setExpenseToEdit(exp);
                            setIsAddEditModalOpen(true);
                          }}
                          className="rounded p-1 text-blue-600 hover:bg-blue-50 transition"
                          title="Edit Expense"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDelete(exp.id)}
                            className="rounded p-1 text-rose-600 hover:bg-rose-50 transition"
                            title="Delete Expense"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination component */}
        {expenses.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={expenses.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setCurrentPage(1);
            }}
            pageSizeOptions={[10, 15, 25, 50, 100]}
            itemLabel="expenses"
          />
        )}
      </div>

      {/* Add / Edit Expense Modal */}
      <ExpenseModal
        isOpen={isAddEditModalOpen}
        onClose={() => setIsAddEditModalOpen(false)}
        expenseToEdit={expenseToEdit}
        categories={categories}
        onSaved={(_saved) => {
          loadExpenses();
          setToast({
            message: expenseToEdit ? 'Expense updated successfully.' : 'New expense recorded.',
            variant: 'success'
          });
        }}
        onOpenCategoryManager={() => setIsCategoryModalOpen(true)}
      />

      {/* View Expense Details Modal */}
      <ExpenseDetailsModal
        isOpen={Boolean(viewExpense)}
        onClose={() => setViewExpense(null)}
        expense={viewExpense}
        onEdit={(exp) => {
          setExpenseToEdit(exp);
          setIsAddEditModalOpen(true);
        }}
      />

      {/* Manage Categories Modal */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
        onCategoriesChanged={loadCategories}
      />
    </div>
  );
}
