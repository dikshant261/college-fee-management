import api from './api';

export interface UserRecord {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  force_password_reset: number;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export function fetchUsers() {
  return api.get<UserRecord[]>('/api/users').then((response) => response.data);
}

export function createUser(payload: { name: string; email: string; role: 'admin' | 'staff' }) {
  return api.post<UserRecord>('/api/users', payload).then((response) => response.data);
}

export function updateUser(
  id: number,
  payload: Partial<{
    name: string;
    email: string;
    role: 'admin' | 'staff';
    force_password_reset: number;
    password?: string;
  }>
) {
  return api.put<UserRecord>(`/api/users/${id}`, payload).then((response) => response.data);
}

export function deleteUser(id: number) {
  return api.delete(`/api/users/${id}`);
}
