'use client';

import React, { useState } from 'react';
import { apiRequest } from '@/lib/api';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { StaffUser } from './types';

interface DeleteUserModalProps {
  user: StaffUser | null;
  onClose: () => void;
  onSuccess: (message: string) => Promise<void> | void;
}

export function DeleteUserModal({
  user,
  onClose,
  onSuccess,
}: DeleteUserModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!user) return null;

  const handleConfirmDelete = async () => {
    if (user.role === 'OWNER') {
      setError('The business owner account cannot be removed.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await apiRequest(`/users/${user.id}`, {
        method: 'DELETE',
      });
      onClose();
      await onSuccess(`✓ Staff member ${user.name} has been removed from the system.`);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to remove staff member');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-card/95 border border-rose-500/30 rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 border-b border-border/60 pb-3">
          <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <Trash2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Remove Staff Member?</h3>
            <p className="text-xs text-muted-foreground">This action will remove their system access</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Are you sure you want to remove <strong className="text-foreground">{user.name}</strong> ({user.phone})?
          They will no longer be able to access the application and cannot be assigned any further orders or tasks.
        </p>

        <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-300 text-[11px] flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400 mt-0.5" />
          <span>
            Note: Historical invoices and delivered deliveries created in the past will preserve audit integrity.
          </span>
        </div>

        {error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-2.5 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-muted/60 hover:bg-muted text-foreground text-xs font-semibold rounded-xl border border-border/80 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmDelete}
            disabled={submitting}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-rose-600/20 inline-flex items-center gap-1.5"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Removing...</span>
              </>
            ) : (
              <span>Confirm Remove</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
