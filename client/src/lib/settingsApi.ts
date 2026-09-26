import api from './api';

export interface SystemSettings {
  college_name?: string;
  current_academic_year?: string;
  default_password?: string;
}

export function fetchSettings() {
  return api.get<SystemSettings>('/api/settings').then((response) => response.data);
}

export function updateSettings(payload: SystemSettings) {
  return api.put<SystemSettings>('/api/settings', payload).then((response) => response.data);
}
