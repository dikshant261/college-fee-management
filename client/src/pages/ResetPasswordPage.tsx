import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Toast from '../components/Toast';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { user, resetPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant?: 'success' | 'error' | 'info' } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setToast({ message: 'Passwords do not match.', variant: 'error' });
      return;
    }
    setLoading(true);
    try {
      await resetPassword(password);
      setToast({ message: 'Password reset successfully.', variant: 'success' });
      navigate('/dashboard');
    } catch (error) {
      setToast({ message: 'Unable to reset password.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return <div className="min-h-screen bg-slate-50 p-10 text-center text-slate-700">Please sign in first.</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-200 px-4 py-10">
      <div className="w-full max-w-sm overflow-hidden rounded-lg border border-slate-300 bg-white shadow-md">
        {/* Native window title bar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-600"></span>
            <span>Security - Reset Password</span>
          </div>
        </div>

        <div className="p-6">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Reset Your Password</h1>
            <p className="mt-1 text-xs text-slate-500">Your account requires a new password before accessing the system.</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-slate-700">New Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Confirm Password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </label>
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 border border-blue-700 px-4 py-2 text-sm font-medium text-white shadow-xs transition disabled:opacity-50"
              >
                {loading ? 'Updating…' : 'Reset Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
      {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}
    </div>
  );
}
