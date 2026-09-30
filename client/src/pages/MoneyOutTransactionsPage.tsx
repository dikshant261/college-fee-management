import React, { useEffect, useState, useMemo } from 'react';
import {
  MoneyOutTransaction,
  fetchMoneyOutTransactions,
  formatINR
} from '../lib/financeApi';
import Toast from '../components/Toast';
import Pagination from '../components/Pagination';

export default function MoneyOutTransactionsPage() {
  const [transactions, setTransactions] = useState<MoneyOutTransaction[]>([]);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant?: 'success' | 'error' | 'info' } | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [selectedAy, setSelectedAy] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    loadTransactions();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function loadTransactions() {
    setLoading(true);
    try {
      const res = await fetchMoneyOutTransactions({
        search: search || undefined,
        type: selectedType || undefined,
        payment_method: selectedMethod || undefined,
        academic_year: selectedAy || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined
      });
      setTransactions(res.transactions);
      setTotalAmount(res.summary.totalAmount);
      setCurrentPage(1);
    } catch (err: any) {
      setToast({ message: 'Failed to load transaction ledger.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadTransactions();
  }

  function handleResetFilters() {
    setSearch('');
    setSelectedType('');
    setSelectedMethod('');
    setSelectedAy('');
    setStartDate('');
    setEndDate('');
    setTimeout(() => {
      fetchMoneyOutTransactions().then((res) => {
        setTransactions(res.transactions);
        setTotalAmount(res.summary.totalAmount);
      }).catch(console.error);
    }, 0);
  }

  // Paginated slice
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return transactions.slice(start, start + pageSize);
  }, [transactions, currentPage, pageSize]);

  function exportCSV() {
    if (transactions.length === 0) {
      setToast({ message: 'No transactions to export', variant: 'info' });
      return;
    }
    const headers = [
      'Tx ID',
      'Date',
      'Type',
      'Source Module',
      'Category',
      'Paid To',
      'Payment Method',
      'Reference No',
      'Amount',
      'Academic Year',
      'Description'
    ];
    const rows = transactions.map((t) => [
      t.id,
      t.transaction_date,
      t.type,
      t.source,
      `"${t.category}"`,
      `"${t.paid_to}"`,
      t.payment_method,
      `"${t.reference_no || ''}"`,
      t.amount,
      `"${t.academic_year}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `money-out-transactions-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToast({ message: 'Transactions exported to CSV.', variant: 'success' });
  }

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.message} variant={toast.variant} />}

      {/* Header Card */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Money Out Transactions</h1>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-bold text-slate-700 border border-slate-200">
                Audit Trail
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Unified financial ledger of all cleared institutional outflows (expenses &amp; payroll).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportCSV}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition"
            >
              Print
            </button>
          </div>
        </div>

        {/* Aggregate Summary */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-100 pt-3 text-xs">
          <div className="rounded-md bg-slate-50 p-2.5 border border-slate-100">
            <span className="text-3xs font-semibold text-slate-400 uppercase tracking-wider block">
              Total Transactions Count
            </span>
            <span className="text-base font-bold text-slate-800">{transactions.length} records</span>
          </div>

          <div className="rounded-md bg-rose-50/60 p-2.5 border border-rose-100 sm:col-span-2">
            <span className="text-3xs font-semibold text-rose-700 uppercase tracking-wider block">
              Cumulative Disbursed Outflow (Filtered View)
            </span>
            <span className="text-base font-extrabold text-rose-700">{formatINR(totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
        <form onSubmit={handleFilterSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 text-xs">
            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-3xs font-bold uppercase text-slate-400 mb-1">Search Beneficiary / Ref</label>
              <input
                type="text"
                placeholder="Search paid to, reference, desc…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-blue-500"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-3xs font-bold uppercase text-slate-400 mb-1">Transaction Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs bg-white outline-none focus:border-blue-500"
              >
                <option value="">All Types (Expense + Salary)</option>
                <option value="EXPENSE">Expense</option>
                <option value="SALARY">Salary Remittance</option>
              </select>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-3xs font-bold uppercase text-slate-400 mb-1">Payment Method</label>
              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs bg-white outline-none focus:border-blue-500"
              >
                <option value="">All Methods</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="card">Card</option>
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
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
            <span className="text-3xs text-slate-400">
              Only transactions with confirmed cleared status appear in this audit ledger
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

      {/* Transactions Ledger Table */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto min-h-[350px]">
          <table className="w-full min-w-[950px] text-sm border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50/80 text-2xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4 text-left border-b border-slate-200">Date</th>
                <th className="py-3 px-3 text-left border-b border-slate-200">Type</th>
                <th className="py-3 px-3 text-left border-b border-slate-200">Category</th>
                <th className="py-3 px-3 text-left border-b border-slate-200">Paid To (Beneficiary)</th>
                <th className="py-3 px-3 text-left border-b border-slate-200">Payment Method</th>
                <th className="py-3 px-3 text-right border-b border-slate-200">Amount</th>
                <th className="py-3 px-3 text-center border-b border-slate-200">Status</th>
                <th className="py-3 px-4 text-left border-b border-slate-200">Reference / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      <span>Loading financial transactions…</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No transactions recorded yet in the Outgoing Transaction Layer.
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-700 whitespace-nowrap">
                      {tx.transaction_date}
                      <span className="block text-3xs text-slate-400 font-sans">{tx.academic_year}</span>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-3xs font-bold uppercase tracking-wider ${
                          tx.type === 'SALARY'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {tx.type}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                      {tx.category}
                    </td>

                    <td className="py-3 px-3 font-bold text-slate-900">
                      {tx.paid_to}
                    </td>

                    <td className="py-3 px-3 uppercase text-2xs font-semibold text-slate-600 whitespace-nowrap">
                      {tx.payment_method?.replace('_', ' ')}
                    </td>

                    <td className="py-3 px-3 text-right font-extrabold text-slate-900 whitespace-nowrap">
                      <span className="text-rose-600 mr-0.5">▼</span>
                      {formatINR(tx.amount)}
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full mr-1 bg-emerald-500" />
                        {tx.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-600 text-3xs">
                      {tx.reference_no && (
                        <span className="font-mono font-semibold text-slate-800 block">
                          Ref: {tx.reference_no}
                        </span>
                      )}
                      <span className="truncate block max-w-xs">{tx.description || '—'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {transactions.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={transactions.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setCurrentPage(1);
            }}
            pageSizeOptions={[10, 20, 30, 50, 100]}
            itemLabel="transactions"
          />
        )}
      </div>
    </div>
  );
}
