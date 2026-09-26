import api from './api';

export interface FeeStructure {
  id: number;
  course_code: string;
  academic_year: string;
  duration_unit: number;
  tuition_fee: number;
  exam_fee: number;
  library_fee: number;
  other_fee: number;
  total_fee: number;
  created_at: string;
  updated_at: string;
}

export function fetchFeeStructures() {
  return api.get<FeeStructure[]>('/api/fee-structures').then((response) => response.data);
}

export function createFeeStructure(payload: {
  course_code: string;
  academic_year: string;
  duration_unit: number;
  tuition_fee: number;
  exam_fee: number;
  library_fee: number;
  other_fee: number;
}) {
  return api.post<FeeStructure>('/api/fee-structures', payload).then((response) => response.data);
}

export function updateFeeStructure(id: number, payload: Partial<{
  course_code: string;
  academic_year: string;
  duration_unit: number;
  tuition_fee: number;
  exam_fee: number;
  library_fee: number;
  other_fee: number;
}>) {
  return api.put<FeeStructure>(`/api/fee-structures/${id}`, payload).then((response) => response.data);
}

export function deleteFeeStructure(id: number) {
  return api.delete(`/api/fee-structures/${id}`);
}
