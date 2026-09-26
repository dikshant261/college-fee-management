import React, { useEffect, useState } from 'react';
import { createUser, deleteUser, fetchUsers, updateUser, UserRecord } from '../lib/userApi';
import Toast from '../components/Toast';
import Pagination from '../components/Pagination';

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'staff' as 'admin' | 'staff' });
  const [toast, setToast] = useState<{ message: string; variant?: 'success' | 'error' | 'info' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

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
    } catch (error) {
      setToast({ message: 'Unable to create user.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this user?')) return;
    setLoading(true);
    try {
      await deleteUser(id);
      await loadUsers();
      setToast({ message: 'User deleted.', variant: 'success' });
    } catch (error) {
      setToast({ message: 'Unable to delete user.', variant: 'error' });
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
    } catch (error) {
      setToast({ message: 'Unable to update user.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
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
                .map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-2 border-b border-slate-100 font-medium text-slate-900 text-xs">{user.name}</td>
                  <td className="px-4 py-2 border-b border-slate-100 text-slate-700 text-xs">{user.email}</td>
                  <td className="px-4 py-2 border-b border-slate-100 text-slate-700 text-xs capitalize">{user.role}</td>
                  <td className="px-4 py-2 border-b border-slate-100 text-slate-700 text-xs">{user.force_password_reset ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2 border-b border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => toggleReset(user.id, !user.force_password_reset)}
                        className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs transition"
                      >
                        {user.force_password_reset ? 'Clear Reset' : 'Require Reset'}
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100 shadow-xs transition"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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
      {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}
    </div>
  );
}
