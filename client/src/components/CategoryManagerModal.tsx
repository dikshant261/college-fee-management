import React, { useState } from 'react';
import Modal from './Modal';
import { ExpenseCategory, createExpenseCategory, toggleExpenseCategory } from '../lib/financeApi';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ExpenseCategory[];
  onCategoriesChanged: () => void;
}

export default function CategoryManagerModal({
  isOpen,
  onClose,
  categories,
  onCategoriesChanged
}: CategoryManagerModalProps) {
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setError(null);
    setLoading(true);
    try {
      await createExpenseCategory({
        name: newCatName.trim(),
        description: newCatDesc.trim() || undefined
      });
      setNewCatName('');
      setNewCatDesc('');
      onCategoriesChanged();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to add category');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(id: number, currentActive: number) {
    try {
      await toggleExpenseCategory(id, currentActive === 1 ? false : true);
      onCategoriesChanged();
    } catch (err: any) {
      setError('Failed to update category status');
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Expense Categories"
      subtitle="Configure default and custom categories for institutional spending"
      maxWidth="lg"
      icon={
        <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
          />
        </svg>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
            {error}
          </div>
        )}

        {/* Add New Category Form */}
        <form onSubmit={handleAddCategory} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
          <div className="text-xs font-bold text-slate-800">Add New Category</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              required
              placeholder="Category Name (e.g. Lab Consumables)"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs bg-white outline-none focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Description (Optional)"
              value={newCatDesc}
              onChange={(e) => setNewCatDesc(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs bg-white outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !newCatName.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <span>+ Add Category</span>
            </button>
          </div>
        </form>

        {/* Existing Categories List */}
        <div>
          <div className="text-xs font-bold text-slate-700 mb-2">Configured Categories ({categories.length})</div>
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-2.5 text-xs hover:bg-slate-50/70">
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-800">{c.name}</span>
                    {c.is_default === 1 && (
                      <span className="text-3xs bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded font-medium">
                        Default
                      </span>
                    )}
                  </div>
                  {c.description && <p className="text-3xs text-slate-400 truncate">{c.description}</p>}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => handleToggle(c.id, c.is_active)}
                    className={`px-2 py-0.5 text-3xs font-semibold rounded ${
                      c.is_active === 1
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}
                  >
                    {c.is_active === 1 ? 'Active' : 'Disabled'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
