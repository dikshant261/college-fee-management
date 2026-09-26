import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSync } from '../contexts/SyncContext';
import {
  fetchGoogleStatus,
  fetchGoogleAuthUrl,
  disconnectGoogleDrive,
  fetchSyncHistory,
  GoogleStatus,
  SyncHistoryItem,
  SyncCommitDetail,
} from '../lib/syncApi';

export default function GoogleDriveSyncPage() {
  const { status, pendingSummary, syncing, pendingCount, syncNow, refreshStatus } = useSync();
  const [searchParams] = useSearchParams();

  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [history, setHistory] = useState<SyncHistoryItem[]>([]);
  const [expandedCommits, setExpandedCommits] = useState<Record<number, boolean>>({});
  const [loadingGoogle, setLoadingGoogle] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);


  const toggleExpand = (id: number) => {
    setExpandedCommits((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const parseCommit = (item: SyncHistoryItem): SyncCommitDetail | null => {
    if (!item.details) return null;
    try {
      return JSON.parse(item.details) as SyncCommitDetail;
    } catch {
      return null;
    }
  };

  // Load status and history
  const loadData = async () => {
    try {
      const [gStatus, hist] = await Promise.all([
        fetchGoogleStatus().catch((err) => {
          console.warn('fetchGoogleStatus error:', err);
          return { connected: false, configured: true, userEmail: null, folderId: null, folderName: null };
        }),
        fetchSyncHistory(25).catch(() => []),
      ]);
      setGoogleStatus(gStatus);
      setHistory(hist);
    } catch (err) {
      console.error('Failed to load Google status / history:', err);
    } finally {
      setLoadingGoogle(false);
    }
  };

  useEffect(() => {
    loadData();

    // Check if redirected from Google OAuth
    const googleParam = searchParams.get('google');
    if (googleParam === 'connected') {
      const email = searchParams.get('email');
      setActionMessage({
        type: 'success',
        text: `Google Drive successfully connected${email ? ` as ${email}` : ''}! Initial backup will run on first sync.`,
      });
      refreshStatus();
    } else if (googleParam === 'scope_missing') {
      setActionMessage({
        type: 'error',
        text: 'Action Required: Google Drive file permission was NOT checked on the Google consent screen. Please click "Reconnect & Grant Permission" and check the box.',
      });
      refreshStatus();
    } else if (googleParam === 'error') {
      const msg = searchParams.get('message');
      setActionMessage({
        type: 'error',
        text: `Google OAuth failed: ${msg || 'Unknown error occurred'}`,
      });
    }
  }, [searchParams, refreshStatus]);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setActionMessage(null);
      const url = await fetchGoogleAuthUrl();
      window.location.href = url;
    } catch (err: any) {
      setConnecting(false);
      setActionMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Failed to start Google authentication.',
      });
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Google Drive? Local SQLite data will remain safe.')) {
      return;
    }

    try {
      setActionMessage(null);
      await disconnectGoogleDrive();
      await loadData();
      await refreshStatus();
      setActionMessage({
        type: 'success',
        text: 'Google Drive disconnected successfully.',
      });
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Failed to disconnect.',
      });
    }
  };

  const handleManualSync = async () => {
    setActionMessage(null);
    const result = await syncNow();
    if (result.success) {
      setActionMessage({
        type: 'success',
        text: result.message || 'Synchronization completed successfully.',
      });
    } else {
      setActionMessage({
        type: 'error',
        text: result.message || 'Synchronization failed.',
      });
    }
    loadData();
  };


  const isConnected = Boolean(googleStatus?.connected);
  const isConfigured = Boolean(googleStatus?.configured);
  const needsPermissionGrant = isConnected && googleStatus?.hasDriveScope === false;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z" />
            </svg>
            Google Drive Backup & Synchronization
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Offline-first backup ensuring local SQLite database (college.db) and uploads folder are mirrored to Google Drive.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs transition"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Action Notification Message */}
      {actionMessage && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{actionMessage.type === 'success' ? '✓' : '✕'}</span>
            <span className="font-medium">{actionMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Grid: Account Connection & Live Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Card 1: Google Account Connection */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Google Drive Account</h2>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-2xs font-semibold ${
                  needsPermissionGrant
                    ? 'bg-amber-100 text-amber-800'
                    : isConnected
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {needsPermissionGrant ? 'Permission Incomplete' : isConnected ? 'Connected' : 'Not Connected'}
              </span>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              {loadingGoogle ? (
                <p className="text-slate-400 animate-pulse">Loading connection details...</p>
              ) : needsPermissionGrant ? (
                <div className="rounded-md bg-amber-50 border border-amber-300 p-3 text-amber-900 space-y-1.5">
                  <p className="font-bold text-xs flex items-center gap-1.5 text-amber-900">
                    <span>⚠️</span> Google Drive Permission Missing
                  </p>
                  <p className="text-2xs text-amber-800 leading-relaxed">
                    Signed in as <strong>{googleStatus?.userEmail}</strong>, but the checkbox for <strong>Google Drive file access</strong> was left unchecked on Google's sign-in screen.
                  </p>
                  <p className="text-2xs text-amber-900 font-semibold">
                    Click "Reconnect & Grant Permission" below, and on the Google screen, check the box: <em>"See, edit, create, and delete only the specific Google Drive files you use with this app"</em>.
                  </p>
                </div>
              ) : isConnected ? (
                <>
                  <div>
                    <span className="text-slate-500 font-medium">Connected Account:</span>
                    <p className="text-slate-900 font-semibold truncate mt-0.5">
                      {googleStatus?.userEmail || 'Google Account Linked'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Remote Folder:</span>
                    <p className="text-slate-900 font-semibold truncate mt-0.5">
                      {googleStatus?.folderName || 'College Management System Backup'}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 text-2xs text-slate-500">
                    Permissions: App-specific folder access only (<code className="bg-slate-100 px-1 py-0.5 rounded">drive.file</code>).
                  </div>
                </>
              ) : !isConfigured ? (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-amber-800">
                  <p className="font-semibold text-2xs uppercase tracking-wide">Configuration Needed</p>
                  <p className="mt-1 text-2xs leading-relaxed">
                    Set <code className="bg-white px-1 py-0.5 rounded">GOOGLE_CLIENT_ID</code> and{' '}
                    <code className="bg-white px-1 py-0.5 rounded">GOOGLE_CLIENT_SECRET</code> in{' '}
                    <code className="bg-white px-1 py-0.5 rounded">server/.env</code> to enable OAuth.
                  </p>
                </div>
              ) : (
                <p className="text-slate-600">
                  Connect your Google account to automatically mirror and protect college data in Google Drive.
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            {needsPermissionGrant ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={connecting}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 transition shadow-xs cursor-pointer"
                >
                  {connecting ? 'Redirecting to Google...' : 'Reconnect & Grant Permission'}
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="w-full text-center text-xs text-slate-500 hover:text-slate-700 py-1 transition cursor-pointer"
                >
                  Disconnect Account
                </button>
              </div>
            ) : isConnected ? (
              <button
                type="button"
                onClick={handleDisconnect}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold transition cursor-pointer"
              >
                Disconnect Google Drive
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition shadow-xs cursor-pointer disabled:bg-blue-400 disabled:cursor-wait"
              >
                <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
                </svg>
                Connect Google Drive
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Synchronization Status & Controls */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between lg:col-span-2">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Synchronization Status</h2>
              <div className="flex items-center gap-2">
                <span className="text-2xs text-slate-500 font-medium">Auto-sync:</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Every {status?.syncIntervalMinutes || 5} min
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wide">Status</span>
                <div className="mt-1 flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      syncing
                        ? 'bg-blue-500 animate-pulse'
                        : isConnected
                        ? 'bg-emerald-500'
                        : 'bg-slate-400'
                    }`}
                  ></span>
                  <p className="text-xs font-bold text-slate-800 capitalize">
                    {syncing ? 'Syncing...' : isConnected ? (status?.lastSyncStatus || 'Idle') : 'Not Connected'}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wide">Pending Changes</span>
                <p className="mt-1 text-sm font-bold text-blue-600">
                  {pendingCount}
                </p>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wide">Last Synchronized</span>
                <p className="mt-1 text-xs font-semibold text-slate-800">
                  {status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Never'}
                </p>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wide">Tracked Sync Targets</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    uploads/
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                    college.db
                  </span>
                </div>
              </div>
            </div>

            {/* Pending breakdown per table */}
            <div className="mt-4">
              <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">
                Pending Database Changes
              </span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.keys(pendingSummary).length === 0 ? (
                  <span className="text-xs text-slate-500 italic">No unsynced changes. Database is fully up to date.</span>
                ) : (
                  Object.entries(pendingSummary).map(([table, count]) => (
                    <span
                      key={table}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
                    >
                      <span className="capitalize">{table.replace('_', ' ')}</span>
                      <span className="font-bold text-blue-600 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                        {count}
                      </span>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Syncs the college.db SQLite database file and uploads folder to Google Drive.
            </p>
            <button
              type="button"
              onClick={handleManualSync}
              disabled={!isConnected || syncing}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold text-white transition shadow-xs ${
                !isConnected || syncing
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
              }`}
            >
              {syncing ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Syncing with Drive...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>


      {/* Card 4: GitHub-like Revision Timeline & Change History */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-700" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M10.5 7.75a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm1.43.75a4.002 4.002 0 01-7.86 0H.75a.75.75 0 110-1.5h3.32a4.002 4.002 0 017.86 0h3.32a.75.75 0 110 1.5h-3.32z" />
              </svg>
              Revision History & Change Tracker (Git-style)
            </h2>
            <p className="text-2xs text-slate-500 mt-0.5">
              Every created, updated, and deleted record, media upload, and database snapshot tracked with full changelogs
            </p>
          </div>
          <span className="text-2xs text-slate-400 font-medium self-start sm:self-auto">
            Showing latest {history.length} sync commits
          </span>
        </div>

        {history.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <svg className="w-10 h-10 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs font-medium text-slate-500">No synchronization events recorded yet.</p>
            <p className="text-2xs text-slate-400 mt-0.5">Connect Google Drive and click "Sync Now" to create your first commit.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {history.map((item, index) => {
              const commit = parseCommit(item);
              const isExpanded = Boolean(expandedCommits[item.id]);
              const tableChanges = commit?.tableChanges || [];
              const filesSynced = commit?.filesSynced || [];
              const dbSnapshot = commit?.dbSnapshot;

              // Change metrics counts
              const creates = tableChanges.filter((c) => c.operation === 'CREATE').length;
              const updates = tableChanges.filter((c) => c.operation === 'UPDATE').length;
              const deletes = tableChanges.filter((c) => c.operation === 'DELETE').length;

              const isInitial = item.trigger_type as string === 'initial_backup' || commit?.trigger === 'initial_backup';

              return (
                <div
                  key={item.id}
                  className={`rounded-lg border transition duration-150 ${
                    item.status === 'failed'
                      ? 'border-red-200 bg-red-50/20'
                      : isExpanded
                      ? 'border-blue-300 bg-blue-50/10 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  {/* Commit Main Header Row */}
                  <div className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {/* Git commit icon badge */}
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5 ${
                          item.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : item.status === 'partial'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                          <path fillRule="evenodd" d="M10.5 7.75a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm1.43.75a4.002 4.002 0 01-7.86 0H.75a.75.75 0 110-1.5h3.32a4.002 4.002 0 017.86 0h3.32a.75.75 0 110 1.5h-3.32z" />
                        </svg>
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-800">
                            rev #{commit?.version || item.id}
                          </span>

                          {/* Trigger Pill */}
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-2xs font-semibold ${
                              isInitial
                                ? 'bg-indigo-100 text-indigo-800'
                                : item.trigger_type === 'automatic'
                                ? 'bg-blue-100 text-blue-800'
                                : item.trigger_type === 'restore'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {isInitial
                              ? 'Initial Backup'
                              : item.trigger_type === 'automatic'
                              ? 'Scheduled Auto'
                              : item.trigger_type === 'restore'
                              ? 'Database Restore'
                              : 'Manual Sync'}
                          </span>

                          {/* Status Pill */}
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-bold uppercase ${
                              item.status === 'success'
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.status === 'partial'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {item.status}
                          </span>

                          <span className="text-2xs text-slate-400">
                            {new Date(item.started_at).toLocaleString([], {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>

                        {/* Commit Message / Summary */}
                        <p className="text-xs text-slate-700 mt-1 font-medium">
                          {commit?.summary || item.error_message || `${item.items_synced} item(s) synchronized`}
                        </p>
                      </div>
                    </div>

                    {/* Change Diff Badges & Expand Button */}
                    <div className="flex items-center gap-2 self-end md:self-center">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {creates > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            +{creates} created
                          </span>
                        )}
                        {updates > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            ~{updates} updated
                          </span>
                        )}
                        {deletes > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-bold bg-red-50 text-red-700 border border-red-200">
                            -{deletes} deleted
                          </span>
                        )}
                        {filesSynced.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                            📷 {filesSynced.length} file{filesSynced.length > 1 ? 's' : ''}
                          </span>
                        )}
                        {dbSnapshot && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                            💾 {Math.round(dbSnapshot.sizeBytes / 1024)} KB
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleExpand(item.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-semibold rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 transition"
                      >
                        {isExpanded ? 'Hide Details' : 'View Changes'}
                        <svg
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Expanded Git-like Diff Panel */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-slate-50/70 p-4 space-y-4">
                      {item.error_message && (
                        <div className="p-3 rounded bg-red-100/70 border border-red-200 text-red-900 text-xs">
                          <strong>Sync Error:</strong> {item.error_message}
                        </div>
                      )}

                      {/* Section 1: Database Table Changes */}
                      <div>
                        <h4 className="text-2xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                          <span>🗄️</span> SQLite Records Changed ({tableChanges.length})
                        </h4>
                        {tableChanges.length === 0 ? (
                          <p className="text-2xs text-slate-400 italic">No specific record mutations in this revision.</p>
                        ) : (
                          <div className="bg-white rounded-md border border-slate-200 overflow-hidden">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 text-3xs font-bold text-slate-400 uppercase tracking-wider bg-slate-100/60">
                                  <th className="py-1.5 px-3">Operation</th>
                                  <th className="py-1.5 px-3">Table</th>
                                  <th className="py-1.5 px-3">Record Identifier</th>
                                  <th className="py-1.5 px-3">Destination File</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-mono text-2xs">
                                {tableChanges.map((change, cIdx) => (
                                  <tr key={cIdx} className="hover:bg-slate-50/60">
                                    <td className="py-1.5 px-3 font-sans">
                                      {change.operation === 'CREATE' && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-bold bg-emerald-100 text-emerald-800">
                                          + CREATE
                                        </span>
                                      )}
                                      {change.operation === 'UPDATE' && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-bold bg-blue-100 text-blue-800">
                                          ~ UPDATE
                                        </span>
                                      )}
                                      {change.operation === 'DELETE' && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-bold bg-red-100 text-red-800">
                                          - DELETE
                                        </span>
                                      )}
                                      {change.operation === 'SKIP' && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-bold bg-slate-100 text-slate-600">
                                          SKIP
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-1.5 px-3 font-semibold font-sans text-slate-700 capitalize">
                                      {change.table.replace('_', ' ')}
                                    </td>
                                    <td className="py-1.5 px-3 text-slate-600">
                                      {change.recordId}
                                    </td>
                                    <td className="py-1.5 px-3 text-slate-400">
                                      {change.table}.json
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Section 2: Uploads Assets Synchronized */}
                      <div>
                        <h4 className="text-2xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                          <span>📁</span> Uploads Directory Changes ({filesSynced.length})
                        </h4>
                        {filesSynced.length === 0 ? (
                          <p className="text-2xs text-slate-400 italic">No media or document files altered in this cycle.</p>
                        ) : (
                          <div className="bg-white rounded-md border border-slate-200 overflow-hidden divide-y divide-slate-100 text-xs">
                            {filesSynced.map((file, fIdx) => (
                              <div key={fIdx} className="p-2 px-3 flex items-center justify-between font-mono text-2xs">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-3xs font-bold font-sans uppercase ${
                                      file.action === 'uploaded'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : file.action === 'updated'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}
                                  >
                                    {file.action}
                                  </span>
                                  <span className="text-slate-800">{file.path}</span>
                                </div>
                                <span className="text-slate-400 text-3xs font-sans">
                                  Synced to Drive: uploads/{file.path}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Section 3: SQLite Database Snapshot */}
                      {dbSnapshot && (
                        <div>
                          <h4 className="text-2xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                            <span>💾</span> SQLite Binary Snapshot (college.db)
                          </h4>
                          <div className="bg-white rounded-md border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 bg-purple-100 text-purple-800 rounded font-bold text-2xs">
                                SQLITE3
                              </span>
                              <div>
                                <p className="font-semibold text-slate-800 font-mono text-2xs">college.db</p>
                                <p className="text-3xs text-slate-500">
                                  Snapshot taken with WAL checkpoint flush (PASSIVE)
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-2xs font-mono text-slate-600">
                              <span>Size: {(dbSnapshot.sizeBytes / 1024).toFixed(1)} KB</span>
                              <span className="text-3xs bg-slate-100 px-2 py-0.5 rounded text-slate-500 truncate max-w-xs">
                                ID: {dbSnapshot.fileId}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>


    </div>
  );
}

