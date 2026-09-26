import React from 'react';
import { Link } from 'react-router-dom';

const collegeName = import.meta.env.VITE_COLLEGE_NAME || 'My College';

export default function Landing() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="bg-white shadow-lg rounded-lg p-10 max-w-2xl w-full mx-4">
        <h1 className="text-3xl font-bold mb-2">Welcome to {collegeName}</h1>
        <p className="text-gray-600 mb-6">College Fee Tracking System — local-first, easy to extend.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link to="/students" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium text-center shadow-xs">Student Management</Link>
          <Link to="/students/new" className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-md text-sm font-medium text-center shadow-xs">Add Student</Link>
          <Link to="/" className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-md text-sm font-medium text-center shadow-xs">Home</Link>
        </div>

        <div className="mt-6 text-sm text-gray-500">
          <p>Frontend: React + Vite + TypeScript + Tailwind</p>
          <p>Backend: Node + Express + SQLite (better-sqlite3)</p>
        </div>
      </div>
    </div>
  );
}
