import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { createUser, updateUser, UserRecord } from '../lib/userApi';
import Toast from './Toast';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserRecord | null;
  onSuccess: () => void;
}

export default function UserModal({ isOpen, onClose, user, onSuccess }: UserModalProps) {
  const isEdit = Boolean(user);
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'staff' as 'admin' | 'staff',
    password: '',
    force_password_reset: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant?: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name,
        email: user.email,
        role: user.role,
        password: '',
        force_password_reset: Boolean(user.force_password_reset),
      });
    } else {
      setForm({
        name: '',
        email: '',
        role: 'staff',
        password: 'password123',
        force_password_reset: true,
      });
    }
    setShowPassword(false);
  }, [user, isOpen]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setToast({ message: 'Name and email are required.', variant: 'error' });
      return;
    }

    setLoading(true);
    try {
      if (isEdit && user) {
        const payload: any = {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          role: form.role,
          force_password_reset: form.force_password_reset,
        };
        if (form.password.trim()) {
          payload.password = form.password;
        }
        await updateUser(user.id, payload);
      } else {
        await createUser({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          role: form.role,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setToast({
        message: err?.response?.data?.error || (isEdit ? 'Failed to update user.' : 'Failed to create user.'),
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit User: ${user?.name}` : 'Create New System User'}
      subtitle={isEdit ? 'Modify user account privileges and password' : 'Add administrative or staff credentials'}
      maxWidth="md"
      icon={
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700">Full Name *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. John Doe"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">Email Address *</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="e.g. staff@college.local"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">Access Role</label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'staff' })}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs"
          >
            <option value="staff">Staff (Standard Access)</option>
            <option value="admin">Administrator (Full Control)</option>
          </select>
        </div>

        {isEdit ? (
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">Reset Password (Optional)</label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-2xs text-blue-600 hover:text-blue-800 font-medium"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Leave blank to keep existing password"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs"
            />
          </div>
        ) : (
          <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800">Initial Credentials:</p>
            <p>Default initial password is <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-900 font-bold">password123</code>.</p>
            <p className="text-2xs text-slate-500">The user will be prompted to reset their password upon first login.</p>
          </div>
        )}

        {isEdit && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="force_reset"
              checked={form.force_password_reset}
              onChange={(e) => setForm({ ...form, force_password_reset: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="force_reset" className="text-xs text-slate-700 font-medium cursor-pointer">
              Force password change on next login
            </label>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-2xs"
          >
            {loading ? 'Saving...' : isEdit ? 'Update User' : 'Create User'}
          </button>
        </div>
      </form>
      {toast && <Toast message={toast.message} variant={toast.variant} />}
    </Modal>
  );
}
