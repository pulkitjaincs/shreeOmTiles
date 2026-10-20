'use client';

import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { UserPlus, Pencil, X, Eye, EyeOff, Loader2 } from 'lucide-react';
import { StaffUser } from './types';

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => Promise<void> | void;
  user?: StaffUser | null;
}

export function UserFormModal({
  isOpen,
  onClose,
  onSuccess,
  user,
}: UserFormModalProps) {
  const isEditing = Boolean(user);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('SALESMAN');
  const [scope, setScope] = useState('');
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (user) {
        setName(user.name || '');
        setPhone(user.phone || '');
        setRole(user.role || 'SALESMAN');
        setScope(user.scope || '');
      } else {
        setName('');
        setPhone('');
        setPassword('');
        setRole('SALESMAN');
        setScope('');
      }
      setShowPassword(false);
      setError('');

      void apiRequest<Array<{ id: string; name: string }>>('/warehouses')
        .then((data) => setWarehouses(data || []))
        .catch(() => {});
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a valid full name.');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setError('Mobile number must be strictly 10 digits.');
      return;
    }

    if (!isEditing && (!password || password.length < 6)) {
      setError('Initial password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (isEditing && user) {
        await apiRequest(`/users/${user.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: name.trim(),
            phone: cleanPhone,
            role: user.role === 'OWNER' ? 'OWNER' : role,
            scope: scope.trim() || undefined,
          }),
        });
        onClose();
        await onSuccess(`✓ Updated profile and mobile number for ${name}.`);
      } else {
        await apiRequest('/users', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            phone: cleanPhone,
            password,
            role,
            scope: scope.trim() || undefined,
          }),
        });
        onClose();
        await onSuccess('✓ Staff member added successfully.');
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to save staff member');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
      <div className="w-full max-w-md max-h-[88dvh] flex flex-col bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden space-y-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              {isEditing ? <Pencil className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {isEditing ? 'Edit Staff Profile' : 'Add New Staff Member'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isEditing ? 'Update name, mobile number, or role' : 'Create login credentials and assign role'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 pt-0 overflow-y-auto pr-1">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              required
              type="text"
              placeholder="e.g. Ramesh Kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-border/80 bg-muted/50 px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Mobile Number (Login ID) (10 digits) <span className="text-rose-500">*</span>
            </label>
            <input
              required
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="e.g. 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="w-full rounded-xl border border-border/80 bg-muted/50 px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono transition"
            />
          </div>

          {!isEditing && (
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Initial Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-border/80 bg-muted/50 px-3.5 py-2 pr-10 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Role <span className="text-rose-500">*</span>
            </label>
            {isEditing && user?.role === 'OWNER' ? (
              <div className="px-3.5 py-2 rounded-xl bg-muted/80 border border-border/80 text-xs text-fuchsia-600 dark:text-fuchsia-300 font-bold">
                DIRECTOR (Protected)
              </div>
            ) : (
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-xl border border-border/80 bg-muted/50 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              >
                <option value="SALESMAN" className="bg-card text-foreground">Salesman (Billing & Catalog)</option>
                <option value="DRIVER" className="bg-card text-foreground">Delivery Driver (Route Cockpit & Pickups)</option>
                <option value="SUPERVISOR" className="bg-card text-foreground">Delivery & Stock Supervisor (Dispatch & Inspection)</option>
                <option value="WAREHOUSE" className="bg-card text-foreground">Warehouse Staff (Stock Ledger)</option>
                <option value="ADMIN" className="bg-card text-foreground">Admin (Full Operations)</option>
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Scope / Role Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Dispatch Coordinator"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full rounded-xl border border-border/80 bg-muted/50 px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-2.5 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-muted/60 hover:bg-muted text-foreground text-xs font-semibold rounded-xl border border-border/80 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl transition shadow-lg shadow-primary/20 inline-flex items-center justify-center gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>{isEditing ? 'Saving...' : 'Adding...'}</span>
                </>
              ) : (
                <span>{isEditing ? 'Save Changes' : 'Create Staff Member'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
