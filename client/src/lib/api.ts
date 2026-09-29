import axios from 'axios';
import { isTokenExpired } from './tokenUtils';

const base = import.meta.env.VITE_API_BASE || '';

function makeBaseURL() {
  if (base) return base;
  const host = window.location.hostname;
  const port = window.location.port || import.meta.env.VITE_API_PORT || '5000';
  return `${window.location.protocol}//${host}:${port}`;
}

const api = axios.create({ baseURL: makeBaseURL() });

function handleSessionExpired() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  window.dispatchEvent(new Event('auth:expired'));
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    if (isTokenExpired(token)) {
      handleSessionExpired();
      return Promise.reject(new Error('Session expired. Please log in again.'));
    }
    if (config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      handleSessionExpired();
    } else if (error.response?.status === 403 && error.response?.data?.force_password_reset) {
      const stored = localStorage.getItem('auth_user');
      if (stored) {
        try {
          const user = JSON.parse(stored);
          user.force_password_reset = 1;
          localStorage.setItem('auth_user', JSON.stringify(user));
        } catch {}
      }
      if (window.location.pathname !== '/reset-password') {
        window.location.href = '/reset-password';
      }
    }
    return Promise.reject(error);
  }
);

export function getAssetUrl(assetPath?: string | null): string {
  if (!assetPath) return '';
  if (assetPath.startsWith('http://') || assetPath.startsWith('https://') || assetPath.startsWith('data:')) {
    return assetPath;
  }
  const base = makeBaseURL();
  return `${base}${assetPath.startsWith('/') ? '' : '/'}${assetPath}`;
}

export default api;
