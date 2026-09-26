import React, { useEffect, useState } from 'react';
import { fetchSettings, updateSettings, SystemSettings } from '../lib/settingsApi';
import Toast from '../components/Toast';

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant?: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const data = await fetchSettings();
      setSettings(data);
    } catch (error) {
      setToast({ message: 'Unable to load system settings.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const updated = await updateSettings(settings);
      setSettings(updated);
      window.dispatchEvent(new CustomEvent('settings:updated', { detail: updated }));
      setToast({ message: 'Settings saved successfully.', variant: 'success' });
    } catch (error) {
      setToast({ message: 'Unable to save settings.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
      <div className="mb-5 border-b border-slate-100 pb-3">
        <h1 className="text-lg font-bold text-slate-900">College System Information</h1>
        <p className="mt-0.5 text-xs text-slate-500">Configure global college settings and defaults used throughout the system.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700">College Name</label>
          <input
            type="text"
            value={settings.college_name ?? ''}
            onChange={(e) => setSettings({ ...settings, college_name: e.target.value })}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700">Current Academic Year</label>
          <input
            type="text"
            value={settings.current_academic_year ?? ''}
            onChange={(e) => setSettings({ ...settings, current_academic_year: e.target.value })}
            placeholder="2025-26"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700">Default User Password</label>
          <input
            type="text"
            value={settings.default_password ?? ''}
            onChange={(e) => setSettings({ ...settings, default_password: e.target.value })}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          />
        </div>
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 border border-blue-700 px-4 py-1.5 text-sm font-medium text-white shadow-xs transition disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>
      {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}
    </div>
  );
}
