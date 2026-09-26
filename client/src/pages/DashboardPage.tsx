import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchStudents, fetchCourses, Course } from '../lib/studentApi';

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        const [studentList, courseList] = await Promise.all([
          fetchStudents(),
          fetchCourses()
        ]);
        setStudentCount(studentList.length);
        setCourses(courseList);
      } catch (error) {
        console.error('Failed to load dashboard data', error);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  return (
    <div className="space-y-4">
      {/* Welcome Card */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <h1 className="text-xl font-bold text-slate-900">
          {isAdmin ? 'Welcome Admin' : 'Welcome Staff'}
        </h1>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
          {isAdmin
            ? 'As an Administrator, you can manage students, courses, fee structures, payments, user credentials, system settings, and cloud data sync.'
            : 'As a Staff member, you can register students, record and manage fee payments, and view student transaction records.'}
        </p>
      </div>

      {/* Cards: Total Students & Total Courses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Total Students */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Students
            </div>
            <div className="mt-3 text-3xl font-bold text-slate-900">
              {loading ? '…' : (studentCount ?? 0)}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Enrolled students in the system
            </p>
          </div>
        </div>

        {/* Card 2: Total Courses with Code and Name */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Courses
            </div>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
              {loading ? '…' : `${courses.length} ${courses.length === 1 ? 'Course' : 'Courses'}`}
            </span>
          </div>

          <div className="mt-3">
            {loading ? (
              <p className="text-xs text-slate-400">Loading courses…</p>
            ) : courses.length === 0 ? (
              <p className="text-xs text-slate-500">No courses configured yet.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 pr-1">
                {courses.map((course) => (
                  <div key={course.code} className="flex items-center justify-between py-1.5 text-xs">
                    <span className="font-semibold text-slate-800 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      {course.code}
                    </span>
                    <span className="text-slate-600 truncate ml-2 text-right">
                      {course.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
