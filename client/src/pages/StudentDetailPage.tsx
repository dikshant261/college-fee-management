import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchStudentById, fetchStudentByRoll } from '../lib/studentApi';
import { getAssetUrl } from '../lib/api';
import Toast from '../components/Toast';

export default function StudentDetailPage() {
  const { id, identifier } = useParams();
  const param = id || identifier;
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant?: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (!param) return;
    loadStudent(param);
  }, [param]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function loadStudent(value: string) {
    setLoading(true);
    try {
      const isNumeric = /^[0-9]+$/.test(value);
      const data = isNumeric ? await fetchStudentById(Number(value)) : await fetchStudentByRoll(value);
      setStudent(data);
    } catch (error) {
      setToast({ message: 'Student not found.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  if (!param) {
    return <div className="min-h-screen bg-slate-50 p-6">Missing student identifier.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Student Details</h1>
          <p className="mt-0.5 text-xs text-slate-500">Review student information, QR code, and fee status.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/students"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs transition"
          >
            Back to List
          </Link>
          {student ? (
            <Link
              to={`/students/${student.id}/edit`}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 border border-blue-700 px-3.5 py-1.5 text-xs font-medium text-white shadow-xs transition"
            >
              Edit Student
            </Link>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Loading student details…</div>
        ) : !student ? (
          <div className="p-10 text-center text-sm text-slate-500">No student information available.</div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex h-64 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white shadow-xs">
                {student.photo_path ? (
                  <img src={getAssetUrl(student.photo_path)} alt={student.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">No photo available</div>
                )}
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-3.5 text-center shadow-xs">
                <p className="text-xs text-slate-600 font-semibold uppercase tracking-wider">Student QR Code</p>
                {student.qr_code ? (
                  <div className="mt-3 flex flex-col items-center">
                    <img src={getAssetUrl(student.qr_code)} alt="QR Code" className="h-44 w-44 rounded-md border border-slate-200 object-contain p-2 bg-white shadow-xs" />
                    <p className="mt-2 text-xs font-mono text-slate-500">{student.college_roll_no}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">Not generated yet</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-xs">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500">College Roll No</p>
                    <p className="text-lg font-bold font-mono text-slate-900">{student.college_roll_no}</p>
                  </div>
                  <span className="rounded bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">{student.course_name || student.course_code}</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-500">Student Name</p>
                    <p className="text-sm font-semibold text-slate-900">{student.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Academic Year</p>
                    <p className="text-sm font-semibold text-slate-900">{student.academic_year}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Current Year</p>
                    <p className="text-sm font-semibold text-slate-900">{student.current_duration_unit}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">University Roll</p>
                    <p className="text-sm font-semibold text-slate-900">{student.university_roll_no || 'Not assigned'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
                <h2 className="text-sm font-semibold text-slate-800">Fees Summary</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Due for Current Year</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">₹{student.total_fees_due.toFixed(2)}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Paid this Year</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">₹{student.total_fees_paid.toFixed(2)}</p>
                  </div>
                  <div className={Number(student.pending_fees) <= 0 ? "rounded-md bg-emerald-50 border border-emerald-200 p-3" : "rounded-md bg-rose-50 border border-rose-200 p-3"}>
                    <p className={Number(student.pending_fees) <= 0 ? "text-xs text-emerald-700 font-semibold" : "text-xs text-rose-600 font-semibold"}>Pending Fees</p>
                    <p className={Number(student.pending_fees) <= 0 ? "mt-1 text-lg font-bold text-emerald-700" : "mt-1 text-lg font-bold text-rose-700"}>
                      {Number(student.pending_fees) <= 0 ? "0 (Paid)" : `₹${Number(student.pending_fees).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Overall Due</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">₹{student.overall_total_due.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-xs">
                <h2 className="text-sm font-semibold text-slate-800">Additional Details</h2>
                <div className="mt-3 space-y-2 text-xs text-slate-700">
                  <p><span className="font-semibold text-slate-900">Phone:</span> {student.phone || 'N/A'}</p>
                  <p><span className="font-semibold text-slate-900">Address:</span> {student.address || 'N/A'}</p>
                  <p><span className="font-semibold text-slate-900">Class / Section:</span> {student.class || '-'} / {student.section || '-'}</p>
                  <p><span className="font-semibold text-slate-900">Record Created:</span> {new Date(student.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}
    </div>
  );
}
