import React, { useEffect, useState } from 'react';
import { createUser, deleteUser, fetchUsers, updateUser, UserRecord } from '../lib/userApi';
import { useAuth } from '../contexts/AuthContext';
import Toast from '../components/Toast';
import Pagination from '../components/Pagination';

export default function UserManagementPage() {
  const { user: currentUser, refreshUser } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'staff' as 'admin' | 'staff' });
  const [toast, setToast] = useState<{ message: string; variant?: 'success' | 'error' | 'info' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Edit modal state
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: 'staff' as 'admin' | 'staff',
    force_password_reset: false,
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Handle escape key to close edit modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && editingUser && !savingEdit) {
        handleCloseEdit();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingUser, savingEdit]);

  async function loadUsers() {
    setLoading(true);
    try {
      const list = await fetchUsers();
      setUsers(list);
    } catch (error) {
      setToast({ message: 'Unable to load users.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name || !form.email) {
      setToast({ message: 'Name and email are required.', variant: 'error' });
      return;
    }
    setLoading(true);
    try {
      await createUser(form);
      setToast({ message: 'User created successfully.', variant: 'success' });
      setForm({ name: '', email: '', role: 'staff' });
      await loadUsers();
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Unable to create user.';
      setToast({ message: msg, variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  function handleOpenEdit(user: UserRecord) {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      force_password_reset: Boolean(user.force_password_reset),
      password: '',
    });
    setShowPassword(false);
  }

  function handleCloseEdit() {
    if (savingEdit) return;
    setEditingUser(null);
    setEditForm({
      name: '',
      email: '',
      role: 'staff',
      force_password_reset: false,
      password: '',
    });
    setShowPassword(false);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    if (!editForm.name.trim() || !editForm.email.trim()) {
      setToast({ message: 'Name and email are required.', variant: 'error' });
      return;
    }

    setSavingEdit(true);
    try {
      const payload: {
        name: string;
        email: string;
        role: 'admin' | 'staff';
        force_password_reset: number;
        password?: string;
      } = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
        force_password_reset: editForm.force_password_reset ? 1 : 0,
      };

      if (editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }

      const updated = await updateUser(editingUser.id, payload);

      // If the current logged in user was edited, sync local user state
      if (currentUser && currentUser.id === editingUser.id) {
        const storedUser = localStorage.getItem('auth_user');
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            parsed.name = updated.name;
            parsed.email = updated.email;
            parsed.role = updated.role;
            localStorage.setItem('auth_user', JSON.stringify(parsed));
            refreshUser();
          } catch {
            // ignore
          }
        }
      }

      setToast({ message: 'User updated successfully.', variant: 'success' });
      handleCloseEdit();
      await loadUsers();
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Unable to update user.';
      setToast({ message: msg, variant: 'error' });
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(id: number) {
    if (currentUser?.id === id) {
      setToast({ message: 'You cannot delete your own account.', variant: 'error' });
      return;
    }
    if (!window.confirm('Delete this user?')) return;
    setLoading(true);
    try {
      await deleteUser(id);
      await loadUsers();
      setToast({ message: 'User deleted.', variant: 'success' });
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Unable to delete user.';
      setToast({ message: msg, variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function toggleReset(id: number, reset: boolean) {
    setLoading(true);
    try {
      await updateUser(id, { force_password_reset: reset ? 1 : 0 });
      await loadUsers();
      setToast({ message: `User ${reset ? 'marked for' : 'removed from'} password reset.`, variant: 'success' });
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Unable to update user.';
      setToast({ message: msg, variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr?: string | null) {
    if (!dateStr) return 'Never';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="space-y-4">
      {/* Create User Card */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">User Account Management</h1>
          <p className="text-xs text-slate-500">Create staff or administrator login credentials for the portal.</p>
        </div>
        <form onSubmit={handleCreate} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-700">Full Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. John Doe"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Email Address</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="e.g. user@college.edu"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">User Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'staff' })}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
            >
              <option value="staff">Staff (Payments &amp; Records)</option>
              <option value="admin">Administrator (Full Access)</option>
            </select>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-4 py-1.5 text-sm font-medium text-white transition border border-blue-700 shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Create User
            </button>
          </div>
        </form>
      </div>

      {/* User Accounts Table */}
      <div className="sticky top-0 z-20 rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">User Accounts</h2>
            <p className="text-xs text-slate-500">Configured operator accounts and authorization roles.</p>
          </div>
          {loading ? <span className="text-xs text-slate-500">Updating…</span> : null}
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[350px]">
          <table className="min-w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Name</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Email</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Role</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Reset Required</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {users
                .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                .map((user) => {
                  const isCurrent = currentUser?.id === user.id;
                  return (
                    <tr key={user.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-2 border-b border-slate-100 font-medium text-slate-900 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span>{user.name}</span>
                          {isCurrent && (
                            <span className="rounded bg-blue-100 px-1.5 py-0.2 text-2xs font-semibold text-blue-700">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 border-b border-slate-100 text-slate-700 text-xs">{user.email}</td>
                      <td className="px-4 py-2 border-b border-slate-100 text-slate-700 text-xs">
                        <span
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-medium capitalize ${
                            user.role === 'admin'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-2 border-b border-slate-100 text-slate-700 text-xs">
                        <span
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-medium ${
                            user.force_password_reset
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {user.force_password_reset ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-2 border-b border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(user)}
                            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 shadow-xs transition"
                            title="Edit user details"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleReset(user.id, !user.force_password_reset)}
                            className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs transition"
                          >
                            {user.force_password_reset ? 'Clear Reset' : 'Require Reset'}
                          </button>
                          <button
                            type="button"
                            disabled={isCurrent}
                            onClick={() => handleDelete(user.id)}
                            title={isCurrent ? 'You cannot delete your own account' : 'Delete user'}
                            className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100 shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 border-b border-slate-100 text-xs">
                    No users created yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {users.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={users.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemLabel="users"
          />
        )}
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingEdit) {
              handleCloseEdit();
            }
          }}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit User Account</h3>
                  <p className="text-xs text-slate-500">Update account credentials and system role</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseEdit}
                disabled={savingEdit}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 shadow-xs transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="e.g. user@college.edu"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 shadow-xs transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  User Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as 'admin' | 'staff' })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 shadow-xs transition"
                >
                  <option value="staff">Staff (Payments, Records &amp; Inquiries)</option>
                  <option value="admin">Administrator (Full Access &amp; Configuration)</option>
                </select>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    New Password
                  </label>
                  <span className="text-2xs text-slate-400 font-medium">Optional</span>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    placeholder="Leave empty to keep existing password"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 pr-10 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 shadow-xs transition placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-2xs text-slate-500">
                  Only fill this if you want to overwrite the user's password directly.
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3.5">
                <input
                  type="checkbox"
                  id="modal_force_password_reset"
                  checked={editForm.force_password_reset}
                  onChange={(e) => setEditForm({ ...editForm, force_password_reset: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="modal_force_password_reset" className="text-xs text-slate-700 cursor-pointer select-none">
                  <span className="font-semibold text-slate-900 block">Require Password Reset on Next Login</span>
                  <span className="text-slate-500 text-2xs block mt-0.5">
                    User will be prompted to set a new password the next time they sign in.
                  </span>
                </label>
              </div>

              {/* Metadata Info */}
              <div className="rounded-lg bg-slate-100 p-2.5 text-2xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
                <span>User ID: <strong className="text-slate-700 font-mono">#{editingUser.id}</strong></span>
                <span>Created: <strong className="text-slate-700">{formatDate(editingUser.created_at)}</strong></span>
                <span>Last Login: <strong className="text-slate-700">{formatDate(editingUser.last_login_at)}</strong></span>
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  disabled={savingEdit}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 active:bg-blue-800 shadow-xs transition disabled:opacity-50"
                >
                  {savingEdit ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                      </svg>
                      Saving Changes…
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}
    </div>
  );
}
