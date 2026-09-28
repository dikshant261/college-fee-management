import React, { useEffect, useState } from 'react';
import { createCourse, deleteCourse, fetchCourses, updateCourse, CourseRecord } from '../lib/courseApi';
import Toast from '../components/Toast';
import Pagination from '../components/Pagination';

export default function CourseManagementPage() {
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', duration_type: 'year' as 'year' | 'semester', total_duration: 4 as number | string });
  const [toast, setToast] = useState<{ message: string; variant?: 'success' | 'error' | 'info' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [editingCode, setEditingCode] = useState<string | null>(null);

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function loadCourses() {
    setLoading(true);
    try {
      const list = await fetchCourses();
      setCourses(list);
    } catch (error) {
      setToast({ message: 'Unable to load courses.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  function handleStartEdit(course: CourseRecord) {
    setEditingCode(course.code);
    setForm({
      code: course.code,
      name: course.name,
      duration_type: course.duration_type,
      total_duration: course.total_duration,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCancelEdit() {
    setEditingCode(null);
    setForm({ code: '', name: '', duration_type: 'year', total_duration: 4 });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.code || !form.name) {
      setToast({ message: 'Course code and name are required.', variant: 'error' });
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        total_duration: Number(form.total_duration) || 1
      };
      if (editingCode) {
        await updateCourse(editingCode, payload);
        setToast({ message: 'Course updated successfully.', variant: 'success' });
        handleCancelEdit();
        await loadCourses();
      } else {
        await createCourse(payload);
        setToast({ message: 'Course created successfully.', variant: 'success' });
        setForm({ code: '', name: '', duration_type: 'year', total_duration: 4 });
        await loadCourses();
      }
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error || (editingCode ? 'Unable to update course.' : 'Unable to create course.');
      setToast({ message: errorMsg, variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(code: string) {
    if (!window.confirm(`Are you sure you want to delete course '${code}'? This will also remove any linked fee structures.`)) return;
    setLoading(true);
    try {
      await deleteCourse(code);
      if (editingCode === code) {
        handleCancelEdit();
      }
      await loadCourses();
      setToast({ message: 'Course deleted successfully.', variant: 'success' });
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error || 'Unable to delete course.';
      setToast({ message: errorMsg, variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {editingCode ? `Edit Course: ${editingCode}` : 'Course Management'}
            </h1>
            <p className="text-xs text-slate-500">
              {editingCode
                ? 'Update course code, title, duration type, and total duration (years) below.'
                : 'Configure academic courses, degree types, and duration settings.'}
            </p>
          </div>
          {editingCode ? (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="self-start rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs transition"
            >
              Cancel Edit
            </button>
          ) : null}
        </div>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3 lg:grid-cols-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-700">Course Code</label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="e.g. CS or B.A."
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Course Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Computer Science"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Duration Type</label>
            <select
              value={form.duration_type}
              onChange={(e) => setForm({ ...form, duration_type: e.target.value as 'year' | 'semester' })}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
            >
              <option value="year">Yearly System</option>
              <option value="semester">Semester System</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Total Duration (Years)</label>
            <input
              type="number"
              min={1}
              value={form.total_duration === 0 || form.total_duration === '0' ? '' : form.total_duration}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setForm((prev) => ({ ...prev, total_duration: '' }));
                  return;
                }
                const cleaned = val.replace(/^0+(?=\d)/, '');
                setForm((prev) => ({ ...prev, total_duration: cleaned }));
              }}
              placeholder="e.g. 3 or 4"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
            />
          </div>

          <div className="col-span-full flex items-center gap-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-4 py-1.5 text-sm font-medium text-white transition border border-blue-700 shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Saving…' : editingCode ? 'Update Course' : '+ Create Course'}
            </button>
            {editingCode ? (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-xs transition"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="sticky top-0 z-20 rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Available Courses</h2>
            <p className="text-xs text-slate-500">Course definitions configured in the system.</p>
          </div>
          {loading ? <span className="text-xs text-slate-500">Refreshing…</span> : null}
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[350px]">
          <table className="min-w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Code</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Name</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Duration Type</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Total Duration</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {courses
                .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                .map((course) => (
                <tr
                  key={course.code}
                  className={`hover:bg-slate-50 transition ${editingCode === course.code ? 'bg-blue-50/60' : ''}`}
                >
                  <td className="px-4 py-2 border-b border-slate-100 font-semibold text-slate-900 font-mono text-xs">{course.code}</td>
                  <td className="px-4 py-2 border-b border-slate-100 text-slate-700 text-xs">{course.name}</td>
                  <td className="px-4 py-2 border-b border-slate-100 text-slate-700 text-xs capitalize">{course.duration_type}</td>
                  <td className="px-4 py-2 border-b border-slate-100 text-slate-700 text-xs">{course.total_duration}</td>
                  <td className="px-4 py-2 border-b border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(course)}
                        className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 shadow-xs transition"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(course.code)}
                        className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100 shadow-xs transition"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {courses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 border-b border-slate-100 text-xs">
                    No courses configured yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {courses.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={courses.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemLabel="courses"
          />
        )}
      </div>
      {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}
    </div>
  );
}
