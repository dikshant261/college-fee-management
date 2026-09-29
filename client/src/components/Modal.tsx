import React, { useEffect } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  children: React.ReactNode;
}

const maxWidthMap: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
};

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  maxWidth = 'lg',
  children,
}: ModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClass = maxWidthMap[maxWidth] || 'max-w-lg';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`relative flex flex-col w-full ${widthClass} max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in zoom-in-95 duration-150`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Window Header */}
        <div className="flex-shrink-0 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 px-5 py-4 text-white shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {icon ? (
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white">
                  {icon}
                </div>
              ) : null}
              <div className="min-w-0">
                <h3 className="text-base font-bold tracking-tight text-white leading-tight truncate">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-2xs text-slate-300 font-medium truncate mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex-shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-lg bg-white/10 hover:bg-white/25 text-white transition border border-white/20 focus:outline-none"
              aria-label="Close dialog"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 text-slate-700">
          {children}
        </div>
      </div>
    </div>
  );
}
