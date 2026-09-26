import api from './api';

export interface FeePaymentRecord {
  id: number;
  student_id: string | number;
  staff_id?: number;
  payment_for: 'current_year' | 'previous_due' | 'advance' | 'other';
  duration_unit: number;
  amount: number;
  paid_at: string;
  note?: string;
  created_at: string;
  updated_at: string;
  student_name?: string;
  student_roll_no?: string;
}

export function fetchFeePayments(params?: { student_id?: string | number; payment_for?: string }) {
  return api.get<FeePaymentRecord[]>('/api/fees', { params }).then((response) => response.data);
}

export function createFeePayment(payload: {
  student_id: string | number;
  payment_for: 'current_year' | 'previous_due' | 'advance' | 'other';
  duration_unit: number;
  amount: number;
  note?: string;
}) {
  return api.post<FeePaymentRecord>('/api/fees', payload).then((response) => response.data);
}

export function deleteFeePayment(id: number) {
  return api.delete(`/api/fees/${id}`);
}
