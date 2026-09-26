import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Course, Student, fetchAcademicYears, fetchCourses, fetchStudents, deleteStudent } from '../lib/studentApi';
import { getAssetUrl } from '../lib/api';
import Toast from '../components/Toast';
import Pagination from '../components/Pagination';

export default function StudentListPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [currentYearFilter, setCurrentYearFilter] = useState('');
  const [feeFilter, setFeeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant?: 'success' | 'error' | 'info' } | null>(null);
  const navigate = useNavigate();

  const selectedCourse = useMemo(() => {
    return courses.find((c) => c.code === courseFilter);
  }, [courses, courseFilter]);

  const currentYearOptions = useMemo(() => {
    const max = selectedCourse ? selectedCourse.total_duration : 6;
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [selectedCourse]);

  // Sliced students for current page
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return students.slice(start, start + pageSize);
  }, [students, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
    loadData();
  }, [courseFilter, yearFilter, currentYearFilter, feeFilter]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function loadData() {
    setLoading(true);
    try {
      const [courseList, academicYears, studentList] = await Promise.all([
        fetchCourses(),
        fetchAcademicYears(),
        fetchStudents({
          q: search || undefined,
          course: courseFilter || undefined,
          academic_year: yearFilter || undefined,
          current_duration_unit: currentYearFilter ? Number(currentYearFilter) : undefined,
          fee_status: feeFilter || undefined
        })
      ]);
      setCourses(courseList);
      setYears(academicYears);
      setStudents(studentList);
    } catch (error) {
      setToast({ message: 'Unable to load students. Try again.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCurrentPage(1);
    loadData();
  }

  async function handleDelete(id: number, name: string) {
    const confirmed = window.confirm(`Delete ${name}? This is a soft delete.`);
    if (!confirmed) return;
    try {
      await deleteStudent(id);
      setToast({ message: 'Student deleted.', variant: 'success' });
      await loadData();
    } catch (error) {
      setToast({ message: 'Unable to delete student.', variant: 'error' });
    }
  }

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-5 py-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Student Directory</h1>
          <p className="text-xs text-slate-500">Manage enrolled students, academic records, and fee balances.</p>
        </div>
        <button
          onClick={() => navigate('/students/new')}
          className="inline-flex items-center justify-center rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-4 py-2 text-sm font-medium text-white transition border border-blue-700 shadow-xs"
        >
          + New Student
        </button>
      </div>

      {/* Filter Card */}
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
        <form onSubmit={handleSearch}>
          <label className="block text-xs font-medium text-slate-700">Search Students</label>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, roll number, or 'pending' / 'fee left'"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
            />
            <button type="submit" className="rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-4 py-1.5 text-sm font-medium text-white transition border border-blue-700 shadow-xs">
              Search
            </button>
          </div>
        </form>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-slate-700">Fee Status</label>
            <select
              value={feeFilter}
              onChange={(e) => setFeeFilter(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
            >
              <option value="">All Fees</option>
              <option value="pending">Fee Pending (Left)</option>
              <option value="paid">Fee Paid</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Course</label>
            <select
              value={courseFilter}
              onChange={(e) => {
                setCourseFilter(e.target.value);
                setCurrentYearFilter('');
              }}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
            >
              <option value="">All courses</option>
              {courses.map((course) => (
                <option key={course.code} value={course.code}>{course.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Course Year</label>
            <select
              value={currentYearFilter}
              onChange={(e) => setCurrentYearFilter(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
            >
              <option value="">All course years</option>
              {currentYearOptions.map((yearValue) => (
                <option key={yearValue} value={yearValue}>
                  {selectedCourse?.duration_type === 'semester' ? `Semester ${yearValue}` : `Year ${yearValue}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Academic Year</label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
            >
              <option value="">All years</option>
              {years.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table Section with Fixed Height, Internal Scroll, Sticky Header, and Pagination */}
      <div className="sticky top-0 z-20 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
        {loading ? (
          <div className="p-10 text-center text-slate-500">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-r-transparent"></div>
            <p className="mt-2 text-xs font-medium">Loading records…</p>
          </div>
        ) : students.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-base font-semibold text-slate-900">No students found</p>
            <p className="mt-1 text-xs text-slate-500">
              {feeFilter === 'pending'
                ? 'No students found with pending fees.'
                : 'Create a new student or adjust your search filters.'}
            </p>
            {feeFilter || search || courseFilter || currentYearFilter || yearFilter ? (
              <button
                onClick={() => {
                  setSearch('');
                  setFeeFilter('');
                  setCourseFilter('');
                  setCurrentYearFilter('');
                  setYearFilter('');
                  setCurrentPage(1);
                }}
                className="mt-3 rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs"
              >
                Clear Filters
              </button>
            ) : (
              <button
                onClick={() => navigate('/students/new')}
                className="mt-3 rounded-md bg-blue-600 hover:bg-blue-700 px-4 py-1.5 text-xs font-medium text-white border border-blue-700 shadow-xs"
              >
                Add First Student
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Scrollable Table Area with Fixed Max-Height and Sticky Header */}
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-240px)] min-h-[350px]">
              <table className="min-w-full text-sm border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Photo</th>
                    <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Roll No</th>
                    <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Name</th>
                    <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Course</th>
                    <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Current Year</th>
                    <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Total Fee</th>
                    <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Pending Fee</th>
                    <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">QR Code</th>
                    <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {paginatedStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-2 align-middle border-b border-slate-100">
                        <div className="h-9 w-9 overflow-hidden rounded-md bg-slate-100 border border-slate-200">
                          {student.photo_path ? (
                            <img src={getAssetUrl(student.photo_path)} alt={student.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-400">
                              {student.name.charAt(0)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 align-middle border-b border-slate-100 text-slate-900 font-semibold font-mono text-xs">{student.college_roll_no}</td>
                      <td className="px-4 py-2 align-middle border-b border-slate-100 text-slate-800 font-medium text-xs">{student.name}</td>
                      <td className="px-4 py-2 align-middle border-b border-slate-100 text-slate-700 text-xs">{student.course_name || student.course_code}</td>
                      <td className="px-4 py-2 align-middle border-b border-slate-100 text-slate-700 text-xs">Unit {student.current_duration_unit}</td>
                      <td className="px-4 py-2 align-middle border-b border-slate-100 font-semibold text-slate-900 text-xs">
                        ₹{Number(student.total_fees_due || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2 align-middle border-b border-slate-100">
                        {Number(student.pending_fees) <= 0 ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            0
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-medium text-red-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                            ₹{Number(student.pending_fees).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Left
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 align-middle border-b border-slate-100">
                        {student.qr_code ? (
                          <img src={getAssetUrl(student.qr_code)} alt="QR code" className="h-9 w-9 rounded-md border border-slate-200 object-contain bg-white p-0.5" />
                        ) : (
                          <span className="text-2xs text-slate-400">None</span>
                        )}
                      </td>
                      <td className="px-4 py-2 align-middle border-b border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <Link to={`/students/${student.id}`} className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs transition">
                            View
                          </Link>
                          <Link to={`/students/${student.id}/edit`} className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 shadow-xs transition">
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(student.id, student.name)}
                            className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100 shadow-xs transition"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Component with 10 to 100 Page Size Dropdown */}
            <Pagination
              currentPage={currentPage}
              totalItems={students.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              itemLabel="students"
            />
          </>
        )}
      </div>

      {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}
    </div>
  );
}
