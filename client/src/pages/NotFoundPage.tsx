import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-xs">
        <p className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">Error 404</p>
        <h1 className="mt-2 text-xl font-bold text-slate-800">Resource Not Found</h1>
        <p className="mt-2 text-xs text-slate-500">The requested module or resource does not exist in this installation.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 border border-blue-700 px-4 py-1.5 text-xs font-medium text-white shadow-xs transition"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
