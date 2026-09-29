import React, { useEffect, useState } from 'react';
import { deleteCourse, fetchCourses, CourseRecord } from '../lib/courseApi';
import Toast from '../components/Toast';
import Pagination from '../components/Pagination';
import CourseModal from '../components/CourseModal';

export default function CourseManagementPage() {
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant?: 'success' | 'error' | 'info' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<CourseRecord | null>(null);

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

  function handleOpenCreate() {
    setSelectedCourse(null);
    setIsModalOpen(true);
  }

  function handleOpenEdit(course: CourseRecord) {
    setSelectedCourse(course);
    setIsModalOpen(true);
  }

  async function handleDelete(code: string) {
    if (!window.confirm(`Are you sure you want to delete course '${code}'? This will also remove any linked fee structures.`)) return;
    setLoading(true);
    try {
      await deleteCourse(code);
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
      {/* Top Header Card */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Course Management</h1>
            <p className="text-xs text-slate-500">Configure academic courses, degree types, and duration settings.</p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add New Course
          </button>
        </div>
      </div>

      {/* Courses Table Card */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Available Courses</h2>
            <p className="text-xs text-slate-500">Course definitions configured in the system ({courses.length} total).</p>
          </div>
          {loading ? <span className="text-xs text-slate-500">Refreshing…</span> : null}
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[350px]">
          <table className="min-w-[700px] w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs whitespace-nowrap min-w-[100px]">Code</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs whitespace-nowrap min-w-[220px]">Name</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs whitespace-nowrap min-w-[130px]">Duration Type</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs whitespace-nowrap min-w-[130px]">Total Duration</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs whitespace-nowrap min-w-[140px]">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {courses
                .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                .map((course) => (
                  <tr key={course.code} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-2.5 border-b border-slate-100 text-slate-700 font-mono font-semibold text-xs whitespace-nowrap">{course.code}</td>
                    <td className="px-4 py-2.5 border-b border-slate-100 text-slate-800 font-semibold text-xs whitespace-nowrap">{course.name}</td>
                    <td className="px-4 py-2.5 border-b border-slate-100 text-slate-700 capitalize text-xs whitespace-nowrap">{course.duration_type}ly</td>
                    <td className="px-4 py-2.5 border-b border-slate-100 text-slate-700 text-xs whitespace-nowrap">
                      {course.total_duration} {course.duration_type === 'year' ? 'Years' : 'Semesters'}
                    </td>
                    <td className="px-4 py-2.5 border-b border-slate-100 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(course)}
                          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs transition"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(course.code)}
                          className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 shadow-xs transition"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              {courses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 border-b border-slate-100 text-xs whitespace-nowrap">
                    No courses configured yet. Click &quot;Add New Course&quot; to create one.
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

      {/* Course Modal */}
      <CourseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        course={selectedCourse}
        onSuccess={loadCourses}
      />

      {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}
    </div>
  );
}
