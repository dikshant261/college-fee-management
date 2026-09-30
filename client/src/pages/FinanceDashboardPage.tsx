import React, { useEffect, useState, useMemo } from 'react';
import {
  FinanceOverviewData,
  fetchFinanceOverview,
  formatINR
} from '../lib/financeApi';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

export default function FinanceDashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Filters
  const [selectedAy, setSelectedAy] = useState('2025-26');
  const [data, setData] = useState<FinanceOverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fee Drilldown filter (for Option B course view: 'all' or specific session)
  const [courseSessionFilter, setCourseSessionFilter] = useState('');

  useEffect(() => {
    loadOverview();
  }, [selectedAy]);

  async function loadOverview() {
    setLoading(true);
    try {
      const res = await fetchFinanceOverview({
        academic_year: selectedAy || undefined
      });
      setData(res);
    } catch (err) {
      console.error('Failed to load financial overview', err);
    } finally {
      setLoading(false);
    }
  }

  // Calculate highest category for percentage scale in chart
  const maxCategoryAmount = useMemo(() => {
    if (!data?.outflow?.category_breakdown?.length) return 1;
    return Math.max(...data.outflow.category_breakdown.map((c) => c.amount), 1);
  }, [data]);

  // Calculate highest monthly trend for chart
  const maxMonthlyAmount = useMemo(() => {
    if (!data?.outflow?.monthly_trend?.length) return 1;
    return Math.max(...data.outflow.monthly_trend.map((m) => m.total), 1);
  }, [data]);

  const outflow = data?.outflow;
  const inflow = data?.inflow;
  const net = data?.net;

  return (
    <div className="space-y-5">
      {/* Top Header & Institutional Period Filter */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Finance &amp; Accounts Overview</h1>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-2xs font-bold text-blue-700 border border-blue-200">
                Institutional Balance
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive cash flow monitor: Money In (Student Fee Collections) vs Money Out (Expenses &amp; Remittances).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600">Accounting Session:</span>
            <select
              value={selectedAy}
              onChange={(e) => setSelectedAy(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 font-semibold text-slate-800 bg-white shadow-2xs outline-none focus:border-blue-500"
            >
              <option value="2026-27">Academic Year 2026-27</option>
              <option value="2025-26">Academic Year 2025-26</option>
              <option value="2024-25">Academic Year 2024-25</option>
              <option value="">All Lifetime Sessions</option>
            </select>

            <button
              type="button"
              onClick={loadOverview}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Executive Cash Position Banner */}
        <div className="mt-4 rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 p-4 sm:p-5 text-white shadow-md">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">
                  Net Operating Cash Position
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-3xs font-bold uppercase ${
                    (net?.balance ?? 0) >= 0
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {(net?.balance ?? 0) >= 0 ? 'Operating Surplus' : 'Operating Deficit'}
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                  {formatINR(net?.balance)}
                </span>
                <span className="text-xs text-slate-300">
                  (Fee Collections minus Outgoing Expenses &amp; Salaries)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 border-t lg:border-t-0 lg:border-l border-slate-700/80 pt-3 lg:pt-0 lg:pl-6 text-xs">
              <div>
                <span className="text-slate-400 text-3xs uppercase font-semibold block">Total Fees Inflow</span>
                <span className="text-lg font-bold text-emerald-400">+{formatINR(net?.inflow)}</span>
              </div>
              <div className="text-slate-500 font-bold text-xl">−</div>
              <div>
                <span className="text-slate-400 text-3xs uppercase font-semibold block">Total Cleared Outflow</span>
                <span className="text-lg font-bold text-rose-400">−{formatINR(net?.outflow)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 1: MONEY OUT (EXPENSES & SALARY OUTFLOW METRICS)
          ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Institutional Money Outflow
            </h2>
            <p className="text-xs text-slate-500">Expenses paid, staff remuneration, and pending institutional bills.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/money-out/expenses"
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Manage Expenses →
            </Link>
          </div>
        </div>

        {/* 6 Key Outflow Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Total Outflow */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block">
              1. Total Outflow
            </span>
            <div className="mt-1 text-xl font-extrabold text-slate-900">
              {loading ? '…' : formatINR(outflow?.total_outflow)}
            </div>
            <p className="mt-1 text-3xs text-slate-500">Paid in selected session</p>
          </div>

          {/* Card 2: This Month */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block">
              2. This Month
            </span>
            <div className="mt-1 text-xl font-extrabold text-slate-900">
              {loading ? '…' : formatINR(outflow?.this_month_outflow)}
            </div>
            <p className="mt-1 text-3xs text-slate-500">Current calendar month</p>
          </div>

          {/* Card 3: Total Salary */}
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-4 shadow-xs">
            <span className="text-3xs font-bold uppercase tracking-wider text-indigo-700 block">
              3. Total Salary
            </span>
            <div className="mt-1 text-xl font-extrabold text-indigo-900">
              {loading ? '…' : formatINR(outflow?.total_salary)}
            </div>
            <p className="mt-1 text-3xs text-indigo-600">Disbursed faculty remuneration</p>
          </div>

          {/* Card 4: Other Expenses */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block">
              4. Other Expenses
            </span>
            <div className="mt-1 text-xl font-extrabold text-slate-900">
              {loading ? '…' : formatINR(outflow?.other_expenses)}
            </div>
            <p className="mt-1 text-3xs text-slate-500">Utilities, repairs, operations</p>
          </div>

          {/* Card 5: Pending Payments */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
            <span className="text-3xs font-bold uppercase tracking-wider text-amber-700 block">
              5. Pending Payments
            </span>
            <div className="mt-1 text-xl font-extrabold text-amber-700">
              {loading ? '…' : formatINR(outflow?.pending_payments)}
            </div>
            <p className="mt-1 text-3xs text-amber-600">Committed, awaiting clearance</p>
          </div>

          {/* Card 6: Number of Transactions */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 block">
              6. Outgoing Txns
            </span>
            <div className="mt-1 text-xl font-extrabold text-slate-900">
              {loading ? '…' : `${outflow?.transaction_count ?? 0} txns`}
            </div>
            <p className="mt-1 text-3xs text-slate-500">Cleared bank/cash vouchers</p>
          </div>
        </div>

        {/* Visual Charts & Breakdown Grid */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Chart 1: Expenses by Category */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-800">Expenditure by Category</span>
                <span className="text-3xs text-slate-400 font-medium">Ranked by spending</span>
              </div>

              <div className="mt-3 space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {outflow?.category_breakdown?.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No categorized spending recorded yet.</p>
                ) : (
                  outflow?.category_breakdown?.map((cat) => {
                    const pct = Math.round((cat.amount / maxCategoryAmount) * 100);
                    return (
                      <div key={cat.category} className="text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-800">{cat.category}</span>
                          <span className="font-mono font-bold text-slate-900">
                            {formatINR(cat.amount)}{' '}
                            <span className="text-3xs font-normal text-slate-400">({cat.count} txns)</span>
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Chart 2: Monthly Outflow Trend & Method Breakdown */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-800">Monthly Outflow Trend (Recent Months)</span>
                <span className="text-3xs text-slate-400 font-medium">Salary vs Other Expenses</span>
              </div>

              <div className="mt-3 space-y-2">
                {outflow?.monthly_trend?.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No monthly trend data available.</p>
                ) : (
                  outflow?.monthly_trend?.map((item) => {
                    const pct = Math.round((item.total / maxMonthlyAmount) * 100);
                    return (
                      <div key={item.month_key} className="text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono font-bold text-slate-700">{item.month_key}</span>
                          <span className="font-mono font-bold text-slate-900">{formatINR(item.total)}</span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-slate-100 flex overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full"
                            style={{
                              width: item.total > 0 ? `${(item.salary / maxMonthlyAmount) * 100}%` : '0%'
                            }}
                            title={`Salary: ${formatINR(item.salary)}`}
                          />
                          <div
                            className="bg-blue-500 h-full"
                            style={{
                              width: item.total > 0 ? `${(item.expenses / maxMonthlyAmount) * 100}%` : '0%'
                            }}
                            title={`Expenses: ${formatINR(item.expenses)}`}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Legend & Payment Methods */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-2xs">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 font-medium text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-indigo-600" /> Salary Remittances
                  </span>
                  <span className="flex items-center gap-1 font-medium text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-blue-500" /> Operational Expenses
                  </span>
                </div>

                <div className="flex items-center gap-1 text-slate-500">
                  <span>Methods:</span>
                  {outflow?.payment_method_breakdown?.map((m) => (
                    <span
                      key={m.payment_method}
                      className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-semibold uppercase text-3xs text-slate-700"
                    >
                      {m.payment_method}: {formatINR(m.amount)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: OPTION B - STUDENT FEE INFLOW & DUES (SESSION & COURSE WISE)
          ========================================================================= */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <h2 className="text-base font-bold text-slate-900">Student Fee Collection &amp; Outstanding Dues</h2>
              <span className="rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-3xs font-bold px-2 py-0.5">
                Money In Breakdown
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive analysis of institutional fee dues, total paid collections, and pending balances by session and course.
            </p>
          </div>

          <Link
            to="/fees"
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            Go to Fee Entry →
          </Link>
        </div>

        {/* Grand Total Cards for Fees */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Card 1: Grand Total Fee Expected */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <span className="text-3xs font-bold uppercase tracking-wider text-slate-500 block">
              Grand Total Fee Due
            </span>
            <div className="mt-1 text-2xl font-black text-slate-900">
              {loading ? '…' : formatINR(inflow?.grand_total_due)}
            </div>
            <p className="mt-1 text-3xs text-slate-500">
              Total assessed fee for all {inflow?.total_students ?? 0} students
            </p>
          </div>

          {/* Card 2: Grand Total Paid Fee (Collected) */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
            <span className="text-3xs font-bold uppercase tracking-wider text-emerald-700 block">
              Grand Total Paid Fee
            </span>
            <div className="mt-1 text-2xl font-black text-emerald-700">
              {loading ? '…' : formatINR(inflow?.grand_total_paid)}
            </div>
            <p className="mt-1 text-3xs text-emerald-700 font-semibold">
              Actual collected institutional revenue ({inflow?.recovery_percentage ?? 0}%)
            </p>
          </div>

          {/* Card 3: Grand Total Pending Fee */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
            <span className="text-3xs font-bold uppercase tracking-wider text-amber-700 block">
              Grand Total Pending Fee
            </span>
            <div className="mt-1 text-2xl font-black text-amber-700">
              {loading ? '…' : formatINR(inflow?.grand_total_pending)}
            </div>
            <p className="mt-1 text-3xs text-amber-700 font-semibold">
              Total student fee arrears yet to be collected
            </p>
          </div>

          {/* Card 4: Institutional Collection Rate */}
          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4">
            <span className="text-3xs font-bold uppercase tracking-wider text-blue-700 block">
              Overall Recovery Rate
            </span>
            <div className="mt-1 text-2xl font-black text-blue-700">
              {loading ? '…' : `${inflow?.recovery_percentage ?? 0}%`}
            </div>
            <div className="mt-1.5 h-2 w-full rounded-full bg-blue-200 overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, inflow?.recovery_percentage ?? 0)}%` }}
              />
            </div>
          </div>
        </div>

        {/* 2-Column Tables: Session-Wise vs Course-Wise Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
          {/* Table A: Session-Wise (Academic Year) Breakdown */}
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800">Session-Wise Fee Breakdown</span>
                <span className="block text-3xs text-slate-400">Aggregated by Academic Session</span>
              </div>
              <span className="text-3xs font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600">
                {inflow?.session_wise?.length ?? 0} Sessions
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-3xs font-bold uppercase text-slate-500">
                    <th className="py-2.5 px-3">Session</th>
                    <th className="py-2.5 px-2 text-center">Students</th>
                    <th className="py-2.5 px-2 text-right">Total Due</th>
                    <th className="py-2.5 px-2 text-right">Paid Fee</th>
                    <th className="py-2.5 px-2 text-right">Pending Fee</th>
                    <th className="py-2.5 px-3 text-right">Recovery</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inflow?.session_wise?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        No session data available.
                      </td>
                    </tr>
                  ) : (
                    inflow?.session_wise?.map((s) => (
                      <tr key={s.academic_year} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-bold font-mono text-slate-900">
                          {s.academic_year}
                        </td>
                        <td className="py-2.5 px-2 text-center font-medium text-slate-600">
                          {s.student_count}
                        </td>
                        <td className="py-2.5 px-2 text-right font-medium text-slate-800 font-mono">
                          {formatINR(s.total_due)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-emerald-700 font-mono">
                          {formatINR(s.total_paid)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-amber-700 font-mono">
                          {formatINR(s.total_pending)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="font-bold text-slate-800">{s.recovery_percentage}%</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table B: Course-Wise Breakdown */}
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800">Course-Wise Fee Breakdown</span>
                <span className="block text-3xs text-slate-400">
                  {selectedAy ? `Filtered for ${selectedAy}` : 'All Enrolled Courses'}
                </span>
              </div>
              <span className="text-3xs font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600">
                {inflow?.course_wise?.length ?? 0} Courses
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-3xs font-bold uppercase text-slate-500">
                    <th className="py-2.5 px-3">Course</th>
                    <th className="py-2.5 px-2 text-center">Students</th>
                    <th className="py-2.5 px-2 text-right">Total Due</th>
                    <th className="py-2.5 px-2 text-right">Paid Fee</th>
                    <th className="py-2.5 px-2 text-right">Pending Fee</th>
                    <th className="py-2.5 px-3 text-right">Recovery</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inflow?.course_wise?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        No course fee data available.
                      </td>
                    </tr>
                  ) : (
                    inflow?.course_wise?.map((c) => (
                      <tr key={c.course_code} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 mr-1.5">
                            {c.course_code}
                          </span>
                          <span className="font-medium text-slate-800">{c.course_name}</span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-medium text-slate-600">
                          {c.student_count}
                        </td>
                        <td className="py-2.5 px-2 text-right font-medium text-slate-800 font-mono">
                          {formatINR(c.total_due)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-emerald-700 font-mono">
                          {formatINR(c.total_paid)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-amber-700 font-mono">
                          {formatINR(c.total_pending)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="font-bold text-slate-800">{c.recovery_percentage}%</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
