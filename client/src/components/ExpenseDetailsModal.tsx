import React from 'react';
import Modal from './Modal';
import { ExpenseRecord, formatINR } from '../lib/financeApi';
import { getAssetUrl } from '../lib/api';

interface ExpenseDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: ExpenseRecord | null;
  onEdit?: (expense: ExpenseRecord) => void;
}

export default function ExpenseDetailsModal({
  isOpen,
  onClose,
  expense,
  onEdit
}: ExpenseDetailsModalProps) {
  if (!expense) return null;

  const attachmentUrl = expense.attachment_path ? getAssetUrl(expense.attachment_path) : null;
  const isImageAttachment =
    attachmentUrl &&
    (attachmentUrl.endsWith('.jpg') ||
      attachmentUrl.endsWith('.jpeg') ||
      attachmentUrl.endsWith('.png') ||
      attachmentUrl.endsWith('.webp'));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Expense Voucher Details"
      subtitle={`Voucher #${expense.id} • ${expense.academic_year}`}
      maxWidth="2xl"
      icon={
        <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      }
    >
      <div className="space-y-4">
        {/* Main Amount Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-white shadow-sm gap-3">
          <div>
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400">
              Total Amount Paid / Committed
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5">
              {formatINR(expense.amount)}
            </div>
            <div className="text-xs text-slate-300 mt-1">
              Paid To: <span className="font-semibold text-white">{expense.paid_to}</span>
              {expense.vendor && <span className="text-slate-400"> ({expense.vendor})</span>}
            </div>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-1.5">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                expense.status === 'paid'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full mr-1.5 ${
                  expense.status === 'paid' ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              {expense.status === 'paid' ? 'Paid' : 'Pending'}
            </span>
            <span className="text-2xs text-slate-400 font-mono">
              Academic Year: {expense.academic_year}
            </span>
          </div>
        </div>

        {/* Detailed Information Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-xs">
          <div>
            <span className="text-slate-400 font-medium block">Expense Date</span>
            <span className="font-semibold text-slate-800 mt-0.5 block">{expense.expense_date}</span>
          </div>

          <div>
            <span className="text-slate-400 font-medium block">Category</span>
            <span className="font-semibold text-slate-800 mt-0.5 inline-block bg-white px-2 py-0.5 rounded border border-slate-200">
              {expense.category_name}
            </span>
          </div>

          <div>
            <span className="text-slate-400 font-medium block">Payment Method</span>
            <span className="font-semibold text-slate-800 mt-0.5 uppercase block">
              {expense.payment_method?.replace('_', ' ') || '—'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 font-medium block">Invoice / Bill No.</span>
            <span className="font-mono text-slate-800 mt-0.5 block font-semibold">
              {expense.invoice_no || '—'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 font-medium block">Reference / UTR</span>
            <span className="font-mono text-slate-800 mt-0.5 block font-semibold">
              {expense.reference_no || '—'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 font-medium block">Recorded By</span>
            <span className="font-semibold text-slate-800 mt-0.5 block">
              {expense.created_by_name || 'Administrator'}
            </span>
          </div>
        </div>

        {/* Description & Purpose */}
        {expense.description && (
          <div className="rounded-lg border border-slate-200 bg-white p-3.5 text-xs">
            <span className="font-semibold text-slate-500 uppercase text-3xs tracking-wider block mb-1">
              Description / Purpose
            </span>
            <p className="text-slate-800 font-medium leading-relaxed">{expense.description}</p>
          </div>
        )}

        {/* Internal Notes */}
        {expense.notes && (
          <div className="rounded-lg border border-slate-200 bg-amber-50/40 p-3.5 text-xs">
            <span className="font-semibold text-amber-700 uppercase text-3xs tracking-wider block mb-1">
              Internal Audit Notes
            </span>
            <p className="text-slate-700 leading-relaxed">{expense.notes}</p>
          </div>
        )}

        {/* Bill / Attachment Preview */}
        {attachmentUrl ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
                Bill Attachment Document
              </span>
              <a
                href={attachmentUrl}
                target="_blank"
                rel="noreferrer"
                download
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
              >
                <span>Download / Open</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>

            {isImageAttachment ? (
              <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
                <img
                  src={attachmentUrl}
                  alt="Bill receipt"
                  className="max-h-60 w-auto object-contain mx-auto"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600 font-bold text-xs uppercase">
                  DOC
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    {expense.attachment_path?.split('/').pop()}
                  </p>
                  <p className="text-3xs text-slate-400">Attached receipt or invoice voucher</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
            No receipt or bill attached to this voucher.
          </div>
        )}

        {/* Audit Timestamps */}
        <div className="flex flex-wrap items-center justify-between text-3xs text-slate-400 border-t border-slate-100 pt-2 px-1">
          <span>Created: {expense.created_at}</span>
          <span>Last Updated: {expense.updated_at}</span>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
          {onEdit && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(expense);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Edit Expense</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
