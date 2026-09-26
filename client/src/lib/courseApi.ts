import api from './api';

export interface CourseRecord {
  code: string;
  name: string;
  duration_type: 'year' | 'semester';
  total_duration: number;
  created_at: string;
  updated_at: string;
}

export function fetchCourses() {
  return api.get<CourseRecord[]>('/api/courses').then((response) => response.data);
}

export function createCourse(payload: { code: string; name: string; duration_type: 'year' | 'semester'; total_duration: number }) {
  return api.post<CourseRecord>('/api/courses', payload).then((response) => response.data);
}

export function updateCourse(code: string, payload: Partial<{ code?: string; name: string; duration_type: 'year' | 'semester'; total_duration: number }>) {
  return api.put<CourseRecord>(`/api/courses/${code}`, payload).then((response) => response.data);
}

export function deleteCourse(code: string) {
  return api.delete(`/api/courses/${code}`);
}
