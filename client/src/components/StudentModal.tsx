import React, { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import {
  Course,
  Student,
  StudentCreatePayload,
  createStudent,
  fetchCourses,
  fetchStudentById,
  updateStudent,
  uploadStudentPhoto,
  fetchSystemSettings,
  fetchAcademicYears
} from '../lib/studentApi';
import { getAssetUrl } from '../lib/api';

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId?: number | null;
  onSuccess: (student?: Student) => void;
}

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

export default function StudentModal({
  isOpen,
  onClose,
  studentId,
  onSuccess
}: StudentModalProps) {
  const isEditMode = Boolean(studentId);

  const [courses, setCourses] = useState<Course[]>([]);
  const [yearOptions, setYearOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

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

  // Load courses and initial data whenever modal opens
  useEffect(() => {
    if (!isOpen) {
      setPhotoFile(null);
      setPreviewUrl(null);
      setErrorMsg('');
      return;
    }

    async function initData() {
      setInitialLoading(true);
      setErrorMsg('');
      try {
        const [courseList, systemSettings, dbYears] = await Promise.all([
          fetchCourses(),
          fetchSystemSettings(),
          fetchAcademicYears()
        ]);
        setCourses(courseList);
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
          setStudent(null);
          setForm({
            name: '',
            course_code: courseList[0]?.code ?? '',
            academic_year: systemSettings.current_academic_year ?? '',
            current_duration_unit: 1,
            class: '',
            section: '',
            phone: '',
            address: '',
            university_roll_no: ''
          });
          setPreviewUrl(null);
        }
      } catch (err: any) {
        setErrorMsg('Failed to load student data. Please try again.');
      } finally {
        setInitialLoading(false);
      }
    }

    initData();
  }, [isOpen, studentId]);

  // Update image preview when local file is selected
  useEffect(() => {
    if (!photoFile) return;
    const url = URL.createObjectURL(photoFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  function updateField<K extends keyof StudentCreatePayload>(key: K, value: StudentCreatePayload[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.course_code || !form.academic_year || !form.current_duration_unit) {
      setErrorMsg('Please fill in all required fields (Name, Course, Academic Year, and Current Year).');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const payload: StudentCreatePayload = {
        name: form.name.trim(),
        course_code: form.course_code,
        academic_year: form.academic_year,
        current_duration_unit: Number(form.current_duration_unit),
        class: form.class?.trim() || undefined,
        section: form.section?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        address: form.address?.trim() || undefined,
        university_roll_no: form.university_roll_no?.trim() || undefined
      };

      let savedStudent: Student | null = null;
      if (studentId) {
        savedStudent = await updateStudent(studentId, payload);
      } else {
        savedStudent = await createStudent(payload);
      }

      if (photoFile && savedStudent) {
        await uploadStudentPhoto(savedStudent.id, photoFile);
      }

      onSuccess(savedStudent);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to save student. Please check input and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Edit Student Record' : 'Enroll New Student'}
      subtitle={
        isEditMode
          ? 'Modify student profile, assigned course, or identity photo.'
          : 'Enter student information to generate college roll numbers and student records.'
      }
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        </svg>
      }
      maxWidth="max-w-3xl"
    >
      {initialLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-xs font-medium">Loading student form details…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Academic & Identity Row */}
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Student Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name ?? ''}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition"
                placeholder="e.g. Rahul Sharma"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                University Roll No (Optional)
              </label>
              <input
                type="text"
                value={form.university_roll_no ?? ''}
                onChange={(e) => updateField('university_roll_no', e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition"
                placeholder="e.g. 2304910291"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Course <span className="text-red-500">*</span>
              </label>
              <select
                value={form.course_code ?? ''}
                onChange={(e) => updateField('course_code', e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition"
                required
              >
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course.code} value={course.code}>
                    {course.code} - {course.name} ({course.total_duration} Years)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Academic Session / Year <span className="text-red-500">*</span>
              </label>
              <select
                value={form.academic_year ?? ''}
                onChange={(e) => updateField('academic_year', e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition"
                required
              >
                <option value="">Select academic session</option>
                {yearOptions.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Admission / Current Year <span className="text-red-500">*</span>
              </label>
              <select
                value={form.current_duration_unit ?? 1}
                onChange={(e) => updateField('current_duration_unit', Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition"
                required
              >
                {durationOptions.map((yearNum) => (
                  <option key={yearNum} value={yearNum}>
                    Year {yearNum}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-2xs text-slate-500">
                Direct lateral admissions to Year 2 or Year 3 will start fee calculation from that year.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                College Roll Number
              </label>
              <input
                type="text"
                readOnly
                value={student?.college_roll_no || 'Auto-generated upon submission'}
                className="w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-mono text-slate-600 outline-none select-all"
              />
            </div>
          </div>

          {/* Contact & Personal Details Row */}
          <div className="grid gap-3.5 sm:grid-cols-2 pt-1 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Class / Batch
              </label>
              <input
                type="text"
                value={form.class ?? ''}
                onChange={(e) => updateField('class', e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition"
                placeholder="e.g. 1st Year CS-A"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Section
              </label>
              <input
                type="text"
                value={form.section ?? ''}
                onChange={(e) => updateField('section', e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition"
                placeholder="e.g. Section A"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={form.phone ?? ''}
                onChange={(e) => updateField('phone', e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition"
                placeholder="e.g. 9876543210"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Permanent Address
              </label>
              <input
                type="text"
                value={form.address ?? ''}
                onChange={(e) => updateField('address', e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition"
                placeholder="City, State, Postal Code"
              />
            </div>
          </div>

          {/* Student Photo Attachment */}
          <div className="pt-1 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Student Photo (ID Card &amp; Profile)
            </label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="relative shrink-0 w-16 h-16 rounded-md bg-white border border-slate-200 overflow-hidden flex items-center justify-center shadow-xs">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-semibold file:bg-white file:text-slate-700 hover:file:bg-slate-100 cursor-pointer"
                />
                <p className="mt-1 text-2xs text-slate-400">
                  Accepts JPG, PNG, WEBP. Square portrait recommended.
                </p>
              </div>
            </div>
          </div>

          {/* Modal Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition shadow-xs disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 border border-blue-700 rounded-md hover:bg-blue-700 active:bg-blue-800 transition shadow-xs disabled:opacity-50"
            >
              {loading && (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              {isEditMode ? 'Update Student' : 'Save Student'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
