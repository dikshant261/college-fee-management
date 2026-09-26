import React, { useState, useRef, useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchSettings } from '../lib/settingsApi';
import HeaderSyncBadge from './HeaderSyncBadge';

const navItems = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Students', path: '/students' },
  { label: 'Fees', path: '/fees' }
];

const adminItems = [
  { label: 'Users', path: '/users' },
  { label: 'Courses', path: '/courses' },
  { label: 'Fee Structures', path: '/fee-structures' },
  { label: 'Drive Sync', path: '/sync' },
  { label: 'System Settings', path: '/system-settings' }
];

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [collegeName, setCollegeName] = useState<string>('');
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Load dynamic college name from database
  useEffect(() => {
    async function loadCollegeName() {
      try {
        const data = await fetchSettings();
        if (data.college_name) {
          setCollegeName(data.college_name);
        }
      } catch (err) {
        // ignore errors
      }
    }
    loadCollegeName();

    function handleSettingsUpdate(e: any) {
      if (e?.detail?.college_name) {
        setCollegeName(e.detail.college_name);
      }
    }
    window.addEventListener('settings:updated', handleSettingsUpdate);
    return () => window.removeEventListener('settings:updated', handleSettingsUpdate);
  }, []);

  // Close popup menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

  // Close popup on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userMenuOpen]);

  const handleLogout = () => {
    setUserMenuOpen(false);
    logout();
    navigate('/login');
  };

  const renderNavLinks = (onItemClick?: () => void) => (
    <div className="space-y-0.5">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          onClick={onItemClick}
          className={({ isActive }) =>
            `flex items-center rounded-md px-3 py-2 text-sm font-medium transition ${isActive
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}

      {user?.role === 'admin' && (
        <div className="mt-4 rounded-md bg-slate-50 border border-slate-200 p-2">
          <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
            System Admin
          </div>
          <div className="mt-1 space-y-0.5">
            {adminItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onItemClick}
                className={({ isActive }) =>
                  `flex items-center rounded-md px-2.5 py-1.5 text-xs font-medium transition ${isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-200/70 hover:text-slate-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 text-slate-900">
      {/* =========================================================================
          DESKTOP SIDEBAR: Fixed to the side, full viewport height
          ========================================================================= */}
      <aside className="hidden lg:flex w-64 flex-col flex-shrink-0 border-r border-slate-200 bg-white h-screen select-none">
        {/* Top Branding Section (Fixed at top) */}
        <div className="flex-shrink-0 border-b border-slate-200 px-5 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white font-bold text-sm shadow-xs">
              CA
            </div>
            <div>
              <Link to="/dashboard" className="block text-base font-bold text-slate-900 leading-tight">
                College Admin
              </Link>
              <p className="text-xs text-slate-500 font-medium">Desktop Application</p>
            </div>
          </div>
        </div>

        {/* Scrollable Middle Navigation Area */}
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 px-3 py-3">
          {renderNavLinks()}
        </div>

        {/* Bottom Administrator Area with Clickable Popup Menu */}
        <div ref={userMenuRef} className="flex-shrink-0 border-t border-slate-200 p-2.5 relative bg-white">
          {userMenuOpen && (
            <div className="absolute bottom-full left-2 right-2 mb-2 z-50 rounded-lg border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-slate-900/5 transition-all">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-xs font-medium text-slate-400">Signed in as</p>
                <p className="text-sm font-semibold text-slate-900 truncate">{user?.name}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
              <div className="mt-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition"
                >
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}

          {/* Clickable Administrator Card */}
          <button
            type="button"
            onClick={() => setUserMenuOpen((prev) => !prev)}
            className={`flex w-full items-center justify-between rounded-md p-2 transition text-left ${userMenuOpen ? 'bg-slate-100 border border-slate-300' : 'hover:bg-slate-50 border border-transparent'
              }`}
            aria-haspopup="true"
            aria-expanded={userMenuOpen}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-blue-600 font-semibold text-white shadow-xs text-xs">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-slate-900">{user?.name || 'Administrator'}</div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  <span className="truncate text-2xs font-medium capitalize text-slate-500">{user?.role || 'admin'}</span>
                </div>
              </div>
            </div>
            <svg
              className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180 text-slate-700' : ''
                }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </aside>

      {/* =========================================================================
          MAIN COLUMN: Header + Scrollable Outlet
          ========================================================================= */}
      <div className="flex flex-1 flex-col h-screen min-w-0 overflow-hidden">
        {/* Top Window Titlebar Header */}
        <header className="flex-shrink-0 border-b border-slate-200 bg-white px-4 py-2.5 shadow-xs z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-slate-50 text-slate-700 lg:hidden hover:bg-slate-100 transition"
                aria-label="Open navigation menu"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="text-sm font-semibold text-slate-800 flex items-center gap-2 flex-wrap">
                <span className="inline-block h-2 w-2 rounded-full bg-blue-600"></span>
                <span>College Management System</span>
                {collegeName ? (
                  <>
                    <span className="text-slate-300 font-normal">|</span>
                    <span className="text-blue-700 font-semibold">{collegeName}</span>
                  </>
                ) : null}
              </div>
              <span className="hidden sm:inline-block text-xs text-slate-300 font-normal">|</span>
              <div className="hidden sm:block text-xs font-medium text-slate-500">
                {user?.role === 'admin' ? 'Administrator Mode' : 'Staff Mode'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <HeaderSyncBadge />
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                Online
              </span>
            </div>
          </div>
        </header>

        {/* Scrollable Outlet Content Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 lg:p-6">
          <div className="mx-auto max-w-7xl pb-4">
            <Outlet />
          </div>
        </main>
      </div>

      {/* =========================================================================
          MOBILE DRAWER SIDEBAR
          ========================================================================= */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer content */}
          <div className="fixed inset-y-0 left-0 flex w-72 flex-col bg-white shadow-2xl">
            {/* Mobile Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 flex-shrink-0">
              <div>
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-xl font-bold text-slate-900"
                >
                  College Admin
                </Link>
                <p className="text-xs text-slate-500">{user?.role === 'admin' ? 'Administrator' : 'Staff'}</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100"
                aria-label="Close navigation"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Mobile Scrollable Navigation */}
            <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 px-4 py-4">
              {renderNavLinks(() => setMobileMenuOpen(false))}
            </div>

            {/* Mobile Bottom Administrator section with Logout */}
            <div className="flex-shrink-0 border-t border-slate-200 p-3 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 font-semibold text-white text-xs">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-900">{user?.name}</p>
                  <p className="truncate text-[10px] text-slate-500 capitalize">{user?.role}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 shadow-xs transition"
              >
                <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
