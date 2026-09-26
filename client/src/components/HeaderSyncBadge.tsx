import React from 'react';
import { Link } from 'react-router-dom';
import { useSync } from '../contexts/SyncContext';

export default function HeaderSyncBadge() {
  const { isConnected, syncing, pendingCount, lastSyncFormatted, status, syncNow } = useSync();

  const handleQuickSync = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await syncNow();
  };

  if (!isConnected) {
    return (
      <Link
        to="/sync"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300 transition"
        title="Google Drive not connected. Click to setup backup."
      >
        <svg className="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z" />
        </svg>
        <span>Drive: Disconnected</span>
      </Link>
    );
  }

  if (syncing) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
        <svg
          className="w-3.5 h-3.5 text-blue-600 animate-spin"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <span>Drive: Syncing...</span>
      </div>
    );
  }

  const isFailed = status?.lastSyncStatus === 'failed';
  if (isFailed) {
    return (
      <Link
        to="/sync"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition"
        title={status?.lastError || 'Last synchronization had an issue. Click to inspect.'}
      >
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
        <span>Drive: Offline / Attention</span>
      </Link>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">
        <Link to="/sync" className="flex items-center gap-1 hover:underline">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
          <span>Drive: {pendingCount} Pending</span>
        </Link>
        <button
          type="button"
          onClick={handleQuickSync}
          className="ml-1 px-1.5 py-0.5 text-2xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded transition shadow-2xs"
          title="Sync pending changes now"
        >
          Sync Now
        </button>
      </div>
    );
  }

  return (
    <Link
      to="/sync"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition"
      title={`All changes synced to Google Drive. Last sync: ${lastSyncFormatted}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
      <span>Drive: Synced ({lastSyncFormatted})</span>
    </Link>
  );
}
