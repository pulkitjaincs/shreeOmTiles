'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ThemedSelect } from '@/components/ui/themed-select';
import { CreditCard, X } from 'lucide-react';
import { Party } from './types';

interface CreditLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  parties: Party[];
  defaultPartyId?: string;
}

export function CreditLedgerModal({
  isOpen,
  onClose,
  onSuccess,
  parties,
  defaultPartyId,
}: CreditLedgerModalProps) {
  const [creditPartyId, setCreditPartyId] = useState(defaultPartyId || parties[0]?.id || '');
  const [creditType, setCreditType] = useState<'RECEIVABLE' | 'PAYABLE'>('RECEIVABLE');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditDueDate, setCreditDueDate] = useState('');
  const [creditNotes, setCreditNotes] = useState('');
  const [creditSubmitting, setCreditSubmitting] = useState(false);
  const [creditError, setCreditError] = useState('');

  if (!isOpen) return null;

  const handleSubmitRecordCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creditSubmitting) return;
    const amtNum = parseFloat(creditAmount);
    if (isNaN(amtNum) || amtNum <= 0) {
      setCreditError('Please enter a valid amount greater than ₹0');
      return;
    }
    if (!creditPartyId) {
      setCreditError('Please select a party');
      return;
    }

    setCreditSubmitting(true);
    setCreditError('');
    try {
      await apiRequest('/payments/credit', {
        method: 'POST',
        body: JSON.stringify({
          partyId: creditPartyId,
          amount: amtNum,
          type: creditType,
          dueDate: creditDueDate || undefined,
          notes: creditNotes.trim() || undefined,
        }),
      });

      setCreditAmount('');
      setCreditNotes('');
      setCreditDueDate('');
      onClose();
      await onSuccess();
    } catch (err: unknown) {
      setCreditError((err as Error).message || 'Failed to record credit');
    } finally {
      setCreditSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-[1.25rem] border border-border/70 bg-card p-6 shadow-2xl space-y-4 my-8 max-h-[88dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-amber-500" />
              Record Credit / Advance
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Lend credit to a party or record credit/advance taken
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmitRecordCredit} className="space-y-4">
          {/* Direction Toggle */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Credit Flow *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCreditType('RECEIVABLE')}
                className={`p-2.5 rounded-[0.75rem] border text-xs font-bold transition-all flex flex-col items-center gap-1 active:scale-98 ${
                  creditType === 'RECEIVABLE'
                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-300 shadow-xs'
                    : 'border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>Credit Given (Lent)</span>
                <span className="text-[0.625rem] font-normal text-muted-foreground">
                  Party owes to store
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCreditType('PAYABLE')}
                className={`p-2.5 rounded-[0.75rem] border text-xs font-bold transition-all flex flex-col items-center gap-1 active:scale-98 ${
                  creditType === 'PAYABLE'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300 shadow-xs'
                    : 'border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>Credit Taken (Advance)</span>
                <span className="text-[0.625rem] font-normal text-muted-foreground">
                  Store owes to party
                </span>
              </button>
            </div>
          </div>

          {/* Party Selection */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Select Party *
            </label>
            <ThemedSelect
              value={creditPartyId}
              onChange={(val) => setCreditPartyId(val)}
              searchable
              searchPlaceholder="Search party by name or phone..."
              placeholder="-- Choose Party --"
              options={parties.map((p) => ({
                value: p.id,
                label: p.name,
                subLabel: p.phone,
                badge: p.type,
              }))}
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Credit Amount (₹) *
            </label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="e.g. 12000"
              className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono font-bold"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Settlement Due Date (Optional)
            </label>
            <input
              type="date"
              className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={creditDueDate}
              onChange={(e) => setCreditDueDate(e.target.value)}
            />
          </div>

          {/* Notes / Reason */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Reason / Description
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Advance deposit for Somany tiles, or 15 days site credit..."
              className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={creditNotes}
              onChange={(e) => setCreditNotes(e.target.value)}
            />
          </div>

          {creditError && (
            <div className="rounded-[0.5rem] bg-destructive/10 border border-destructive/20 p-2 text-xs text-destructive">
              {creditError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={creditSubmitting}
              className="bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs px-4 active:scale-98 shadow-sm"
            >
              {creditSubmitting ? 'Recording...' : 'Record to Ledger'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
