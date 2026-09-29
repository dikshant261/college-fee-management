import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Course,
  Student,
  StudentCreatePayload,
  StudentUpdatePayload,
  createStudent,
  fetchAcademicYears,
  fetchCourses,
  fetchStudentById,
  updateStudent,
  uploadStudentPhoto,
  fetchSystemSettings
} from '../lib/studentApi';
import { getAssetUrl } from '../lib/api';
import Toast from '../components/Toast';

function normalizeAcademicYearOptions(currentYear?: string, extraYears: string[] = []) {
  const yearSet = new Set<string>();
  if (currentYear) {
    const parts = currentYear.split('-');
    const start = Number(parts[0]);
    if (!Number.isNaN(start)) {
      // Past 5 sessions, current session, next 2 sessions (covers 4-year & 5-year courses)
      for (let y = start - 5; y <= start + 2; y++) {
        const next = String(y + 1).slice(-2);
        yearSet.add(`${y}-${next}`);
      }
    } else {
      yearSet.add(currentYear);
    }
  }
  for (const yr of extraYears) {
    if (yr && typeof yr === 'string') yearSet.add(yr.trim());
  }
  return Array.from(yearSet).sort((a, b) => {
    const matchA = a.match(/^(\d{4})/);
    const matchB = b.match(/^(\d{4})/);
    if (matchA && matchB) {
      return parseInt(matchB[1], 10) - parseInt(matchA[1], 10);
    }
    return b.localeCompare(a);
  });
}

