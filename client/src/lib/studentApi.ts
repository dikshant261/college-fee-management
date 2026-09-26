import api from './api';

export interface Course {
  code: string;
  name: string;
  duration_type: 'year' | 'semester';
  total_duration: number;
}

export interface Student {
  id: number;
  name: string;
  college_roll_no: string;
  university_roll_no?: string;
  course_code: string;
  course_name?: string;
  current_duration_unit: number;
  academic_year: string;
  class?: string;
  section?: string;
  phone?: string;
  address?: string;
  photo_path?: string | null;
  qr_code?: string | null;
  total_fees_due: number;
  total_fees_paid: number;
  pending_fees: number;
  overall_total_due: number;
  overall_total_paid: number;
  created_at: string;
  updated_at: string;
}

export interface SystemSettings {
  college_name?: string;
  current_academic_year?: string;
  default_password?: string;
}

export interface StudentCreatePayload {
  name: string;
  course_code: string;
  academic_year: string;
  current_duration_unit: number;
  class?: string;
  section?: string;
  phone?: string;
  address?: string;
  university_roll_no?: string;
}

export interface StudentUpdatePayload {
  name?: string;
  course_code?: string;
  academic_year?: string;
  current_duration_unit?: number;
  class?: string;
  section?: string;
  phone?: string;
  address?: string;
  university_roll_no?: string;
}

export function fetchCourses() {
  return api.get<Course[]>('/api/students/courses').then((response) => response.data);
}

export function fetchAcademicYears() {
  return api.get<string[]>('/api/students/academic-years').then((response) => response.data);
}

export function fetchSystemSettings() {
  return api.get<SystemSettings>('/api/students/settings').then((response) => response.data);
}

export function fetchStudents(params?: {
  q?: string;
  course?: string;
  academic_year?: string;
  current_duration_unit?: number;
  fee_status?: string;
}) {
  return api.get<Student[]>('/api/students', { params }).then((response) => response.data);
}

export function fetchStudentById(id: number) {
  return api.get<Student>(`/api/students/${id}`).then((response) => response.data);
}

export function fetchStudentByRoll(rollNo: string) {
  return api.get<Student>(`/api/students/roll/${encodeURIComponent(rollNo)}`).then((response) => response.data);
}

export function createStudent(payload: StudentCreatePayload) {
  return api.post<Student>('/api/students', payload).then((response) => response.data);
}

export function updateStudent(id: number, payload: StudentUpdatePayload) {
  return api.put<Student>(`/api/students/${id}`, payload).then((response) => response.data);
}

export function deleteStudent(id: number) {
  return api.delete(`/api/students/${id}`);
}

export function uploadStudentPhoto(id: number, file: File) {
  const formData = new FormData();
  formData.append('photo', file);
  return api.post<Student>(`/api/students/${id}/photo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then((response) => response.data);
}
