import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { login as loginRequest, resetPassword as resetPasswordRequest } from '../lib/authApi';
import { isTokenExpired, getTokenRemainingMs } from '../lib/tokenUtils';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  force_password_reset: number;
  last_login_at?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<{ user: AuthUser; token: string }>; 
  logout: () => void;
  refreshUser: () => void;
  resetPassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const stored = localStorage.getItem('auth_token');
    if (!stored || isTokenExpired(stored)) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      return null;
    }
    return stored;
  });

  const [user, setUser] = useState<AuthUser | null>(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (!storedToken || isTokenExpired(storedToken)) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      return null;
    }
    const storedUser = localStorage.getItem('auth_user');
    return storedUser ? JSON.parse(storedUser) : null;
  });

  useEffect(() => {
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('auth_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('auth_user');
    }
  }, [user]);

  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
      setToken(null);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    };

    window.addEventListener('auth:expired', handleExpired);

    const checkTokenExpiration = () => {
      const currentToken = localStorage.getItem('auth_token');
      if (currentToken && isTokenExpired(currentToken)) {
        handleExpired();
      }
    };

    window.addEventListener('focus', checkTokenExpiration);
    document.addEventListener('visibilitychange', checkTokenExpiration);

    let timer: number | undefined;
    if (token) {
      if (isTokenExpired(token)) {
        handleExpired();
      } else {
        const remainingMs = getTokenRemainingMs(token);
        if (remainingMs > 0 && remainingMs < 2147483647) {
          timer = window.setTimeout(handleExpired, remainingMs);
        }
      }
    }

    return () => {
      window.removeEventListener('auth:expired', handleExpired);
      window.removeEventListener('focus', checkTokenExpiration);
      document.removeEventListener('visibilitychange', checkTokenExpiration);
      if (timer) window.clearTimeout(timer);
    };
  }, [token]);

  const login = async (email: string, password: string) => {
    const response = await loginRequest(email, password);
    setUser(response.user);
    setToken(response.token);
    return response;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  };

  const resetPassword = async (newPassword: string) => {
    await resetPasswordRequest(newPassword);
    if (user) {
      setUser({ ...user, force_password_reset: 0 });
    }
  };

  const refreshUser = () => {
    const currentToken = localStorage.getItem('auth_token');
    if (!currentToken || isTokenExpired(currentToken)) {
      logout();
      return;
    }
    const stored = localStorage.getItem('auth_user');
    setUser(stored ? JSON.parse(stored) : null);
    setToken(currentToken);
  };

  const value = useMemo(
    () => ({ user, token, login, logout, refreshUser, resetPassword }),
    [user, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
