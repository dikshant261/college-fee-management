import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { StaffEmployee, createStaffEmployee, updateStaffEmployee } from '../lib/financeApi';

interface StaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (staff: StaffEmployee) => void;
  staffToEdit?: StaffEmployee | null;
}

export default function StaffModal({
  isOpen,
  onClose,
  onSaved,
  staffToEdit
}: StaffModalProps) {
  const isEditing = Boolean(staffToEdit);

  const [empCode, setEmpCode] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [basicSalary, setBasicSalary] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (staffToEdit) {
      setEmpCode(staffToEdit.emp_code);
      setName(staffToEdit.name);
      setDepartment(staffToEdit.department);
      setDesignation(staffToEdit.designation);
      setPhone(staffToEdit.phone || '');
      setEmail(staffToEdit.email || '');
      setBasicSalary(String(staffToEdit.basic_salary));
      setBankName(staffToEdit.bank_name || '');
      setAccountNo(staffToEdit.account_no || '');
      setIfscCode(staffToEdit.ifsc_code || '');
      setIsActive(staffToEdit.is_active === 1);
    } else {
      setEmpCode('');
      setName('');
      setDepartment('');
      setDesignation('');
      setPhone('');
      setEmail('');
      setBasicSalary('');
      setBankName('');
      setAccountNo('');
      setIfscCode('');
      setIsActive(true);
    }
    setError(null);
  }, [staffToEdit, isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!empCode.trim()) {
      setError('Employee Code is required');
      return;
    }
    if (!name.trim()) {
      setError('Employee Name is required');
      return;
    }
    if (!department.trim()) {
      setError('Department is required');
      return;
    }
    if (!designation.trim()) {
      setError('Designation is required');
      return;
    }

    const salary = Number(basicSalary);
    if (isNaN(salary) || salary < 0) {
      setError('Basic Salary must be a valid number');
      return;
    }

    setLoading(true);
    try {
      let saved: StaffEmployee;
      if (isEditing && staffToEdit) {
        saved = await updateStaffEmployee(staffToEdit.id, {
          emp_code: empCode.trim(),
          name: name.trim(),
          department: department.trim(),
          designation: designation.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          basic_salary: salary,
          bank_name: bankName.trim() || undefined,
          account_no: accountNo.trim() || undefined,
          ifsc_code: ifscCode.trim() || undefined,
          is_active: isActive
        });
      } else {
        saved = await createStaffEmployee({
          emp_code: empCode.trim(),
          name: name.trim(),
          department: department.trim(),
          designation: designation.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          basic_salary: salary,
          bank_name: bankName.trim() || undefined,
          account_no: accountNo.trim() || undefined,
          ifsc_code: ifscCode.trim() || undefined
        });
      }
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to save staff record');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Staff Member' : 'Register New Staff Member'}
      subtitle={
        isEditing
          ? `Updating details for ${staffToEdit?.name} (${staffToEdit?.emp_code})`
          : 'Add faculty or staff employee for institutional payroll and remuneration'
      }
      maxWidth="2xl"
      icon={
        <svg className="w-5 h-5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
            {error}
          </div>
        )}

        {/* Primary Employment Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Employee ID / Code <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. EMP105"
              value={empCode}
              onChange={(e) => setEmpCode(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 uppercase font-mono focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Prof. Sunita Rao"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Department <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Computer Science / Accounts"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Designation / Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Assistant Professor"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Contact & Base Salary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Monthly Base Salary (₹) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400 font-semibold">₹</span>
              <input
                type="number"
                min="0"
                required
                placeholder="40000"
                value={basicSalary}
                onChange={(e) => setBasicSalary(e.target.value)}
                className="w-full rounded-md border border-slate-300 pl-7 pr-3 py-2 font-semibold text-slate-900 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
            <input
              type="text"
              placeholder="e.g. 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              placeholder="e.g. sunita@college.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Bank Remittance Details */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2">
          <div className="font-bold text-slate-800">Bank Account Details (For Direct Remittance)</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Bank Name</label>
              <input
                type="text"
                placeholder="e.g. State Bank of India"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 bg-white focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">Account Number</label>
              <input
                type="text"
                placeholder="e.g. 30129039120"
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 font-mono bg-white focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">IFSC Code</label>
              <input
                type="text"
                placeholder="e.g. SBIN0001234"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 font-mono uppercase bg-white focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        {isEditing && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isActiveStaff"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isActiveStaff" className="font-semibold text-slate-700 select-none">
              Active Employee (Participates in monthly payroll generation)
            </label>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-slate-300 bg-white px-3.5 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 shadow-xs transition disabled:opacity-50"
          >
            {loading ? 'Saving…' : isEditing ? 'Save Changes' : 'Register Staff'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
