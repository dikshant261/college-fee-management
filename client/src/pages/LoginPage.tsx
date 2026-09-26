import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Toast from '../components/Toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login: loginUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant?: 'success' | 'error' | 'info' } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await loginUser(email, password);
      if (response.user.force_password_reset) {
        navigate('/reset-password');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      setToast({ message: 'Invalid email or password.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-200 px-4 py-10">
      <div className="w-full max-w-sm overflow-hidden rounded-lg border border-slate-300 bg-white shadow-md">
        {/* Native window title bar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-600"></span>
            <span>College Management System</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">v1.0</span>
        </div>

        <div className="p-6">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Administrator Sign In</h1>
            <p className="mt-1 text-xs text-slate-500">Enter your credentials to access system records.</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Email Address</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@college.edu"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                {loading ? 'Authenticating…' : 'Sign In'}
              </button>
            </div>
          </form>
        </div>
      </div>
      {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}
    </div>
  );
}
