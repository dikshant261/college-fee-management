import api from './api';

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'staff';
    force_password_reset: number;
    last_login_at?: string;
  };
}

export function login(email: string, password: string) {
  return api.post<AuthResponse>('/api/auth/login', { email, password }).then((response) => response.data);
}

export function resetPassword(new_password: string) {
  return api.post('/api/auth/reset-password', { new_password }).then((response) => response.data);
}

export function fetchProfile() {
  return api.get<AuthResponse['user']>('/api/auth/me').then((response) => response.data);
}