export default function StudentFormPage() {
  const { id, identifier } = useParams();
  const studentId = id ? Number(id) : undefined;
  const isEditMode = Boolean(studentId);
  const navigate = useNavigate();

  const [courses, setCourses] = useState<Course[]>([]);
  const [settings, setSettings] = useState<{ current_academic_year?: string }>({});
  const [yearOptions, setYearOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [toast, setToast] = useState<{ message: string; variant?: 'success' | 'error' | 'info' } | null>(null);
  const [form, setForm] = useState<Partial<StudentCreatePayload>>({
    name: '',
    course_code: '',
    academic_year: '',
    current_duration_unit: 1,
    class: '',
    section: '',
    phone: '',
    address: '',
    university_roll_no: ''
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const selectedCourse = courses.find((course) => course.code === form.course_code);
  const durationOptions = useMemo(() => {
    if (!selectedCourse) return [1, 2, 3, 4];
    return Array.from({ length: selectedCourse.total_duration }, (_, index) => index + 1);
  }, [selectedCourse]);

  useEffect(() => {
    loadFormData();
  }, [studentId]);

  useEffect(() => {
    setYearOptions(normalizeAcademicYearOptions(settings.current_academic_year));
  }, [settings.current_academic_year]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!photoFile) return;
    const url = URL.createObjectURL(photoFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  async function loadFormData() {
    setLoading(true);
    try {
      const [courseList, systemSettings, dbYears] = await Promise.all([
        fetchCourses(),
        fetchSystemSettings(),
        fetchAcademicYears()
      ]);
      setCourses(courseList);
      setSettings(systemSettings);
      setYearOptions(normalizeAcademicYearOptions(systemSettings.current_academic_year, dbYears));
      if (studentId) {
        const data = await fetchStudentById(studentId);
        setStudent(data);
        if (data?.academic_year) {
          setYearOptions((prev) =>
            normalizeAcademicYearOptions(systemSettings.current_academic_year, [...prev, data.academic_year])
          );
        }
        setForm({
          name: data.name,
          course_code: data.course_code,
          academic_year: data.academic_year,
          current_duration_unit: data.current_duration_unit,
          class: data.class ?? '',
          section: data.section ?? '',
          phone: data.phone ?? '',
          address: data.address ?? '',
          university_roll_no: data.university_roll_no ?? ''
        });
        setPreviewUrl(data.photo_path ? getAssetUrl(data.photo_path) : null);
      } else {
        setForm((current) => ({
          ...current,
          academic_year: systemSettings.current_academic_year ?? '',
          current_duration_unit: 1
        }));
      }
    } catch (error) {
      setToast({ message: 'Unable to load form data.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof StudentCreatePayload>(key: K, value: StudentCreatePayload[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name || !form.course_code || !form.academic_year || !form.current_duration_unit) {
      setToast({ message: 'Please complete the required fields.', variant: 'error' });
      return;
    }

    setLoading(true);
    try {
      const payload: StudentCreatePayload = {
        name: form.name,
        course_code: form.course_code,
        academic_year: form.academic_year,
        current_duration_unit: Number(form.current_duration_unit),
        class: form.class,
        section: form.section,
        phone: form.phone,
        address: form.address,
        university_roll_no: form.university_roll_no
      };

      let createdStudent: Student | null = null;
      if (studentId) {
        createdStudent = await updateStudent(studentId, payload);
      } else {
        createdStudent = await createStudent(payload);
      }

      if (photoFile && createdStudent) {
        await uploadStudentPhoto(createdStudent.id, photoFile);
      }

      if (createdStudent) {
        setToast({ message: `Student ${isEditMode ? 'updated' : 'created'} successfully.`, variant: 'success' });
        navigate(`/students/${createdStudent.id}`);
      }
    } catch (error) {
      setToast({ message: 'Unable to save student. Try again.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-5 py-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{isEditMode ? 'Edit Student Record' : 'Enroll New Student'}</h1>
          <p className="text-xs text-slate-500">{isEditMode ? 'Modify student profile, course assignment, or photo.' : 'Enter student information to generate roll numbers and student records.'}</p>
        </div>
        <button
          onClick={() => navigate('/students')}
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs transition"
        >
          ← Back to Students
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Student Name</span>
              <input
                value={form.name ?? ''}
                onChange={(e) => updateField('name', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
                placeholder="Enter full name"
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">University Roll No</span>
              <input
                value={form.university_roll_no ?? ''}
                onChange={(e) => updateField('university_roll_no', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
                placeholder="Optional university roll number"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Course</span>
              <select
                value={form.course_code ?? ''}
                onChange={(e) => updateField('course_code', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
                required
              >
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course.code} value={course.code}>{course.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Academic Year</span>
              <select
                value={form.academic_year ?? ''}
                onChange={(e) => updateField('academic_year', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
                required
              >
                <option value="">Select year</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Current Year</span>
              <select
                value={form.current_duration_unit ?? 1}
                onChange={(e) => updateField('current_duration_unit', Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
              >
                {durationOptions.map((yearNumber) => (
                  <option key={yearNumber} value={yearNumber}>{yearNumber}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Generated College Roll Number</span>
              <input
                value={student?.college_roll_no ?? 'Auto-generated on creation'}
                readOnly
                className="mt-1 w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm text-slate-600 outline-none font-mono"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Class / Batch</span>
              <input
                value={form.class ?? ''}
                onChange={(e) => updateField('class', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
                placeholder="e.g. 1st Year CS-A"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Section</span>
              <input
                value={form.section ?? ''}
                onChange={(e) => updateField('section', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
                placeholder="e.g. Section A"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Phone Number</span>
              <input
                value={form.phone ?? ''}
                onChange={(e) => updateField('phone', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
                placeholder="e.g. 9876543210"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Home Address</span>
              <input
                value={form.address ?? ''}
                onChange={(e) => updateField('address', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
                placeholder="Full permanent home address"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 items-center pt-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Student Photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-medium file:bg-white file:text-slate-700 hover:file:bg-slate-50"
              />
            </label>
            <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-2.5">
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="h-14 w-14 rounded-md object-cover border border-slate-200" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-md bg-white border border-slate-200 text-xs text-slate-400">Photo</div>
              )}
              <p className="text-xs text-slate-500">Student photograph for identity records and system profile.</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-slate-200">
            <div className="text-xs text-slate-500">
              {selectedCourse ? `${selectedCourse.name} — ${selectedCourse.duration_type} (${selectedCourse.total_duration} years)` : 'Select a course to configure year options.'}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/students')}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-xs transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-5 py-2 text-sm font-medium text-white transition border border-blue-700 shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Saving…' : isEditMode ? 'Update Student' : 'Save Student'}
              </button>
            </div>
          </div>
        </form>
      </div>
      {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}
    </div>
  );
}
