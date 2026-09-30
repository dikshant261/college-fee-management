import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { ExpenseRecord, ExpenseCategory, createExpense, updateExpense } from '../lib/financeApi';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (expense: ExpenseRecord) => void;
  expenseToEdit?: ExpenseRecord | null;
  categories: ExpenseCategory[];
  defaultAcademicYear?: string;
  onOpenCategoryManager?: () => void;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' }
];

export default function ExpenseModal({
  isOpen,
  onClose,
  onSaved,
  expenseToEdit,
  categories,
  defaultAcademicYear = '2025-26',
  onOpenCategoryManager
}: ExpenseModalProps) {
  const isEditing = Boolean(expenseToEdit);

  const [expenseDate, setExpenseDate] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [amount, setAmount] = useState('');
  const [paidTo, setPaidTo] = useState('');
  const [vendor, setVendor] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [status, setStatus] = useState<'paid' | 'pending'>('paid');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (expenseToEdit) {
      setExpenseDate(expenseToEdit.expense_date);
      setCategoryName(expenseToEdit.category_name);
      setAmount(String(expenseToEdit.amount));
      setPaidTo(expenseToEdit.paid_to);
      setVendor(expenseToEdit.vendor || '');
      setPaymentMethod(expenseToEdit.payment_method || 'bank_transfer');
      setStatus(expenseToEdit.status);
      setInvoiceNo(expenseToEdit.invoice_no || '');
      setReferenceNo(expenseToEdit.reference_no || '');
      setDescription(expenseToEdit.description || '');
      setNotes(expenseToEdit.notes || '');
      setAcademicYear(expenseToEdit.academic_year || defaultAcademicYear);
      setAttachmentFile(null);
      setRemoveAttachment(false);
    } else {
      setExpenseDate(new Date().toISOString().split('T')[0]);
      setCategoryName(categories[0]?.name || 'Electricity');
      setAmount('');
      setPaidTo('');
      setVendor('');
      setPaymentMethod('bank_transfer');
      setStatus('paid');
      setInvoiceNo('');
      setReferenceNo('');
      setDescription('');
      setNotes('');
      setAcademicYear(defaultAcademicYear);
      setAttachmentFile(null);
      setRemoveAttachment(false);
    }
    setError(null);
  }, [expenseToEdit, isOpen, defaultAcademicYear, categories]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }
    if (!expenseDate) {
      setError('Please select an expense date');
      return;
    }
    if (!categoryName) {
      setError('Please select an expense category');
      return;
    }
    if (!paidTo.trim()) {
      setError('Please specify who this was paid to');
      return;
    }
    if (status === 'paid' && !paymentMethod) {
      setError('Payment method is required when marking status as Paid');
      return;
    }

    const matchedCategory = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());

    const formData = new FormData();
    formData.append('expense_date', expenseDate);
    formData.append('category_name', categoryName);
    if (matchedCategory) {
      formData.append('category_id', String(matchedCategory.id));
    }
    formData.append('amount', String(parsedAmount));
    formData.append('paid_to', paidTo.trim());
    formData.append('vendor', vendor.trim());
    formData.append('payment_method', paymentMethod);
    formData.append('status', status);
    formData.append('invoice_no', invoiceNo.trim());
    formData.append('reference_no', referenceNo.trim());
    formData.append('description', description.trim());
    formData.append('notes', notes.trim());
    formData.append('academic_year', academicYear.trim());

    if (attachmentFile) {
      formData.append('attachment', attachmentFile);
    }
    if (removeAttachment) {
      formData.append('remove_attachment', 'true');
    }

    setLoading(true);
    try {
      let saved: ExpenseRecord;
      if (isEditing && expenseToEdit) {
        saved = await updateExpense(expenseToEdit.id, formData);
      } else {
        saved = await createExpense(formData);
      }
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to save expense');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Expense Record' : 'Record New Expense'}
      subtitle={
        isEditing
          ? `Updating expense ID #${expenseToEdit?.id}`
          : 'Track outgoing institutional expenditure with payment verification'
      }
      maxWidth="3xl"
      icon={
        <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-medium text-rose-700 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Status Alert Banner */}
        <div
          className={`rounded-lg border p-3 text-xs flex items-center justify-between ${
            status === 'paid'
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
              : 'bg-amber-50/70 border-amber-200 text-amber-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${status === 'paid' ? 'bg-emerald-500' : 'bg-amber-500'}`}
            />
            <span className="font-semibold">
              {status === 'paid'
                ? 'Status: Paid (Will immediately post to Outgoing Transaction Layer)'
                : 'Status: Pending (Recorded as commitment, will NOT inflate actual paid outflow)'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatus('paid')}
              className={`px-2.5 py-1 text-2xs font-semibold rounded transition ${
                status === 'paid'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Paid
            </button>
            <button
              type="button"
              onClick={() => setStatus('pending')}
              className={`px-2.5 py-1 text-2xs font-semibold rounded transition ${
                status === 'pending'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Pending
            </button>
          </div>
        </div>

        {/* Grid 1: Basic Financial Data */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Expense Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Category <span className="text-rose-500">*</span>
              </label>
              {onOpenCategoryManager && (
                <button
                  type="button"
                  onClick={onOpenCategoryManager}
                  className="text-3xs text-blue-600 hover:underline font-medium"
                >
                  + Manage
                </button>
              )}
            </div>
            <select
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Amount (₹ INR) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-semibold text-slate-400">₹</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-md border border-slate-300 pl-7 pr-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Grid 2: Beneficiary & Payment Method */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Paid To (Recipient) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. UPPCL / ABC Stationers"
              value={paidTo}
              onChange={(e) => setPaidTo(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Vendor / Supplier (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. State Electricity Board"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payment Method {status === 'paid' && <span className="text-rose-500">*</span>}
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Grid 3: Accounting & Reference Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Academic Year <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 2025-26"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Invoice / Bill No.
            </label>
            <input
              type="text"
              placeholder="e.g. INV-2026-904"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reference / UTR / Cheque No.
            </label>
            <input
              type="text"
              placeholder="e.g. UTR891230192"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Description & Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description / Purpose
            </label>
            <input
              type="text"
              placeholder="e.g. Library AC compressor repair and gas refilling"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Internal Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Approved by Director; paid via Principal Account"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* File Attachment Upload */}
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-3">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Bill / Receipt Attachment (Image, PDF, Word, Excel up to 10MB)
          </label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <input
              type="file"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setAttachmentFile(e.target.files[0]);
                  setRemoveAttachment(false);
                }
              }}
              className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-50"
            />
            {isEditing && expenseToEdit?.attachment_path && !removeAttachment && (
              <div className="flex items-center gap-2 text-2xs text-slate-600 bg-white border border-slate-200 px-2 py-1 rounded">
                <span>Existing bill attached</span>
                <button
                  type="button"
                  onClick={() => setRemoveAttachment(true)}
                  className="text-rose-600 hover:underline font-semibold"
                >
                  Remove
                </button>
              </div>
            )}
            {removeAttachment && (
              <span className="text-2xs text-rose-600 font-semibold">
                Existing attachment will be removed
              </span>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs transition disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Saving…</span>
              </>
            ) : (
              <span>{isEditing ? 'Save Changes' : 'Record Expense'}</span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
