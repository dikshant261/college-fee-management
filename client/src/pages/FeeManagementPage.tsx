import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createFeePayment, deleteFeePayment, fetchFeePayments, FeePaymentRecord } from '../lib/feeApi';
import { fetchStudentById, fetchStudentByRoll, Student } from '../lib/studentApi';
import Toast from '../components/Toast';
import Pagination from '../components/Pagination';

export default function FeeManagementPage() {
  const [payments, setPayments] = useState<FeePaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [form, setForm] = useState({ student_id: '', payment_for: 'current_year' as 'current_year' | 'previous_due' | 'advance' | 'other', duration_unit: 1, amount: 0, note: '' });
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(null);
  const [toast, setToast] = useState<{ message: string; variant?: 'success' | 'error' | 'info' } | null>(null);

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
      setToast({ message: 'Unable to load fee payments.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function lookupStudent(query: string) {
    const q = query.trim();
    if (!q) {
      setMatchedStudent(null);
      return;
    }
    try {
      const isNum = /^[0-9]+$/.test(q);
      const data = isNum ? await fetchStudentById(Number(q)) : await fetchStudentByRoll(q);
      if (data) {
        setMatchedStudent(data);
        if (data.current_duration_unit && form.payment_for === 'current_year') {
          setForm((prev) => ({ ...prev, duration_unit: data.current_duration_unit }));
        }
      } else {
        setMatchedStudent(null);
      }
    } catch {
      setMatchedStudent(null);
    }
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.student_id.trim() || !form.amount) {
      setToast({ message: 'Student Roll No/ID and amount are required.', variant: 'error' });
      return;
    }
    setLoading(true);
    try {
      await createFeePayment({
        student_id: form.student_id.trim(),
        payment_for: form.payment_for,
        duration_unit: form.duration_unit,
        amount: form.amount,
        note: form.note || undefined
      });
      setToast({ message: 'Payment recorded successfully.', variant: 'success' });
      setForm({ student_id: '', payment_for: 'current_year', duration_unit: 1, amount: 0, note: '' });
      setMatchedStudent(null);
      await loadPayments();
    } catch (error: any) {
      setToast({ message: error?.response?.data?.error || 'Unable to record payment.', variant: 'error' });
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
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Fee Entry &amp; Transactions</h1>
            <p className="text-xs text-slate-500">Record student payments, track transaction history, and balance dues.</p>
          </div>
          <Link
            to="/fee-structures"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs transition"
          >
            Configure Fee Structures
          </Link>
        </div>
        <form onSubmit={handleCreate} className="mt-4 grid gap-3 lg:grid-cols-5 items-end">
          {matchedStudent && (
            <div className="col-span-full flex flex-wrap items-center gap-3 rounded-md border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs">
              <span className="font-semibold text-slate-800">Student: {matchedStudent.name}</span>
              <span className="font-mono text-slate-600">({matchedStudent.college_roll_no})</span>
              <span className="rounded bg-blue-100 px-1.5 py-0.5 font-medium text-blue-700">{matchedStudent.course_name || matchedStudent.course_code}</span>
              <span className="text-slate-600">Year / Unit: <strong className="text-slate-900">{matchedStudent.current_duration_unit}</strong> ({matchedStudent.academic_year})</span>
              <span className="text-slate-600">Current Year Due: <strong className="text-slate-900">₹{Number(matchedStudent.total_fees_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
              <span className="text-slate-600">Paid this Year: <strong className="text-emerald-700">₹{Number(matchedStudent.total_fees_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
              <span className="text-slate-600">Current Pending: <strong className={Number(matchedStudent.pending_fees) > 0 ? "text-red-700 font-bold" : "text-emerald-700 font-bold"}>₹{Number(matchedStudent.pending_fees).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700">Student Roll No / ID</label>
            <input
              type="text"
              value={form.student_id}
              onChange={(e) => {
                const val = e.target.value;
                setForm({ ...form, student_id: val });
                lookupStudent(val);
              }}
              onBlur={() => lookupStudent(form.student_id)}
              placeholder="e.g. 26COM001 or ID #3"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Payment Category</label>
            <select
              value={form.payment_for}
              onChange={(e) => {
                const category = e.target.value as any;
                setForm((prev) => ({
                  ...prev,
                  payment_for: category,
                  duration_unit: category === 'current_year' && matchedStudent?.current_duration_unit ? matchedStudent.current_duration_unit : prev.duration_unit
                }));
              }}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
            >
              <option value="current_year">Current Year Fee</option>
              <option value="previous_due">Previous Due Fee</option>
              <option value="advance">Advance Fee</option>
              <option value="other">Other / Misc Fee</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Course Year / Unit</label>
            <input
              type="number"
              min={1}
              value={form.duration_unit}
              onChange={(e) => setForm({ ...form, duration_unit: Number(e.target.value) })}
              placeholder="e.g. 1"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Payment Amount (₹)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              placeholder="0.00"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-4 py-1.5 text-sm font-medium text-white transition border border-blue-700 shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              Record Payment
            </button>
          </div>
        </form>
      </div>

      <div className="sticky top-0 z-20 rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Transactions</h2>
            <p className="text-xs text-slate-500">Latest payment entries recorded in the database.</p>
          </div>
          {loading ? <span className="text-xs text-slate-500">Refreshing…</span> : null}
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[350px]">
          <table className="min-w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Student</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Payment For</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Duration Unit</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Amount</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Paid At</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {payments
                .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                .map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-700">
                      <div className="font-semibold text-slate-900 font-mono text-xs">{payment.student_roll_no || `ID #${payment.student_id}`}</div>
                      {payment.student_name ? (
                        <div className="text-2xs text-slate-500">{payment.student_name}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-700 capitalize text-xs">{payment.payment_for.replace('_', ' ')}</td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-700 text-xs">Unit {payment.duration_unit}</td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-700 font-semibold text-xs">₹{payment.amount.toFixed(2)}</td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-700 text-xs">{new Date(payment.paid_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2 border-b border-slate-100">
                      <button
                        onClick={() => handleDelete(payment.id)}
                        className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100 shadow-xs transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 border-b border-slate-100 text-xs">
                    No payment records found.
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
      {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}
    </div>
  );
}
