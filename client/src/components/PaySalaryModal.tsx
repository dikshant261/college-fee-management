import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { PayrollRecord, formatINR, markPayrollPaid } from '../lib/financeApi';

interface PaySalaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  payroll: PayrollRecord | null;
  onSuccess: (updated: PayrollRecord) => void;
}

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer (NEFT/RTGS/IMPS)' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' }
];

export default function PaySalaryModal({
  isOpen,
  onClose,
  payroll,
  onSuccess
}: PaySalaryModalProps) {
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentDate, setPaymentDate] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (payroll) {
      setPaymentMethod(payroll.payment_method || 'bank_transfer');
      setPaymentDate(payroll.payment_date || new Date().toISOString().split('T')[0]);
      setReferenceNo(payroll.reference_no || '');
      setNotes(payroll.notes || '');
    }
    setError(null);
  }, [payroll, isOpen]);

  if (!payroll) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payroll) return;
    setError(null);

    if (!paymentDate) {
      setError('Please select a payment date');
      return;
    }
    if (!paymentMethod) {
      setError('Please select a payment method');
      return;
    }

    setLoading(true);
    try {
      const updated = await markPayrollPaid(payroll.id, {
        payment_method: paymentMethod,
        payment_date: paymentDate,
        reference_no: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined
      });
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to record salary payment');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Disburse Staff Salary"
      subtitle={`Remittance for ${payroll.employee_name} • ${payroll.month} ${payroll.year}`}
      maxWidth="lg"
      icon={
        <svg className="w-5 h-5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
            {error}
          </div>
        )}

        {/* Amount & Beneficiary Card */}
        <div className="rounded-xl bg-slate-900 text-white p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-2xs text-slate-400 font-semibold uppercase tracking-wider">
              Net Payable Remittance
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-2xs px-2 py-0.5 rounded font-bold">
              {payroll.month} {payroll.year}
            </span>
          </div>
          <div className="text-3xl font-extrabold text-white">
            {formatINR(payroll.net_salary)}
          </div>
          <div className="text-xs text-slate-300 border-t border-slate-800 pt-2 flex items-center justify-between">
            <div>
              <span className="font-semibold text-white">{payroll.employee_name}</span>{' '}
              <span className="text-slate-400">({payroll.emp_code})</span>
            </div>
            <span className="text-slate-400">{payroll.department}</span>
          </div>

          {payroll.account_no && (
            <div className="text-2xs font-mono text-slate-400 bg-slate-800/80 px-2 py-1 rounded">
              Bank: {payroll.bank_name || 'Bank'} • A/C: {payroll.account_no} • IFSC: {payroll.ifsc_code || '—'}
            </div>
          )}
        </div>

        {/* Salary Component Breakdown mini-pills */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg">
            <span className="text-3xs text-slate-400 font-medium block">Basic</span>
            <span className="font-semibold text-slate-700">{formatINR(payroll.basic_salary)}</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-lg">
            <span className="text-3xs text-emerald-600 font-medium block">+ Allowances</span>
            <span className="font-semibold text-emerald-700">{formatINR(payroll.allowances)}</span>
          </div>
          <div className="bg-rose-50 border border-rose-200 p-2 rounded-lg">
            <span className="text-3xs text-rose-600 font-medium block">- Deductions</span>
            <span className="font-semibold text-rose-700">{formatINR(payroll.deductions)}</span>
          </div>
        </div>

        {/* Payment Form Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Payment Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Payment Method <span className="text-rose-500">*</span>
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white focus:border-blue-500 outline-none"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Transaction Reference / UTR / Cheque No.
          </label>
          <input
            type="text"
            placeholder="e.g. UTR1029302919"
            value={referenceNo}
            onChange={(e) => setReferenceNo(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono focus:border-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Notes / Remarks</label>
          <input
            type="text"
            placeholder="e.g. Cleared via institutional payroll account"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-blue-500 outline-none"
          />
        </div>

        <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5 text-2xs text-blue-800">
          ℹ️ When marked paid, this salary transaction will automatically post to the{' '}
          <strong>Outgoing Financial Transactions layer</strong> and increment the monthly institutional outflow.
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-slate-300 bg-white px-3.5 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 shadow-xs transition disabled:opacity-50"
          >
            {loading ? 'Disbursing…' : 'Confirm & Mark Paid'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
