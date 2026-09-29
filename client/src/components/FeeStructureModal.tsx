import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import {
  createFeeStructure,
  updateFeeStructure,
  FeeStructure,
} from '../lib/feeStructureApi';
import { fetchAcademicYears } from '../lib/studentApi';
import Toast from './Toast';

interface FeeStructureModalProps {
  isOpen: boolean;
  onClose: () => void;
  structure: FeeStructure | null;
  courses: { code: string; name: string }[];
  existingStructures?: FeeStructure[];
  onSuccess: () => void;
}

const initialForm = {
  course_code: '',
  academic_year: '',
  duration_unit: 1 as number | string,
  tuition_fee: '' as number | string,
  exam_fee: '' as number | string,
  library_fee: '' as number | string,
  other_fee: '' as number | string,
};

export default function FeeStructureModal({
  isOpen,
  onClose,
  structure,
  courses,
  existingStructures,
  onSuccess,
}: FeeStructureModalProps) {
  const isEdit = Boolean(structure);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant?: 'success' | 'error' } | null>(null);
  const [availableYears, setAvailableYears] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchAcademicYears()
        .then((yrs) => {
          if (yrs && yrs.length > 0) setAvailableYears(yrs);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const matchingExisting = React.useMemo(() => {
    if (isEdit || !existingStructures || !form.course_code || !form.academic_year) return null;
    return existingStructures.find(
      (s) =>
        s.course_code === form.course_code &&
        s.academic_year.trim().toLowerCase() === String(form.academic_year).trim().toLowerCase() &&
        Number(s.duration_unit) === Number(form.duration_unit)
    ) || null;
  }, [isEdit, existingStructures, form.course_code, form.academic_year, form.duration_unit]);

  useEffect(() => {
    if (structure) {
      setForm({
        course_code: structure.course_code,
        academic_year: structure.academic_year,
        duration_unit: structure.duration_unit,
        tuition_fee: structure.tuition_fee === 0 ? '' : structure.tuition_fee,
        exam_fee: structure.exam_fee === 0 ? '' : structure.exam_fee,
        library_fee: structure.library_fee === 0 ? '' : structure.library_fee,
        other_fee: structure.other_fee === 0 ? '' : structure.other_fee,
      });
    } else {
      setForm({
        ...initialForm,
        course_code: courses.length > 0 ? courses[0].code : '',
        academic_year: '2026-27',
      });
    }
  }, [structure, courses, isOpen]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const totalFeePreview =
    (Number(form.tuition_fee) || 0) +
    (Number(form.exam_fee) || 0) +
    (Number(form.library_fee) || 0) +
    (Number(form.other_fee) || 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.course_code || !form.academic_year || !form.duration_unit) {
      setToast({ message: 'Course, academic year, and year are required.', variant: 'error' });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        course_code: form.course_code,
        academic_year: form.academic_year.trim(),
        duration_unit: Number(form.duration_unit) || 1,
        tuition_fee: Number(form.tuition_fee) || 0,
        exam_fee: Number(form.exam_fee) || 0,
        library_fee: Number(form.library_fee) || 0,
        other_fee: Number(form.other_fee) || 0,
      };

      if (isEdit && structure) {
        await updateFeeStructure(structure.id, payload);
      } else {
        await createFeeStructure(payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setToast({
        message: err?.response?.data?.error || (isEdit ? 'Failed to update fee structure.' : 'Failed to create fee structure.'),
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
      title={isEdit ? `Edit Fee Structure (#${structure?.id})` : 'Configure New Fee Structure'}
      subtitle={isEdit ? 'Update component dues and academic period' : 'Define tuition, exam, and library fees per year'}
      maxWidth="2xl"
      icon={
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Course *</label>
            <select
              required
              value={form.course_code}
              onChange={(e) => setForm({ ...form, course_code: e.target.value })}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs"
            >
              <option value="">Select course…</option>
              {courses.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Academic Session *</label>
            <input
              type="text"
              required
              list="academic-session-options"
              value={form.academic_year}
              onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
              placeholder="e.g. 2026-27"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs font-mono"
            />
            <datalist id="academic-session-options">
              {availableYears.map((yr) => (
                <option key={yr} value={yr} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Course Year *</label>
            <input
              type="number"
              min={1}
              max={6}
              required
              value={form.duration_unit === 0 || form.duration_unit === '0' ? '' : form.duration_unit}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setForm({ ...form, duration_unit: '' });
                  return;
                }
                const cleaned = val.replace(/^0+(?=\d)/, '');
                setForm({ ...form, duration_unit: cleaned });
              }}
              placeholder="e.g. 1"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs font-mono"
            />
          </div>
        </div>

        {matchingExisting && (
          <div className="flex items-center justify-between gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
            <div className="flex items-center gap-2 min-w-0">
              <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="truncate">
                A fee schedule for <strong>{form.course_code} ({form.academic_year}, Year {form.duration_unit})</strong> is already configured. Saving will update it.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setForm((prev) => ({
                  ...prev,
                  tuition_fee: matchingExisting.tuition_fee === 0 ? '' : matchingExisting.tuition_fee,
                  exam_fee: matchingExisting.exam_fee === 0 ? '' : matchingExisting.exam_fee,
                  library_fee: matchingExisting.library_fee === 0 ? '' : matchingExisting.library_fee,
                  other_fee: matchingExisting.other_fee === 0 ? '' : matchingExisting.other_fee,
                }));
              }}
              className="text-2xs font-semibold text-amber-800 underline hover:text-amber-950 shrink-0"
            >
              Load Values
            </button>
          </div>
        )}

        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Fee Component Breakdown (₹)</h4>
            <span className="text-2xs text-slate-500 font-medium">All components combine into annual fee</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tuition Fee</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs font-semibold">₹</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.tuition_fee === 0 || form.tuition_fee === '0' ? '' : form.tuition_fee}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setForm({ ...form, tuition_fee: '' });
                      return;
                    }
                    setForm({ ...form, tuition_fee: val.replace(/^0+(?=\d)/, '') });
                  }}
                  placeholder="0.00"
                  className="w-full rounded-md border border-slate-300 bg-white pl-7 pr-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Exam Fee</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs font-semibold">₹</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.exam_fee === 0 || form.exam_fee === '0' ? '' : form.exam_fee}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setForm({ ...form, exam_fee: '' });
                      return;
                    }
                    setForm({ ...form, exam_fee: val.replace(/^0+(?=\d)/, '') });
                  }}
                  placeholder="0.00"
                  className="w-full rounded-md border border-slate-300 bg-white pl-7 pr-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Library Fee</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs font-semibold">₹</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.library_fee === 0 || form.library_fee === '0' ? '' : form.library_fee}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setForm({ ...form, library_fee: '' });
                      return;
                    }
                    setForm({ ...form, library_fee: val.replace(/^0+(?=\d)/, '') });
                  }}
                  placeholder="0.00"
                  className="w-full rounded-md border border-slate-300 bg-white pl-7 pr-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Other / Misc Fee</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs font-semibold">₹</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.other_fee === 0 || form.other_fee === '0' ? '' : form.other_fee}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setForm({ ...form, other_fee: '' });
                      return;
                    }
                    setForm({ ...form, other_fee: val.replace(/^0+(?=\d)/, '') });
                  }}
                  placeholder="0.00"
                  className="w-full rounded-md border border-slate-300 bg-white pl-7 pr-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-xs">
            <span className="font-semibold text-slate-700">Computed Total Annual Fee:</span>
            <span className="text-base font-bold text-blue-700 font-mono">
              ₹{totalFeePreview.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
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
            {loading ? 'Saving...' : (isEdit || matchingExisting) ? 'Update Fee Structure' : 'Save Fee Structure'}
          </button>
        </div>
      </form>
      {toast && <Toast message={toast.message} variant={toast.variant} />}
    </Modal>
  );
}
