import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  fetchSyncStatus,
  fetchPendingSummary,
  triggerManualSync,
  SyncStatus,
} from '../lib/syncApi';

interface SyncContextType {
  status: SyncStatus | null;
  pendingSummary: Record<string, number>;
  loading: boolean;
  syncing: boolean;
  pendingCount: number;
  isConnected: boolean;
  lastSyncFormatted: string;
  syncNow: () => Promise<{ success: boolean; message: string }>;
  refreshStatus: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [pendingSummary, setPendingSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);

  const refreshStatus = useCallback(async () => {
    try {
      const [newStatus, summary] = await Promise.all([
        fetchSyncStatus(),
        fetchPendingSummary().catch(() => ({})),
      ]);
      setStatus(newStatus);
      setPendingSummary(summary);
      setSyncing(Boolean(newStatus.syncing));
    } catch (err) {
      // Offline or network error
      setStatus((prev) =>
        prev
          ? { ...prev, lastSyncStatus: 'failed', lastError: 'Server unreachable / Offline' }
          : null
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    // Poll status every 20 seconds
    const interval = setInterval(refreshStatus, 20000);

    function onFocus() {
      refreshStatus();
    }
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshStatus]);

  const syncNow = async (): Promise<{ success: boolean; message: string }> => {
    if (syncing) {
      return { success: false, message: 'Sync already in progress' };
    }

    setSyncing(true);
    try {
      const result = await triggerManualSync();
      await refreshStatus();
      return result;
    } catch (err: any) {
      await refreshStatus();
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Sync failed',
      };
    } finally {
      setSyncing(false);
    }
  };

  const isConnected = Boolean(status?.connected);
  const pendingCount = status?.pendingChanges || 0;

  const lastSyncFormatted = status?.lastSyncAt
    ? new Date(status.lastSyncAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Never';

  return (
    <SyncContext.Provider
      value={{
        status,
        pendingSummary,
        loading,
        syncing,
        pendingCount,
        isConnected,
        lastSyncFormatted,
        syncNow,
        refreshStatus,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
