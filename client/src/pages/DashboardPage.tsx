import React from 'react';

export default function DashboardPage() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold text-slate-800">Welcome to the Administration Console</h1>
        <p className="max-w-2xl text-xs text-slate-500">College Administration Portal — Use the sidebar navigation to manage student directories, fee collection, fee structures, courses, and system accounts.</p>
      </div>
    </div>
  );
}
