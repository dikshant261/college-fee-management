import React from 'react';

interface ToastProps {
  message: string;
  variant?: 'success' | 'error' | 'info';
}

const variantClasses: Record<NonNullable<ToastProps['variant']>, string> = {
  success: 'bg-emerald-700 text-white border-emerald-800',
  error: 'bg-rose-700 text-white border-rose-800',
  info: 'bg-slate-800 text-white border-slate-900'
};

export default function Toast({ message, variant = 'info' }: ToastProps) {
  if (!message) return null;
  return (
    <div className={`fixed bottom-4 right-4 rounded-md border px-3.5 py-2 text-xs font-medium shadow-md ${variantClasses[variant]} z-50 transition-all`}>
      {message}
    </div>
  );
}
