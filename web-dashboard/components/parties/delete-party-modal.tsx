'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ShieldAlert, CheckCircle2, Loader2, X } from 'lucide-react';
import { Party } from './types';

interface DeletePartyModalProps {
  party: Party | null;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export function DeletePartyModal({
  party,
  onClose,
  onSuccess,
}: DeletePartyModalProps) {
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  if (!party) return null;

  const totalDue = (party.creditLedgers || [])
    .filter((cl) => cl.status !== 'SETTLED')
    .reduce((sum, cl) => {
      const amt = Number(cl.amountDue || 0);
      return cl.type === 'RECEIVABLE' ? sum + amt : sum - amt;
    }, 0);
  const hasPendingDues = totalDue > 0.01;

  const handleDeleteParty = async () => {
    setDeleteSubmitting(true);
    setDeleteError('');
    try {
      await apiRequest(`/parties/${party.id}`, { method: 'DELETE' });
      onClose();
      await onSuccess();
    } catch (err: unknown) {
      setDeleteError((err as Error).message || 'Failed to remove customer');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            {hasPendingDues ? (
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <ShieldAlert className="h-5 w-5" />
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
            )}
            <h2 className="text-base font-bold text-foreground">
              {hasPendingDues ? 'Deletion Prohibited' : 'Confirm Customer Removal'}
            </h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {hasPendingDues ? (
          /* CASE A: DUES PENDING - CANNOT DELETE */
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-300 text-xs space-y-1.5">
              <div className="font-semibold text-rose-700 dark:text-rose-200 flex items-center gap-1.5 text-sm">
                <AlertTriangle className="h-4 w-4" />
                Pending Dues: ₹{totalDue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Customer accounts cannot be deleted or removed while dues are pending.
                Under store safety policy, neither can the customer owe money to the shop,
                nor can the shop owe money to the customer.
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              Customer:{' '}
              <span className="font-semibold text-foreground">{party.name}</span> ({party.phone})
            </p>

            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="bg-muted/60 hover:bg-muted text-foreground border-border/80 text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          /* CASE B: ZERO DUES - SAFE TO REMOVE */
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>Zero dues verified: No pending balance or credit liabilities.</span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to remove customer{' '}
              <span className="font-bold text-foreground">{party.name}</span>? This will
              remove them from the active customer directory.
            </p>

            {deleteError && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-2.5 text-xs text-destructive">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="bg-muted/60 hover:bg-muted text-foreground border-border/80 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={deleteSubmitting}
                onClick={handleDeleteParty}
                className="bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs px-4 shadow-lg shadow-rose-600/20"
              >
                {deleteSubmitting ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Removing...
                  </span>
                ) : (
                  'Confirm Remove'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
