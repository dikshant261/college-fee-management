import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { createCourse, updateCourse, CourseRecord } from '../lib/courseApi';
import Toast from './Toast';

interface CourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: CourseRecord | null;
  onSuccess: () => void;
}

export default function CourseModal({ isOpen, onClose, course, onSuccess }: CourseModalProps) {
  const isEdit = Boolean(course);
  const [form, setForm] = useState({
    code: '',
    name: '',
    duration_type: 'year' as 'year' | 'semester',
    total_duration: 4 as number | string,
  });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant?: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (course) {
      setForm({
        code: course.code,
        name: course.name,
        duration_type: course.duration_type,
        total_duration: course.total_duration,
      });
    } else {
      setForm({ code: '', name: '', duration_type: 'year', total_duration: 4 });
    }
  }, [course, isOpen]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      setToast({ message: 'Course code and name are required.', variant: 'error' });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        duration_type: form.duration_type,
        total_duration: Number(form.total_duration) || 1,
      };

      if (isEdit && course) {
        await updateCourse(course.code, payload);
      } else {
        await createCourse(payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setToast({
        message: err?.response?.data?.error || (isEdit ? 'Failed to update course.' : 'Failed to create course.'),
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
      title={isEdit ? `Edit Course (${course?.code})` : 'Create New Course'}
      subtitle={isEdit ? 'Modify course specifications and duration' : 'Add a new academic course/degree program'}
      maxWidth="md"
      icon={
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700">Course Code *</label>
          <input
            type="text"
            required
            disabled={isEdit}
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="e.g. BCOM, BCA, BTECH"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm uppercase outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100 disabled:text-slate-500 shadow-2xs font-mono"
          />
          {isEdit && <p className="text-2xs text-slate-400 mt-1">Course code cannot be modified once created.</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">Course Name *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Bachelor of Commerce"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Duration Type</label>
            <select
              value={form.duration_type}
              onChange={(e) => setForm({ ...form, duration_type: e.target.value as 'year' | 'semester' })}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs"
            >
              <option value="year">Yearly</option>
              <option value="semester">Semester</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Total Duration</label>
            <input
              type="number"
              min={1}
              max={10}
              required
              value={form.total_duration === 0 || form.total_duration === '0' ? '' : form.total_duration}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setForm({ ...form, total_duration: '' });
                  return;
                }
                const cleaned = val.replace(/^0+(?=\d)/, '');
                setForm({ ...form, total_duration: cleaned });
              }}
              placeholder="e.g. 3 or 4"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs"
            />
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
            {loading ? 'Saving...' : isEdit ? 'Update Course' : 'Create Course'}
          </button>
        </div>
      </form>
      {toast && <Toast message={toast.message} variant={toast.variant} />}
    </Modal>
  );
}
