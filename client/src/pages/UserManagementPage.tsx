import React, { useEffect, useState } from 'react';
import { deleteUser, fetchUsers, updateUser, UserRecord } from '../lib/userApi';
import { useAuth } from '../contexts/AuthContext';
import Toast from '../components/Toast';
import Pagination from '../components/Pagination';
import UserModal from '../components/UserModal';

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant?: 'success' | 'error' | 'info' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);

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

  function handleOpenCreate() {
    setSelectedUser(null);
    setIsModalOpen(true);
  }

  function handleOpenEdit(user: UserRecord) {
    setSelectedUser(user);
    setIsModalOpen(true);
  }

  async function handleDelete(id: number) {
    if (currentUser?.id === id) {
      setToast({ message: 'You cannot delete your own account.', variant: 'error' });
      return;
    }
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    setLoading(true);
    try {
      await deleteUser(id);
      await loadUsers();
      setToast({ message: 'User deleted successfully.', variant: 'success' });
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

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">User Account Management</h1>
            <p className="text-xs text-slate-500">Configure operator accounts, roles, and administrative credentials.</p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Add New User
          </button>
        </div>
      </div>

      {/* User Accounts Table */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">User Accounts</h2>
            <p className="text-xs text-slate-500">Configured operator accounts and authorization roles ({users.length} total).</p>
          </div>
          {loading ? <span className="text-xs text-slate-500">Updating…</span> : null}
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[350px]">
          <table className="min-w-[750px] w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs whitespace-nowrap min-w-[180px]">Name</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs whitespace-nowrap min-w-[180px]">Email / Username</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs whitespace-nowrap min-w-[120px]">Role</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs whitespace-nowrap min-w-[130px]">Reset Required</th>
                <th className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2.5 text-left text-xs uppercase tracking-wider text-slate-700 font-semibold shadow-xs whitespace-nowrap min-w-[140px]">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {users
                .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                .map((user) => {
                  const isCurrent = currentUser?.id === user.id;
                  return (
                    <tr key={user.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-2.5 border-b border-slate-100 font-semibold text-slate-900 text-xs whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{user.name}</span>
                          {isCurrent && (
                            <span className="rounded bg-blue-100 px-1.5 py-0.2 text-2xs font-semibold text-blue-700">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 border-b border-slate-100 text-slate-700 text-xs whitespace-nowrap font-mono">{user.email}</td>
                      <td className="px-4 py-2.5 border-b border-slate-100 text-slate-700 text-xs whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded px-2 py-0.5 text-2xs font-semibold capitalize ${
                            user.role === 'admin'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 border-b border-slate-100 text-slate-700 text-xs whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded px-2 py-0.5 text-2xs font-semibold ${
                            user.force_password_reset
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {user.force_password_reset ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 border-b border-slate-100 whitespace-nowrap">
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
                            className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-30 shadow-xs transition"
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
                    No user accounts found. Click "+ Add New User" to create one.
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

      {/* User Modal for Create and Edit */}
      <UserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        user={selectedUser}
        onSuccess={loadUsers}
      />

      {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}
    </div>
  );
}
