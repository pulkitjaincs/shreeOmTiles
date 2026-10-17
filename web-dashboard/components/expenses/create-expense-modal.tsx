'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ThemedSelect } from '@/components/ui/themed-select';
import { X, Wallet, Loader2 } from 'lucide-react';
import { MultiPaymentSplitSelector, SplitRow, PaymentMethodType } from '@/components/shared/multi-payment-split-selector';

interface CreateExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateExpenseModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateExpenseModalProps) {
  const [category, setCategory] = useState('PANTRY_REFRESHMENTS');
  const [amount, setAmount] = useState<number | ''>('');
  const [paymentMode, setPaymentMode] = useState<PaymentMethodType>('CASH');
  const [isSplit, setIsSplit] = useState(false);
  const [splits, setSplits] = useState<SplitRow[]>([
    { mode: 'CASH', amount: '' },
  ]);
  const [paidTo, setPaidTo] = useState('');
  const [notes, setNotes] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid expense amount.');
      return;
    }

    const validSplits = isSplit
      ? splits.filter((s) => {
          const p = parseFloat(s.amount);
          return !isNaN(p) && p > 0;
        })
      : [];

    if (isSplit) {
      const totalSplit = validSplits.reduce((acc, s) => acc + parseFloat(s.amount), 0);
      if (validSplits.length === 0 || Math.abs(totalSplit - Number(amount)) > 0.01) {
        setError(
          `Split payment total (₹${totalSplit.toFixed(2)}) must exactly match the expense amount (₹${Number(amount).toFixed(2)})`,
        );
        return;
      }
    }

    setSubmitting(true);
    setError('');

    try {
      await apiRequest('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          category,
          amount: Number(amount),
          paymentMode: isSplit
            ? validSplits.length > 1
              ? 'SPLIT'
              : validSplits[0]?.mode || paymentMode
            : paymentMode,
          paidTo: paidTo.trim() || undefined,
          notes: notes.trim() || undefined,
          expenseDate: new Date(expenseDate).toISOString(),
          splits: isSplit
            ? validSplits.map((s) => ({
                mode: s.mode,
                amount: parseFloat(s.amount),
                upiUtr: s.upiUtr?.trim() || undefined,
                notes: s.notes?.trim() || undefined,
              }))
            : undefined,
        }),
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to record expense');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 text-foreground">
        <div className="flex items-start justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Record Daily Expense</h3>
              <p className="text-xs text-muted-foreground">Log counter cash, fuel, utilities & operational outlays</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Expense Category *
            </label>
            <ThemedSelect
              value={category}
              onChange={(v) => setCategory(v)}
              options={[
                { value: 'PANTRY_REFRESHMENTS', label: 'Tea & Pantry Refreshments' },
                { value: 'LABOUR_HAMALI', label: 'Labour & Hamali Charges' },
                { value: 'FUEL_TRANSPORT', label: 'Vehicle Fuel & Tolls' },
                { value: 'RENT_GODOWN', label: 'Godown / Showroom Rent' },
                { value: 'ELECTRICITY_UTILITIES', label: 'Electricity & Utilities' },
                { value: 'SALARY_ADVANCE', label: 'Staff Advance / Wages' },
                { value: 'MAINTENANCE_REPAIRS', label: 'Shop & Godown Maintenance' },
                { value: 'MARKETING_SAMPLE', label: 'Marketing & Samples' },
                { value: 'OTHER', label: 'Other Operational Outlay' },
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Amount (₹) *
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Date *
            </label>
            <input
              type="date"
              required
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-foreground">
                Payment Mode *
              </label>
              <button
                type="button"
                onClick={() => {
                  if (!isSplit) {
                    setSplits([
                      { mode: paymentMode, amount: amount ? String(amount) : '' },
                    ]);
                  }
                  setIsSplit(!isSplit);
                }}
                className="text-[0.6875rem] text-primary hover:underline font-semibold"
              >
                {isSplit ? '← Single Mode' : '⇄ Split Payment Modes'}
              </button>
            </div>

            {isSplit ? (
              <MultiPaymentSplitSelector
                totalAmount={Number(amount) || 0}
                splits={splits}
                onChange={setSplits}
                allowCredit={false}
              />
            ) : (
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as PaymentMethodType)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="CASH">Cash Drawer</option>
                <option value="UPI">UPI / Online</option>
                <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Paid To / Beneficiary (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Ramesh Chaiwala, Driver petrol pump"
              value={paidTo}
              onChange={(e) => setPaidTo(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Notes / Description (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Refreshments for visiting contractor team"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs active:scale-98"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              {submitting ? 'Recording...' : 'Record Expense'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
