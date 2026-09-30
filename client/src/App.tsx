import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import StudentListPage from './pages/StudentListPage';
import StudentFormPage from './pages/StudentFormPage';
import StudentDetailPage from './pages/StudentDetailPage';
import SystemSettingsPage from './pages/SystemSettingsPage';
import UserManagementPage from './pages/UserManagementPage';
import CourseManagementPage from './pages/CourseManagementPage';
import FeeManagementPage from './pages/FeeManagementPage';
import FeeStructuresPage from './pages/FeeStructuresPage';
import FinanceDashboardPage from './pages/FinanceDashboardPage';
import ExpensesPage from './pages/ExpensesPage';
import PayrollPage from './pages/PayrollPage';
import MoneyOutTransactionsPage from './pages/MoneyOutTransactionsPage';
import GoogleDriveSyncPage from './pages/GoogleDriveSyncPage';
import NotFoundPage from './pages/NotFoundPage';
import MainLayout from './components/MainLayout';
import { useAuth } from './contexts/AuthContext';
import { SyncProvider } from './contexts/SyncContext';
import { isTokenExpired } from './lib/tokenUtils';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, token } = useAuth();
  if (!user || !token || isTokenExpired(token)) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user, token } = useAuth();
  if (!user || !token || isTokenExpired(token)) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default function App() {
  return (
    <SyncProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<RequireAuth><ResetPasswordPage /></RequireAuth>} />
          <Route path="/" element={<RequireAuth><MainLayout /></RequireAuth>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="students" element={<StudentListPage />} />
            <Route path="students/new" element={<StudentFormPage />} />
            <Route path="students/:id/edit" element={<StudentFormPage />} />
            <Route path="students/:id" element={<StudentDetailPage />} />
            <Route path="student/:identifier" element={<StudentDetailPage />} />
            <Route path="students/roll/:identifier" element={<StudentDetailPage />} />
            <Route path="fees" element={<FeeManagementPage />} />
            <Route path="finance" element={<FinanceDashboardPage />} />
            <Route path="money-out/dashboard" element={<Navigate to="/finance" replace />} />
            <Route path="money-out/expenses" element={<ExpensesPage />} />
            <Route path="money-out/payroll" element={<PayrollPage />} />
            <Route path="money-out/transactions" element={<MoneyOutTransactionsPage />} />
            <Route path="fee-structures" element={<RequireAdmin><FeeStructuresPage /></RequireAdmin>} />
            <Route path="users" element={<RequireAdmin><UserManagementPage /></RequireAdmin>} />
            <Route path="courses" element={<RequireAdmin><CourseManagementPage /></RequireAdmin>} />
            <Route path="sync" element={<RequireAdmin><GoogleDriveSyncPage /></RequireAdmin>} />
            <Route path="system-settings" element={<RequireAdmin><SystemSettingsPage /></RequireAdmin>} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </div>
    </SyncProvider>
  );
}

