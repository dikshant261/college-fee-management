import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { createFeePayment } from '../lib/feeApi';
import { fetchStudentById, fetchStudentByRoll, Student } from '../lib/studentApi';
import Toast from './Toast';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStudent?: Student | null;
  onSuccess: () => void;
}

export default function PaymentModal({
  isOpen,
  onClose,
  initialStudent,
  onSuccess,
}: PaymentModalProps) {
  const [form, setForm] = useState({
    student_id: '',
    payment_for: 'current_year' as 'current_year' | 'previous_due' | 'advance' | 'other',
    duration_unit: 1 as number | string,
    amount: '' as number | string,
    note: '',
  });

  const [matchedStudent, setMatchedStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant?: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (initialStudent) {
      setMatchedStudent(initialStudent);
      setForm({
        student_id: initialStudent.college_roll_no || String(initialStudent.id),
        payment_for: 'current_year',
        duration_unit: initialStudent.current_duration_unit || 1,
        amount: '',
        note: '',
      });
    } else {
      setMatchedStudent(null);
      setForm({
        student_id: '',
        payment_for: 'current_year',
        duration_unit: 1,
        amount: '',
        note: '',
      });
    }
  }, [initialStudent, isOpen]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numAmount = Number(form.amount);
    if (!form.student_id.trim() || !form.amount || isNaN(numAmount) || numAmount <= 0) {
      setToast({ message: 'Student Roll No/ID and a valid amount are required.', variant: 'error' });
      return;
    }

    setLoading(true);
    try {
      await createFeePayment({
        student_id: form.student_id.trim(),
        payment_for: form.payment_for,
        duration_unit: Number(form.duration_unit) || 1,
        amount: numAmount,
        note: form.note || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setToast({
        message: err?.response?.data?.error || 'Unable to record payment.',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Fee Payment"
      subtitle="Capture student dues collection and generate payment receipt"
      maxWidth="2xl"
      icon={
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Student Lookup Field */}
        <div>
          <label className="block text-xs font-semibold text-slate-700">Student Roll No or Database ID *</label>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              required
              disabled={Boolean(initialStudent)}
              value={form.student_id}
              onChange={(e) => {
                const val = e.target.value;
                setForm({ ...form, student_id: val });
                lookupStudent(val);
              }}
              onBlur={() => lookupStudent(form.student_id)}
              placeholder="e.g. 26BCOM002 or ID #8"
              className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100 shadow-2xs font-mono"
            />
            {!initialStudent && (
              <button
                type="button"
                onClick={() => lookupStudent(form.student_id)}
                className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-2xs transition"
              >
                Lookup
              </button>
            )}
          </div>
        </div>

        {/* Live Student Dues Banner */}
        {matchedStudent && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs shadow-2xs space-y-2.5 animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200/80 pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">{matchedStudent.name}</span>
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-blue-200 text-slate-700 font-semibold">{matchedStudent.college_roll_no}</span>
                <span className="rounded bg-blue-100 px-2 py-0.5 font-medium text-blue-800">{matchedStudent.course_name || matchedStudent.course_code}</span>
                <span className="text-slate-600 font-medium">Year {matchedStudent.current_duration_unit} ({matchedStudent.academic_year})</span>
                {matchedStudent.admission_duration_unit && matchedStudent.admission_duration_unit > 1 && (
                  <span className="rounded bg-purple-100 text-purple-800 px-2 py-0.5 font-medium text-2xs">
                    Direct Year {matchedStudent.admission_duration_unit} Entry
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-2xs text-slate-600 font-medium">Total Balance Left:</span>
                <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                  Number(matchedStudent.overall_pending_fees ?? matchedStudent.pending_fees) > 0
                    ? "bg-rose-100 text-rose-800 border border-rose-300"
                    : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                }`}>
                  ₹{Number(matchedStudent.overall_pending_fees ?? matchedStudent.pending_fees).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5 text-slate-700">
              {/* Current Year */}
              <div className="rounded-lg bg-white/90 p-2.5 border border-blue-100 shadow-2xs">
                <div className="font-semibold text-slate-800 mb-1 text-2xs uppercase tracking-wider">Current Session</div>
                <div className="flex justify-between text-2xs text-slate-600">
                  <span>Due:</span> <span className="font-medium text-slate-900">₹{Number(matchedStudent.total_fees_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-2xs text-slate-600">
                  <span>Paid:</span> <span className="font-medium text-emerald-700">₹{Number(matchedStudent.total_fees_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-2xs font-semibold pt-1 border-t border-slate-100 mt-1">
                  <span>Pending Left:</span>
                  <span className={Number(matchedStudent.pending_fees) > 0 ? "text-amber-700 font-bold" : "text-emerald-700 font-bold"}>
                    ₹{Number(matchedStudent.pending_fees).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Previous Arrears */}
              <div className="rounded-lg bg-white/90 p-2.5 border border-blue-100 shadow-2xs">
                <div className="font-semibold text-slate-800 mb-1 text-2xs uppercase tracking-wider">Prior Arrears</div>
                <div className="flex justify-between text-2xs text-slate-600">
                  <span>Prev Due:</span> <span className="font-medium text-slate-900">₹{Number(matchedStudent.previous_fees_due || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-2xs text-slate-600">
                  <span>Prev Paid:</span> <span className="font-medium text-emerald-700">₹{Number(matchedStudent.previous_fees_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-2xs font-semibold pt-1 border-t border-slate-100 mt-1">
                  <span>Arrears Left:</span>
                  <span className={Number(matchedStudent.previous_pending_fees || 0) > 0 ? "text-rose-700 font-bold" : "text-emerald-700 font-bold"}>
                    ₹{Number(matchedStudent.previous_pending_fees || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Overall Total */}
              <div className="rounded-lg bg-white/90 p-2.5 border border-blue-100 shadow-2xs">
                <div className="font-semibold text-slate-800 mb-1 text-2xs uppercase tracking-wider">Cumulative Total</div>
                <div className="flex justify-between text-2xs text-slate-600">
                  <span>Total Due:</span> <span className="font-medium text-slate-900">₹{Number(matchedStudent.overall_total_due || matchedStudent.total_fees_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-2xs text-slate-600">
                  <span>Total Paid:</span> <span className="font-medium text-emerald-700">₹{Number(matchedStudent.overall_total_paid ?? matchedStudent.total_fees_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-2xs font-semibold pt-1 border-t border-slate-100 mt-1">
                  <span>Total Left:</span>
                  <span className={Number(matchedStudent.overall_pending_fees ?? matchedStudent.pending_fees) > 0 ? "text-rose-700 font-bold" : "text-emerald-700 font-bold"}>
                    ₹{Number(matchedStudent.overall_pending_fees ?? matchedStudent.pending_fees).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Payment Category *</label>
            <select
              value={form.payment_for}
              onChange={(e) => {
                const category = e.target.value as any;
                setForm((prev) => {
                  let newUnit = prev.duration_unit;
                  if (category === 'current_year' && matchedStudent?.current_duration_unit) {
                    newUnit = matchedStudent.current_duration_unit;
                  } else if (category === 'previous_due' && matchedStudent) {
                    const prevPendingUnit = matchedStudent.fee_breakdown?.find(b => !b.is_current && b.pending > 0);
                    if (prevPendingUnit) {
                      newUnit = prevPendingUnit.duration_unit;
                    } else if (matchedStudent.current_duration_unit > 1) {
                      newUnit = matchedStudent.current_duration_unit - 1;
                    }
                  }
                  return {
                    ...prev,
                    payment_for: category,
                    duration_unit: newUnit,
                  };
                });
              }}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs"
            >
              <option value="current_year">Current Year Fee</option>
              <option value="previous_due">Previous Due Fee (Arrears)</option>
              <option value="advance">Advance Fee</option>
              <option value="other">Other / Misc Fee</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Course Year *</label>
            <input
              type="number"
              min={1}
              required
              value={form.duration_unit === 0 || form.duration_unit === '0' ? '' : form.duration_unit}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setForm((prev) => ({ ...prev, duration_unit: '' }));
                  return;
                }
                setForm((prev) => ({ ...prev, duration_unit: val.replace(/^0+(?=\d)/, '') }));
              }}
              placeholder="e.g. 1 or 2"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Payment Amount (₹) *</label>
            <input
              type="number"
              min={0.01}
              step={0.01}
              required
              value={form.amount === 0 || form.amount === '0' ? '' : form.amount}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setForm((prev) => ({ ...prev, amount: '' }));
                  return;
                }
                setForm((prev) => ({ ...prev, amount: val.replace(/^0+(?=\d)/, '') }));
              }}
              placeholder="0.00"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs font-bold text-slate-900"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">Note / Payment Remarks (Optional)</label>
          <input
            type="text"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="e.g. Receipt #1049, Cash / UPI reference"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs"
          />
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-2xs"
          >
            {loading ? 'Recording...' : 'Submit Payment'}
          </button>
        </div>
      </form>
      {toast && <Toast message={toast.message} variant={toast.variant} />}
    </Modal>
  );
}
