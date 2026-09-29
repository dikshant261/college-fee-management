import React, { useEffect, useState } from 'react';
import { fetchCourses } from '../lib/studentApi';
import {
  deleteFeeStructure,
  fetchFeeStructures,
  FeeStructure,
} from '../lib/feeStructureApi';
import Toast from '../components/Toast';
import Pagination from '../components/Pagination';
import FeeStructureModal from '../components/FeeStructureModal';

export default function FeeStructuresPage() {
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [courses, setCourses] = useState<{ code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant?: 'success' | 'error' | 'info' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStructure, setSelectedStructure] = useState<FeeStructure | null>(null);

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

  function handleOpenCreate() {
    setSelectedStructure(null);
    setIsModalOpen(true);
  }

  function handleOpenEdit(structure: FeeStructure) {
    setSelectedStructure(structure);
    setIsModalOpen(true);
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Are you sure you want to delete this fee structure?')) return;
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

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Fee Structure Setup</h1>
            <p className="text-xs text-slate-500">Configure tuition and fee components per course, academic year, and year.</p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Configure Fee Structure
          </button>
        </div>
      </div>

      {/* Fee Structures Table Card */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Configured Fee Schedules</h2>
            <p className="text-xs text-slate-500">All registered tuition fee components ({structures.length} total).</p>
          </div>
          {loading ? <span className="text-xs text-slate-500">Updating…</span> : null}
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[350px]">
          <table className="min-w-[950px] w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs whitespace-nowrap min-w-[110px]">Course</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs whitespace-nowrap min-w-[140px]">Academic Session</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs whitespace-nowrap min-w-[100px]">Year</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs whitespace-nowrap min-w-[100px]">Tuition Fee</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs whitespace-nowrap min-w-[100px]">Exam Fee</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs whitespace-nowrap min-w-[100px]">Library Fee</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs whitespace-nowrap min-w-[100px]">Other Fee</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs whitespace-nowrap min-w-[120px]">Total Fee</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs whitespace-nowrap min-w-[140px]">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {structures
                .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                .map((structure) => (
                  <tr key={structure.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-2.5 border-b border-slate-100 text-slate-700 font-semibold text-xs whitespace-nowrap">{structure.course_code}</td>
                    <td className="px-4 py-2.5 border-b border-slate-100 text-slate-700 text-xs font-mono whitespace-nowrap">{structure.academic_year}</td>
                    <td className="px-4 py-2.5 border-b border-slate-100 text-slate-800 text-xs font-semibold whitespace-nowrap">Year {structure.duration_unit}</td>
                    <td className="px-4 py-2.5 border-b border-slate-100 text-slate-700 text-xs whitespace-nowrap">₹{structure.tuition_fee.toFixed(2)}</td>
                    <td className="px-4 py-2.5 border-b border-slate-100 text-slate-700 text-xs whitespace-nowrap">₹{structure.exam_fee.toFixed(2)}</td>
                    <td className="px-4 py-2.5 border-b border-slate-100 text-slate-700 text-xs whitespace-nowrap">₹{structure.library_fee.toFixed(2)}</td>
                    <td className="px-4 py-2.5 border-b border-slate-100 text-slate-700 text-xs whitespace-nowrap">₹{structure.other_fee.toFixed(2)}</td>
                    <td className="px-4 py-2.5 border-b border-slate-100 text-slate-900 font-bold text-xs whitespace-nowrap">₹{structure.total_fee.toFixed(2)}</td>
                    <td className="px-4 py-2.5 border-b border-slate-100 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(structure)}
                          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs transition"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(structure.id)}
                          className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 shadow-xs transition"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              {structures.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500 border-b border-slate-100 text-xs whitespace-nowrap">
                    No fee structures defined yet. Click &quot;Configure Fee Structure&quot; to add one.
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

      {/* Fee Structure Modal */}
      <FeeStructureModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        structure={selectedStructure}
        courses={courses}
        existingStructures={structures}
        onSuccess={loadData}
      />

      {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}
    </div>
  );
}
