import React, { useEffect, useMemo, useState } from 'react';
import { fetchCourses } from '../lib/studentApi';
import {
  createFeeStructure,
  deleteFeeStructure,
  fetchFeeStructures,
  updateFeeStructure,
  FeeStructure
} from '../lib/feeStructureApi';
import Toast from '../components/Toast';
import Pagination from '../components/Pagination';

const initialForm = {
  course_code: '',
  academic_year: '',
  duration_unit: 1,
  tuition_fee: 0,
  exam_fee: 0,
  library_fee: 0,
  other_fee: 0
};

export default function FeeStructuresPage() {
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [courses, setCourses] = useState<{ code: string; name: string }[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant?: 'success' | 'error' | 'info' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function loadData() {
    setLoading(true);
    try {
      const [structureList, courseList] = await Promise.all([fetchFeeStructures(), fetchCourses()]);
      setStructures(structureList);
      setCourses(courseList);
    } catch (error) {
      setToast({ message: 'Unable to load fee structures.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.course_code || !form.academic_year || !form.duration_unit) {
      setToast({ message: 'Course, academic year and year are required.', variant: 'error' });
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        await updateFeeStructure(editingId, {
          course_code: form.course_code,
          academic_year: form.academic_year,
          duration_unit: form.duration_unit,
          tuition_fee: form.tuition_fee,
          exam_fee: form.exam_fee,
          library_fee: form.library_fee,
          other_fee: form.other_fee
        });
        setToast({ message: 'Fee structure updated.', variant: 'success' });
      } else {
        await createFeeStructure({
          course_code: form.course_code,
          academic_year: form.academic_year,
          duration_unit: form.duration_unit,
          tuition_fee: form.tuition_fee,
          exam_fee: form.exam_fee,
          library_fee: form.library_fee,
          other_fee: form.other_fee
        });
        setToast({ message: 'Fee structure created.', variant: 'success' });
      }
      setForm(initialForm);
      setEditingId(null);
      await loadData();
    } catch (error) {
      setToast({ message: 'Unable to save fee structure.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  function startEdit(structure: FeeStructure) {
    setEditingId(structure.id);
    setForm({
      course_code: structure.course_code,
      academic_year: structure.academic_year,
      duration_unit: structure.duration_unit,
      tuition_fee: structure.tuition_fee,
      exam_fee: structure.exam_fee,
      library_fee: structure.library_fee,
      other_fee: structure.other_fee
    });
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this fee structure?')) return;
    setLoading(true);
    try {
      await deleteFeeStructure(id);
      await loadData();
      setToast({ message: 'Fee structure removed.', variant: 'success' });
    } catch (error) {
      setToast({ message: 'Unable to delete fee structure.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  const selectedCourseName = useMemo(
    () => courses.find((course) => course.code === form.course_code)?.name || '',
    [courses, form.course_code]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Fee Structure Setup</h1>
          <p className="text-xs text-slate-500">Configure tuition and fee components per course, academic year, and year.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 grid gap-3 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-slate-700">Course</label>
            <select
              value={form.course_code}
              onChange={(e) => setForm({ ...form, course_code: e.target.value })}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
            >
              <option value="">Select course</option>
              {courses.map((course) => (
                <option key={course.code} value={course.code}>{course.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Academic Year</label>
            <input
              type="text"
              value={form.academic_year}
              onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
              placeholder="e.g. 2025-26"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Year</label>
            <input
              type="number"
              min={1}
              value={form.duration_unit}
              onChange={(e) => setForm({ ...form, duration_unit: Number(e.target.value) })}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Tuition Fee (₹)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.tuition_fee}
              onChange={(e) => setForm({ ...form, tuition_fee: Number(e.target.value) })}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Exam Fee (₹)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.exam_fee}
              onChange={(e) => setForm({ ...form, exam_fee: Number(e.target.value) })}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Library Fee (₹)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.library_fee}
              onChange={(e) => setForm({ ...form, library_fee: Number(e.target.value) })}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Other Fee (₹)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.other_fee}
              onChange={(e) => setForm({ ...form, other_fee: Number(e.target.value) })}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
            />
          </div>

          <div className="lg:col-span-4 flex items-center justify-between pt-2">
            <div className="text-xs text-slate-500">
              {selectedCourseName ? `Selected Course: ${selectedCourseName}` : 'Select a course to define fee structure.'}
            </div>
            <div className="flex items-center gap-2">
              {editingId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(initialForm);
                  }}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs transition"
                >
                  Cancel
                </button>
              ) : null}
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-4 py-1.5 text-sm font-medium text-white transition border border-blue-700 shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editingId ? 'Update Structure' : '+ Save Structure'}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="sticky top-0 z-20 rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Configured Fee Structures</h2>
            <p className="text-xs text-slate-500">Course fee configurations saved in the system.</p>
          </div>
          {loading ? <span className="text-xs text-slate-500">Refreshing…</span> : null}
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[350px]">
          <table className="min-w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Course</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Academic Year</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Year</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Tuition</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Exam</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Library</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Other</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Total</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {structures
                .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                .map((structure) => (
                <tr key={structure.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-2 border-b border-slate-100 text-slate-700 font-mono text-xs">{structure.course_code}</td>
                  <td className="px-4 py-2 border-b border-slate-100 text-slate-700 text-xs">{structure.academic_year}</td>
                  <td className="px-4 py-2 border-b border-slate-100 text-slate-700 text-xs">Year {structure.duration_unit}</td>
                  <td className="px-4 py-2 border-b border-slate-100 text-slate-700 text-xs">₹{structure.tuition_fee.toFixed(2)}</td>
                  <td className="px-4 py-2 border-b border-slate-100 text-slate-700 text-xs">₹{structure.exam_fee.toFixed(2)}</td>
                  <td className="px-4 py-2 border-b border-slate-100 text-slate-700 text-xs">₹{structure.library_fee.toFixed(2)}</td>
                  <td className="px-4 py-2 border-b border-slate-100 text-slate-700 text-xs">₹{structure.other_fee.toFixed(2)}</td>
                  <td className="px-4 py-2 border-b border-slate-100 font-semibold text-slate-900 text-xs">₹{structure.total_fee.toFixed(2)}</td>
                  <td className="px-4 py-2 border-b border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => startEdit(structure)}
                        className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 shadow-xs transition"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(structure.id)}
                        className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100 shadow-xs transition"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {structures.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500 border-b border-slate-100 text-xs">
                    No fee structures configured yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {structures.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={structures.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemLabel="fee structures"
          />
        )}
      </div>
      {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}
    </div>
  );
}
