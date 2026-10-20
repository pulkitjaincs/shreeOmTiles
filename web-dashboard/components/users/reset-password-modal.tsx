'use client';

import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { KeyRound, X, Eye, EyeOff, Loader2 } from 'lucide-react';
import { StaffUser } from './types';

interface ResetPasswordModalProps {
  user: StaffUser | null;
  onClose: () => void;
  onSuccess: (message: string) => Promise<void> | void;
}

export function ResetPasswordModal({
  user,
  onClose,
  onSuccess,
}: ResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setNewPassword('');
      setShowPassword(false);
      setError('');
    }
  }, [user]);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await apiRequest(`/users/${user.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password: newPassword }),
      });
      onClose();
      await onSuccess(
        `✓ Password for ${user.name} (${user.phone}) has been updated. They can now log in with the new password.`
      );
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to update password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden space-y-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Reset Staff Password</h3>
              <p className="text-xs text-muted-foreground">
                {user.name} ({user.phone})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 pt-0">
          <div className="p-3.5 rounded-xl bg-muted/50 border border-border/60 text-xs text-muted-foreground space-y-1">
            <div>
              Staff: <strong className="text-foreground">{user.name}</strong>
            </div>
            <div>
              Login Phone: <strong className="font-mono text-primary font-semibold">{user.phone}</strong>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              New Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                required
                type={showPassword ? 'text' : 'password'}
                placeholder="Minimum 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl border border-border/80 bg-muted/50 px-3.5 py-2.5 pr-10 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              The staff member will be able to log in with this new password immediately.
            </p>
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
              className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-amber-600/20 inline-flex items-center justify-center gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <span>Set New Password</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
