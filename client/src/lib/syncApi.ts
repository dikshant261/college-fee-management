import axios from 'axios';

const base = import.meta.env.VITE_API_BASE || '';
function makeBaseURL() {
  if (base) return base;
  const host = window.location.hostname;
  const port = window.location.port || import.meta.env.VITE_API_PORT || '5000';
  return `${window.location.protocol}//${host}:${port}`;
}

const api = axios.create({ baseURL: makeBaseURL() });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface SyncStatus {
  connected: boolean;
  syncing: boolean;
  pendingChanges: number;
  lastSyncAt: string | null;
  lastSyncStatus: 'success' | 'failed' | 'idle' | 'never' | 'partial';
  lastError: string | null;
  syncIntervalMinutes: number;
  folderName: string | null;
  userEmail: string | null;
}

export interface GoogleStatus {
  connected: boolean;
  configured: boolean;
  userEmail: string | null;
  folderId: string | null;
  folderName: string | null;
  hasDriveScope?: boolean;
}

export interface UploadFileAction {
  path: string;
  action: 'uploaded' | 'updated' | 'deleted';
}

export interface SyncCommitDetail {
  version: number;
  timestamp: string;
  trigger: string;
  summary: string;
  recordsCount: number;
  filesSyncedCount: number;
  tableChanges: Array<{
    table: string;
    recordId: string;
    operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'SKIP';
  }>;
  filesSynced: UploadFileAction[];
  dbSnapshot?: {
    fileId: string;
    sizeBytes: number;
  };
}

export interface SyncHistoryItem {
  id: number;
  trigger_type: 'manual' | 'automatic' | 'restore';
  status: 'success' | 'failed' | 'partial';
  items_synced: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  details?: string | null;
}

export async function fetchSyncStatus(): Promise<SyncStatus> {
  const res = await api.get('/api/sync/status');
  return res.data;
}

export async function fetchPendingSummary(): Promise<Record<string, number>> {
  const res = await api.get('/api/sync/summary');
  return res.data;
}

export async function fetchSyncHistory(limit = 20): Promise<SyncHistoryItem[]> {
  const res = await api.get(`/api/sync/history?limit=${limit}`);
  return res.data;
}

export async function triggerManualSync(): Promise<{
  success: boolean;
  message: string;
  syncedRecords?: number;
}> {
  const res = await api.post('/api/sync');
  return res.data;
}

export async function triggerDatabaseRestore(): Promise<{
  success: boolean;
  message: string;
  backupFile: string;
}> {
  const res = await api.post('/api/sync/restore');
  return res.data;
}

export async function fetchGoogleStatus(): Promise<GoogleStatus> {
  const res = await api.get('/api/google/status');
  return res.data;
}

export async function fetchGoogleAuthUrl(): Promise<string> {
  const res = await api.get('/api/google/auth');
  return res.data.url;
}

export async function disconnectGoogleDrive(): Promise<{ success: boolean; message: string }> {
  const res = await api.post('/api/google/disconnect');
  return res.data;
}
