import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchStudentById, fetchStudentByRoll, Student } from '../lib/studentApi';
import { fetchFeePayments, FeePaymentRecord } from '../lib/feeApi';
import { getAssetUrl } from '../lib/api';
import Toast from '../components/Toast';
import StudentModal from '../components/StudentModal';
import PaymentModal from '../components/PaymentModal';

export default function StudentDetailPage() {
  const { id, identifier } = useParams();
  const param = id || identifier;
  const [student, setStudent] = useState<Student | null>(null);
  const [payments, setPayments] = useState<FeePaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant?: 'success' | 'error' | 'info' } | null>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [mobileTableView, setMobileTableView] = useState(false);

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
      if (data?.id) {
        loadPayments(data.id);
      }
    } catch (error) {
      setToast({ message: 'Student not found.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function loadPayments(studentId: number | string) {
    setLoadingPayments(true);
    try {
      const list = await fetchFeePayments({ student_id: studentId });
      setPayments(list || []);
    } catch {
      // payments list non-critical
    } finally {
      setLoadingPayments(false);
    }
  }

  if (!param) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        Missing student identifier.
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-full overflow-hidden">
      {/* =========================================================================
          TOP ACTION BAR & BREADCRUMBS
          ========================================================================= */}
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3.5 sm:px-5 sm:py-4 shadow-xs print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            to="/students"
            className="inline-flex h-8 w-8 sm:h-auto sm:w-auto items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition shrink-0"
            title="Return to Student List"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden sm:inline">Students</span>
          </Link>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
              {student ? student.name : 'Student Details'}
            </h1>
            <p className="text-2xs sm:text-xs text-slate-500 truncate">
              {student ? (
                <>
                  Roll No: <span className="font-mono font-semibold text-slate-700">{student.college_roll_no}</span> &bull;{' '}
                  {student.course_name || student.course_code} &bull; Year {student.current_duration_unit}
                </>
              ) : (
                'Academic Profile and Fee Statements'
              )}
            </p>
          </div>
        </div>

        {student && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Edit Student Button */}
            <button
              type="button"
              onClick={() => setIsStudentModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
            >
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Edit</span>
            </button>

            {/* Record Fee Payment Button */}
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 border border-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Record Fee</span>
            </button>
          </div>
        )}
      </div>

      {/* =========================================================================
          MAIN BODY: Loading State or Profile Cards
          ========================================================================= */}
      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-xs">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs font-medium">Loading student profile…</p>
        </div>
      ) : !student ? (
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-xs">
          No student information available.
        </div>
      ) : (
        <div className="space-y-4">
          {/* =====================================================================
              1. STUDENT PROFILE HERO CARD (Responsive across mobile, tablet, desktop)
              ===================================================================== */}
          <div className="rounded-lg border border-slate-200 bg-white p-3.5 sm:p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Left / Middle: Photo + Student Information */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3.5 sm:gap-5 min-w-0 flex-1">
                {/* Profile Photo */}
                <div className="relative shrink-0">
                  <div className="h-20 w-20 sm:h-28 sm:w-28 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shadow-xs flex items-center justify-center">
                    {student.photo_path ? (
                      <img
                        src={getAssetUrl(student.photo_path)}
                        alt={student.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-300">
                        <svg className="w-10 h-10 sm:w-14 sm:h-14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="text-3xs text-slate-400">No Photo</span>
                      </div>
                    )}
                  </div>
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white text-white text-3xs font-bold" title="Active Student">
                    ✓
                  </span>
                </div>

                {/* Primary Identity Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-mono font-bold text-blue-700">
                      {student.college_roll_no}
                    </span>
                    <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                      {student.course_name || student.course_code}
                    </span>
                    <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                      Year {student.current_duration_unit}
                    </span>
                  </div>

                  <h2 className="mt-1.5 text-lg sm:text-xl font-bold text-slate-900 truncate">
                    {student.name}
                  </h2>

                  {/* Key Metadata Grid */}
                  <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-2xs sm:text-xs text-slate-600">
                    <div className="rounded-md bg-slate-50 border border-slate-200/70 p-2 min-w-0">
                      <span className="block text-slate-400 text-3xs uppercase font-semibold">Academic Session</span>
                      <span className="font-mono font-semibold text-slate-800 truncate block mt-0.5">{student.academic_year}</span>
                    </div>

                    <div className="rounded-md bg-slate-50 border border-slate-200/70 p-2 min-w-0">
                      <span className="block text-slate-400 text-3xs uppercase font-semibold">University Roll</span>
                      <span className="font-mono font-semibold text-slate-800 truncate block mt-0.5">
                        {student.university_roll_no || 'Not Assigned'}
                      </span>
                    </div>

                    <div className="rounded-md bg-slate-50 border border-slate-200/70 p-2 min-w-0">
                      <span className="block text-slate-400 text-3xs uppercase font-semibold">Phone</span>
                      {student.phone ? (
                        <a href={`tel:${student.phone}`} className="font-semibold text-blue-600 hover:underline truncate block mt-0.5">
                          {student.phone}
                        </a>
                      ) : (
                        <span className="text-slate-400 truncate block mt-0.5">Not Provided</span>
                      )}
                    </div>

                    <div className="rounded-md bg-slate-50 border border-slate-200/70 p-2 min-w-0">
                      <span className="block text-slate-400 text-3xs uppercase font-semibold">Class &amp; Section</span>
                      <span className="font-semibold text-slate-800 truncate block mt-0.5">
                        {student.class || '-'} {student.section ? `(${student.section})` : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Digital Student ID & QR Card */}
              <div className="flex md:flex-col items-center justify-between sm:justify-center p-3 rounded-lg border border-slate-200 bg-slate-50/70 md:w-44 shrink-0 gap-2 text-center">
                <div className="flex items-center gap-3 md:flex-col">
                  {student.qr_code ? (
                    <button
                      type="button"
                      onClick={() => setIsQrModalOpen(true)}
                      className="group relative block focus:outline-none"
                      title="Click to view & scan Digital ID"
                    >
                      <img
                        src={getAssetUrl(student.qr_code)}
                        alt="QR Code"
                        className="h-20 w-20 sm:h-22 sm:w-22 rounded-md border border-slate-200 bg-white p-1 shadow-2xs group-hover:border-blue-400 transition"
                      />
                      <span className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 rounded-md transition flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-700 bg-white/90 rounded-full p-0.5 shadow-xs" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                      </span>
                    </button>
                  ) : (
                    <div className="h-20 w-20 flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-300 text-3xs">
                      No QR
                    </div>
                  )}

                  <div className="text-left md:text-center">
                    <p className="text-2xs font-bold uppercase tracking-wider text-slate-700">Digital ID</p>
                    <p className="text-3xs text-slate-500">Scan to verify dues</p>
                  </div>
                </div>

                {student.qr_code && (
                  <button
                    type="button"
                    onClick={() => setIsQrModalOpen(true)}
                    className="md:w-full inline-flex items-center justify-center gap-1 rounded bg-white border border-slate-200 px-2 py-1 text-3xs font-medium text-slate-700 hover:bg-slate-100 shadow-2xs transition"
                  >
                    View QR Card
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* =====================================================================
              2. FEES SUMMARY & BALANCE CARDS (Fully Responsive 4-Card Grid)
              ===================================================================== */}
          <div className="rounded-lg border border-slate-200 bg-white p-3.5 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Fees Summary &amp; Balance</h3>
                <p className="text-2xs text-slate-500">Live breakdown of current dues, prior arrears, and total tenure balance</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition w-full sm:w-auto shrink-0 print:hidden"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Record Fee Payment
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
              {/* Card 1: Current Year Fees */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">Current Year</span>
                    <span className="rounded bg-blue-100 text-blue-800 px-1.5 py-0.5 text-3xs font-bold">
                      Year {student.current_duration_unit}
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-base sm:text-lg lg:text-xl font-bold font-mono tracking-tight text-slate-900 truncate">
                      ₹{Number(student.total_fees_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-3xs text-slate-400">Total fees set for this year</p>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-2xs">
                  <span className="text-slate-500">
                    Paid: <strong className="text-emerald-700">₹{Number(student.total_fees_paid).toLocaleString('en-IN')}</strong>
                  </span>
                  <span className={Number(student.pending_fees) > 0 ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold'}>
                    {Number(student.pending_fees) > 0
                      ? `₹${Number(student.pending_fees).toLocaleString('en-IN')} Left`
                      : 'Cleared'}
                  </span>
                </div>
              </div>

              {/* Card 2: Previous Years Arrears */}
              <div
                className={`rounded-lg border p-3.5 flex flex-col justify-between ${
                  Number(student.previous_pending_fees || 0) > 0
                    ? 'border-rose-200 bg-rose-50/60'
                    : 'border-slate-200 bg-slate-50/70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-2xs font-semibold uppercase tracking-wider ${
                        Number(student.previous_pending_fees || 0) > 0 ? 'text-rose-700' : 'text-slate-500'
                      }`}
                    >
                      Prior Years Dues
                    </span>
                    {Number(student.previous_pending_fees || 0) > 0 ? (
                      <span className="rounded bg-rose-100 text-rose-800 px-1.5 py-0.5 text-3xs font-bold">
                        Arrears
                      </span>
                    ) : (
                      <span className="rounded bg-slate-200 text-slate-600 px-1.5 py-0.5 text-3xs font-medium">
                        None
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <p className="text-base sm:text-lg lg:text-xl font-bold font-mono tracking-tight text-slate-900 truncate">
                      ₹{Number(student.previous_fees_due || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-3xs text-slate-400">Total fees from previous sessions</p>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-2xs">
                  <span className="text-slate-500">
                    Paid: <strong className="text-emerald-700">₹{Number(student.previous_fees_paid || 0).toLocaleString('en-IN')}</strong>
                  </span>
                  <span
                    className={
                      Number(student.previous_pending_fees || 0) > 0 ? 'text-rose-700 font-bold' : 'text-emerald-700 font-semibold'
                    }
                  >
                    {Number(student.previous_pending_fees || 0) > 0
                      ? `₹${Number(student.previous_pending_fees).toLocaleString('en-IN')} Due`
                      : 'No Arrears'}
                  </span>
                </div>
              </div>

              {/* Card 3: Overall Course Total */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">Cumulative Course Total</span>
                    <span className="rounded bg-slate-200 text-slate-700 px-1.5 py-0.5 text-3xs font-medium">
                      All Years
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-base sm:text-lg lg:text-xl font-bold font-mono tracking-tight text-slate-900 truncate">
                      ₹{Number(student.overall_total_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-3xs text-slate-400">Aggregate curriculum fees</p>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-2xs">
                  <span className="text-slate-500">Tenure Paid:</span>
                  <strong className="text-emerald-700 font-mono">
                    ₹{Number(student.overall_total_paid).toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>

              {/* Card 4: Total Outstanding Balance Left */}
              <div
                className={`rounded-lg border p-3.5 flex flex-col justify-between ${
                  Number(student.overall_pending_fees ?? student.pending_fees) <= 0
                    ? 'border-emerald-300 bg-emerald-50/70'
                    : 'border-rose-300 bg-rose-50/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-2xs font-bold uppercase tracking-wider ${
                        Number(student.overall_pending_fees ?? student.pending_fees) <= 0 ? 'text-emerald-800' : 'text-rose-800'
                      }`}
                    >
                      Total Outstanding Balance
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-3xs font-bold ${
                        Number(student.overall_pending_fees ?? student.pending_fees) <= 0
                          ? 'bg-emerald-200 text-emerald-800'
                          : 'bg-rose-200 text-rose-800'
                      }`}
                    >
                      {Number(student.overall_pending_fees ?? student.pending_fees) <= 0 ? 'Settled' : 'Pending'}
                    </span>
                  </div>
                  <div className="mt-2">
                    <p
                      className={`text-base sm:text-lg lg:text-xl font-bold font-mono tracking-tight truncate ${
                        Number(student.overall_pending_fees ?? student.pending_fees) <= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {Number(student.overall_pending_fees ?? student.pending_fees) <= 0
                        ? '₹0.00 (All Cleared)'
                        : `₹${Number(student.overall_pending_fees ?? student.pending_fees).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                          })}`}
                    </p>
                    <p className="text-3xs text-slate-500">Remaining to clear course</p>
                  </div>
                </div>

                <div
                  className={`mt-3 pt-2.5 border-t text-2xs truncate ${
                    Number(student.overall_pending_fees ?? student.pending_fees) <= 0
                      ? 'border-emerald-200 text-emerald-700 font-medium'
                      : 'border-rose-200 text-rose-700 font-semibold'
                  }`}
                >
                  {Number(student.previous_pending_fees || 0) > 0 ? (
                    <span>
                      (₹{Number(student.previous_pending_fees).toLocaleString('en-IN')} Prev + ₹
                      {Number(student.pending_fees).toLocaleString('en-IN')} Curr)
                    </span>
                  ) : Number(student.overall_pending_fees ?? student.pending_fees) <= 0 ? (
                    'All academic sessions fully paid'
                  ) : (
                    'Current year fee pending'
                  )}
                </div>
              </div>
            </div>

            {/* =====================================================================
                3. ACADEMIC SESSIONS & YEAR-BY-YEAR FEE BREAKDOWN
                Dual View: Card-based on mobile, Full table on tablet & desktop
                ===================================================================== */}
            {student.fee_breakdown && student.fee_breakdown.length > 0 && (
              <div className="mt-5 pt-5 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Academic Sessions &amp; Year-by-Year Breakdown
                    </h4>
                    <p className="text-3xs sm:text-2xs text-slate-500">
                      Detailed ledger for every registered academic year of the curriculum
                    </p>
                  </div>
                  {/* Mobile toggle button */}
                  <div className="sm:hidden flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setMobileTableView((prev) => !prev)}
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-2xs font-medium text-slate-700"
                    >
                      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                      <span>{mobileTableView ? 'Switch to Card View' : 'Switch to Table View'}</span>
                    </button>
                  </div>
                </div>

                {/* --- MOBILE CARDS VIEW (Clean & intuitive on phones without scrolling) --- */}
                <div className={`sm:hidden space-y-2.5 ${mobileTableView ? 'hidden' : 'block'}`}>
                  {student.fee_breakdown.map((item) => (
                    <div
                      key={item.duration_unit}
                      className={`rounded-lg border p-3 ${
                        item.is_current ? 'border-blue-300 bg-blue-50/30' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">Year {item.duration_unit}</span>
                          <span className="text-2xs font-mono text-slate-500">({item.academic_year || 'N/A'})</span>
                        </div>
                        {item.is_current ? (
                          <span className="rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-3xs font-bold">
                            Current Active
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-3xs font-medium">
                            Past Session
                          </span>
                        )}
                      </div>

                      <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded bg-slate-50 p-1.5 border border-slate-100">
                          <span className="block text-3xs text-slate-400 uppercase">Total Due</span>
                          <span className="font-mono text-xs font-semibold text-slate-800 block mt-0.5">
                            ₹{Number(item.total_fee).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="rounded bg-emerald-50 p-1.5 border border-emerald-100">
                          <span className="block text-3xs text-emerald-600 uppercase">Paid</span>
                          <span className="font-mono text-xs font-bold text-emerald-700 block mt-0.5">
                            ₹{Number(item.paid).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div
                          className={`rounded p-1.5 border ${
                            Number(item.pending) <= 0
                              ? 'bg-slate-50 border-slate-100'
                              : 'bg-rose-50 border-rose-100'
                          }`}
                        >
                          <span
                            className={`block text-3xs uppercase ${
                              Number(item.pending) <= 0 ? 'text-slate-400' : 'text-rose-600'
                            }`}
                          >
                            Balance
                          </span>
                          <span
                            className={`font-mono text-xs font-bold block mt-0.5 ${
                              Number(item.pending) <= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {Number(item.pending) <= 0 ? '₹0.00' : `₹${Number(item.pending).toLocaleString('en-IN')}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* --- DESKTOP & TABLET TABLE VIEW (with smooth horizontal scroll on narrow devices) --- */}
                <div
                  className={`overflow-hidden rounded-lg border border-slate-200 ${
                    mobileTableView ? 'block' : 'hidden sm:block'
                  }`}
                >
                  <div className="overflow-x-auto">
                    <table className="min-w-[620px] w-full text-xs divide-y divide-slate-200">
                      <thead className="bg-slate-50 text-slate-700">
                        <tr>
                          <th className="px-3.5 py-2.5 text-left font-semibold whitespace-nowrap min-w-[90px]">Year</th>
                          <th className="px-3.5 py-2.5 text-left font-semibold whitespace-nowrap min-w-[130px]">Academic Session</th>
                          <th className="px-3.5 py-2.5 text-left font-semibold whitespace-nowrap min-w-[120px]">Status</th>
                          <th className="px-3.5 py-2.5 text-right font-semibold whitespace-nowrap min-w-[120px]">Total Due</th>
                          <th className="px-3.5 py-2.5 text-right font-semibold whitespace-nowrap min-w-[120px]">Amount Paid</th>
                          <th className="px-3.5 py-2.5 text-right font-semibold whitespace-nowrap min-w-[130px]">Pending Left</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100">
                        {student.fee_breakdown.map((item) => (
                          <tr
                            key={item.duration_unit}
                            className={
                              item.is_current
                                ? 'bg-blue-50/40 hover:bg-blue-50/70 transition'
                                : 'hover:bg-slate-50 transition'
                            }
                          >
                            <td className="px-3.5 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                              Year {item.duration_unit}
                            </td>
                            <td className="px-3.5 py-2.5 text-slate-700 whitespace-nowrap font-mono">
                              {item.academic_year || '-'}
                            </td>
                            <td className="px-3.5 py-2.5 whitespace-nowrap">
                              {item.is_current ? (
                                <span className="rounded-full bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 text-2xs font-bold">
                                  Current Active
                                </span>
                              ) : (
                                <span className="rounded-full bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 text-2xs font-medium">
                                  Past Session
                                </span>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-semibold font-mono text-slate-800 whitespace-nowrap">
                              ₹{Number(item.total_fee).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-mono text-emerald-700 font-bold whitespace-nowrap">
                              ₹{Number(item.paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-bold font-mono whitespace-nowrap">
                              {Number(item.pending) <= 0 ? (
                                <span className="text-emerald-700">₹0.00 (Cleared)</span>
                              ) : (
                                <span className="text-rose-700">
                                  ₹{Number(item.pending).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Left
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                        <tr>
                          <td colSpan={3} className="px-3.5 py-2.5 text-slate-900 whitespace-nowrap">
                            Grand Total (All Sessions)
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-slate-900 whitespace-nowrap">
                            ₹{Number(student.overall_total_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-emerald-700 whitespace-nowrap">
                            ₹{Number(student.overall_total_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono whitespace-nowrap">
                            {Number(student.overall_pending_fees ?? student.pending_fees) <= 0 ? (
                              <span className="text-emerald-700">0.00 (All Cleared)</span>
                            ) : (
                              <span className="text-rose-700">
                                ₹{Number(student.overall_pending_fees ?? student.pending_fees).toLocaleString('en-IN', {
                                  minimumFractionDigits: 2,
                                })}{' '}
                                Left
                              </span>
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* =====================================================================
              4. RECENT PAYMENT RECEIPTS & TRANSACTIONS
              ===================================================================== */}
          <div className="rounded-lg border border-slate-200 bg-white p-3.5 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Payment History &amp; Receipts</h3>
                <p className="text-2xs text-slate-500">Recorded fee transactions and receipts for this student</p>
              </div>
              <span className="text-2xs font-semibold text-slate-500">
                {payments.length} {payments.length === 1 ? 'Payment Record' : 'Payment Records'}
              </span>
            </div>

            {loadingPayments ? (
              <div className="py-6 text-center text-xs text-slate-400">Loading payment records…</div>
            ) : payments.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <p>No fee payments recorded yet for this student.</p>
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  + Record first payment now
                </button>
              </div>
            ) : (
              <div className="mt-3.5 overflow-hidden rounded-lg border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-[550px] w-full text-xs divide-y divide-slate-200">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="px-3.5 py-2.5 text-left font-semibold whitespace-nowrap min-w-[80px]">Receipt #</th>
                        <th className="px-3.5 py-2.5 text-left font-semibold whitespace-nowrap min-w-[110px]">Payment Date</th>
                        <th className="px-3.5 py-2.5 text-left font-semibold whitespace-nowrap min-w-[120px]">Payment For</th>
                        <th className="px-3.5 py-2.5 text-right font-semibold whitespace-nowrap min-w-[110px]">Amount</th>
                        <th className="px-3.5 py-2.5 text-left font-semibold whitespace-nowrap min-w-[130px]">Note / Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {payments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50 transition">
                          <td className="px-3.5 py-2.5 font-mono font-bold text-slate-700 whitespace-nowrap">
                            #{String(p.id).padStart(4, '0')}
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-700 whitespace-nowrap font-mono">
                            {new Date(p.paid_at || p.created_at).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            <span className="rounded bg-slate-100 text-slate-700 px-2 py-0.5 text-3xs font-medium">
                              {p.payment_for === 'current_year'
                                ? `Year ${p.duration_unit} Current`
                                : p.payment_for === 'previous_due'
                                ? `Year ${p.duration_unit} Arrears`
                                : p.payment_for}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-emerald-700 font-bold whitespace-nowrap">
                            ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-500 truncate max-w-xs">
                            {p.note || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* =====================================================================
              5. CONTACT & ADMINISTRATIVE RECORDS
              ===================================================================== */}
          <div className="rounded-lg border border-slate-200 bg-white p-3.5 sm:p-5 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
              Contact &amp; Administrative Records
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 text-xs">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 sm:p-3 min-w-0">
                <p className="text-3xs text-slate-400 font-semibold uppercase">Phone Number</p>
                {student.phone ? (
                  <a
                    href={`tel:${student.phone}`}
                    className="mt-1 font-bold text-blue-600 hover:underline truncate block"
                  >
                    {student.phone}
                  </a>
                ) : (
                  <p className="mt-1 font-medium text-slate-400">Not Provided</p>
                )}
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 sm:p-3 min-w-0">
                <p className="text-3xs text-slate-400 font-semibold uppercase">Class &amp; Section</p>
                <p className="mt-1 font-bold text-slate-900 truncate">
                  {student.class || '-'} {student.section ? `(${student.section})` : ''}
                </p>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 sm:p-3 min-w-0">
                <p className="text-3xs text-slate-400 font-semibold uppercase">Enrollment Date</p>
                <p className="mt-1 font-bold text-slate-900 font-mono">
                  {new Date(student.created_at).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 sm:p-3 min-w-0 col-span-1 sm:col-span-2 lg:col-span-3">
                <p className="text-3xs text-slate-400 font-semibold uppercase">Permanent Address</p>
                <p className="mt-1 font-bold text-slate-900 whitespace-normal break-words leading-relaxed">
                  {student.address || 'Not Provided'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS & OVERLAYS
          ========================================================================= */}
      {/* Student Edit Modal */}
      {student && (
        <StudentModal
          isOpen={isStudentModalOpen}
          onClose={() => setIsStudentModalOpen(false)}
          studentId={student.id}
          onSuccess={() => {
            if (param) loadStudent(param);
            setToast({ message: 'Student updated successfully.', variant: 'success' });
          }}
        />
      )}

      {/* Payment Record Modal */}
      {student && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          initialStudent={student}
          onSuccess={() => {
            if (param) loadStudent(param);
            setToast({ message: 'Payment recorded successfully.', variant: 'success' });
          }}
        />
      )}

      {/* Digital ID / QR Code Enlarged View Modal */}
      {student && student.qr_code && isQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsQrModalOpen(false)}
          />
          <div className="relative w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl z-10 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Digital Student ID Card</span>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:text-slate-700 transition"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex flex-col items-center">
              <div className="h-48 w-48 rounded-lg border border-slate-200 bg-white p-2.5 shadow-xs">
                <img
                  src={getAssetUrl(student.qr_code)}
                  alt="Student QR Code"
                  className="h-full w-full object-contain"
                />
              </div>

              <p className="mt-3 text-base font-bold font-mono text-slate-900">{student.college_roll_no}</p>
              <p className="text-sm font-semibold text-slate-700">{student.name}</p>
              <p className="text-xs text-slate-500">
                {student.course_name || student.course_code} &bull; Year {student.current_duration_unit}
              </p>

              <div className="mt-4 pt-3 border-t border-slate-100 w-full">
                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(false)}
                  className="w-full rounded-md border border-slate-300 bg-white text-slate-700 text-xs font-semibold py-2 hover:bg-slate-50 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}
    </div>
  );
}
