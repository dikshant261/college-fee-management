import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteFeePayment, fetchFeePayments, FeePaymentRecord } from '../lib/feeApi';
import { useAuth } from '../contexts/AuthContext';
import Toast from '../components/Toast';
import Pagination from '../components/Pagination';
import PaymentModal from '../components/PaymentModal';

export default function FeeManagementPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<FeePaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant?: 'success' | 'error' | 'info' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  useEffect(() => {
    loadPayments();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function loadPayments() {
    setLoading(true);
    try {
      const list = await fetchFeePayments();
      setPayments(list);
    } catch (error) {
      setToast({ message: 'Unable to load payment history.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this payment record?')) return;
    setLoading(true);
    try {
      await deleteFeePayment(id);
      await loadPayments();
      setToast({ message: 'Payment deleted.', variant: 'success' });
    } catch (error: any) {
      setToast({ message: error?.response?.data?.error || 'Unable to delete payment.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Fee Entry &amp; Transactions</h1>
            <p className="text-xs text-slate-500">Record student payments, track transaction history, and balance dues.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Record Fee Payment
            </button>
            {user?.role === 'admin' && (
              <Link
                to="/fee-structures"
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs transition"
              >
                Configure Fee Structures
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Transactions Table Card */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Transactions</h2>
            <p className="text-xs text-slate-500">Latest payment entries recorded in the database ({payments.length} total).</p>
          </div>
          {loading ? <span className="text-xs text-slate-500">Refreshing…</span> : null}
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[350px]">
          <table className="min-w-[800px] w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs whitespace-nowrap min-w-[200px]">Student</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs whitespace-nowrap min-w-[140px]">Payment For</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs whitespace-nowrap min-w-[100px]">Year</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs whitespace-nowrap min-w-[120px]">Amount</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs whitespace-nowrap min-w-[120px]">Paid At</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs whitespace-nowrap min-w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {payments
                .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                .map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-2.5 border-b border-slate-100 text-slate-700 whitespace-nowrap">
                      <div className="font-semibold text-slate-900 font-mono text-xs">{payment.student_roll_no || `ID #${payment.student_id}`}</div>
                      {payment.student_name ? (
                        <div className="text-2xs text-slate-600 font-medium">{payment.student_name}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 border-b border-slate-100 text-slate-700 capitalize text-xs whitespace-nowrap">{payment.payment_for.replace('_', ' ')}</td>
                    <td className="px-4 py-2.5 border-b border-slate-100 text-slate-800 font-semibold text-xs whitespace-nowrap">Year {payment.duration_unit}</td>
                    <td className="px-4 py-2.5 border-b border-slate-100 text-slate-900 font-bold text-xs whitespace-nowrap">₹{payment.amount.toFixed(2)}</td>
                    <td className="px-4 py-2.5 border-b border-slate-100 text-slate-700 text-xs whitespace-nowrap">{new Date(payment.paid_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 border-b border-slate-100 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleDelete(payment.id)}
                        className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 shadow-xs transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 border-b border-slate-100 text-xs whitespace-nowrap">
                    No payment records found. Click &quot;Record Fee Payment&quot; to record one.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {payments.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={payments.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemLabel="payments"
          />
        )}
      </div>

      {/* Record Payment Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={() => {
          loadPayments();
          setToast({ message: 'Payment recorded successfully.', variant: 'success' });
        }}
      />

      {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}
    </div>
  );
}
