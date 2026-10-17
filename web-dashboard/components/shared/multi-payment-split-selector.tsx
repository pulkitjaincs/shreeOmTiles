'use client';

import React from 'react';
import { Banknote, QrCode, Building2, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

export type PaymentMethodType = 'CASH' | 'UPI' | 'BANK_TRANSFER';

export interface SplitRow {
  mode: PaymentMethodType;
  amount: string;
  upiUtr?: string;
  notes?: string;
}

interface MultiPaymentSplitSelectorProps {
  totalAmount: number;
  splits: SplitRow[];
  onChange: (splits: SplitRow[]) => void;
  allowCredit?: boolean;
  creditLabel?: string;
  onPreviewUpi?: (amount: number) => void;
  previewUpiLoading?: boolean;
}

export function MultiPaymentSplitSelector({
  totalAmount,
  splits,
  onChange,
  allowCredit = true,
  creditLabel = 'Remaining Balance (Credit / Receivable)',
  onPreviewUpi,
  previewUpiLoading = false,
}: MultiPaymentSplitSelectorProps) {
  const modeConfig: Record<
    PaymentMethodType,
    { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
  > = {
    CASH: { label: 'Cash in Hand', icon: Banknote, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
    UPI: { label: 'UPI / Live QR', icon: QrCode, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' },
    BANK_TRANSFER: { label: 'Bank Transfer / NEFT', icon: Building2, color: 'text-sky-500 bg-sky-500/10 border-sky-500/20' },
  };

  const totalPaidNow = splits.reduce((sum, s) => {
    const parsed = parseFloat(s.amount);
    return sum + (isNaN(parsed) || parsed < 0 ? 0 : parsed);
  }, 0);

  const roundedTotal = Math.round(totalAmount * 100) / 100;
  const roundedPaid = Math.round(totalPaidNow * 100) / 100;
  const balanceDue = Math.max(0, Math.round((roundedTotal - roundedPaid) * 100) / 100);
  const isOverpaid = roundedPaid > roundedTotal && roundedTotal > 0;

  const handleAddMode = (mode: PaymentMethodType) => {
    if (splits.some((s) => s.mode === mode)) return;
    const remaining = balanceDue > 0 ? balanceDue.toFixed(2) : '';
    onChange([...splits, { mode, amount: remaining }]);
  };

  const handleRemoveMode = (mode: PaymentMethodType) => {
    onChange(splits.filter((s) => s.mode !== mode));
  };

  const handleAmountChange = (index: number, newAmount: string) => {
    const updated = [...splits];
    updated[index] = { ...updated[index], amount: newAmount };
    onChange(updated);
  };

  const handleFillRemaining = (index: number) => {
    const otherSum = splits.reduce((sum, s, idx) => {
      if (idx === index) return sum;
      const parsed = parseFloat(s.amount);
      return sum + (isNaN(parsed) ? 0 : parsed);
    }, 0);
    const needed = Math.max(0, roundedTotal - otherSum);
    const updated = [...splits];
    updated[index] = { ...updated[index], amount: needed > 0 ? needed.toFixed(2) : '0' };
    onChange(updated);
  };

  const handleSplitEvenly = () => {
    if (splits.length === 0) return;
    const share = Math.floor((roundedTotal / splits.length) * 100) / 100;
    const remainder = Math.round((roundedTotal - share * splits.length) * 100) / 100;
    const updated = splits.map((s, idx) => ({
      ...s,
      amount: (idx === 0 ? share + remainder : share).toFixed(2),
    }));
    onChange(updated);
  };

  return (
    <div className="space-y-3 rounded-[1rem] border border-border/80 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <label className="text-[0.8125rem] font-semibold text-foreground flex items-center gap-1.5">
            <span>Payment Breakdown</span>
            <span className="text-[0.6875rem] font-normal text-muted-foreground">
              (Select multiple methods or single)
            </span>
          </label>
        </div>
        <div className="flex items-center gap-1.5">
          {splits.length > 1 && roundedTotal > 0 && (
            <button
              type="button"
              onClick={handleSplitEvenly}
              className="px-2 py-0.5 rounded-[0.5rem] text-[0.6875rem] font-medium bg-card hover:bg-muted border border-border text-foreground transition"
            >
              Split Evenly
            </button>
          )}
        </div>
      </div>

      {/* Mode Toggle Chips */}
      <div className="flex flex-wrap gap-2">
        {(['CASH', 'UPI', 'BANK_TRANSFER'] as const).map((mode) => {
          const isSelected = splits.some((s) => s.mode === mode);
          const config = modeConfig[mode];
          const Icon = config.icon;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => {
                if (isSelected) {
                  handleRemoveMode(mode);
                } else {
                  handleAddMode(mode);
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[0.75rem] text-[0.75rem] font-medium border transition ${
                isSelected
                  ? config.color + ' ring-2 ring-primary/20 shadow-2xs'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{config.label}</span>
              {isSelected ? (
                <CheckCircle2 className="h-3 w-3 ml-0.5 opacity-90" />
              ) : (
                <Plus className="h-3 w-3 ml-0.5 opacity-60" />
              )}
            </button>
          );
        })}
      </div>

      {/* Allocation Rows */}
      {splits.length === 0 ? (
        <div className="rounded-[0.75rem] border border-dashed border-border/80 bg-card/50 p-4 text-center">
          <p className="text-[0.75rem] text-muted-foreground">
            No upfront payment method selected.
            {allowCredit ? ' 100% will be recorded as Pay Later / Credit.' : ' Please select at least one payment method.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2 pt-1">
          {splits.map((row, idx) => {
            const config = modeConfig[row.mode];
            const Icon = config.icon;
            const parsedAmount = parseFloat(row.amount);
            const canPreviewQr = row.mode === 'UPI' && onPreviewUpi && !isNaN(parsedAmount) && parsedAmount > 0;

            return (
              <div
                key={row.mode}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-[0.75rem] border border-border bg-card p-2.5 shadow-2xs"
              >
                <div className="flex items-center gap-2 min-w-[140px]">
                  <div className={`p-1.5 rounded-[0.5rem] ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-[0.8125rem] font-semibold text-foreground">{config.label}</span>
                </div>

                <div className="flex items-center gap-2 flex-1 max-w-sm justify-end">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[0.75rem] text-muted-foreground font-mono">
                      ₹
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={row.amount}
                      onChange={(e) => handleAmountChange(idx, e.target.value)}
                      className="w-full rounded-[0.625rem] border border-input bg-background pl-6 pr-2.5 py-1.5 text-[0.8125rem] text-foreground font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                    />
                  </div>

                  {roundedTotal > 0 && (
                    <button
                      type="button"
                      onClick={() => handleFillRemaining(idx)}
                      className="px-2 py-1 rounded-[0.5rem] text-[0.6875rem] font-semibold bg-muted hover:bg-muted/80 text-primary transition shrink-0"
                      title="Fill remaining unallocated balance"
                    >
                      Fill Bal
                    </button>
                  )}

                  {canPreviewQr && (
                    <button
                      type="button"
                      onClick={() => onPreviewUpi(parsedAmount)}
                      disabled={previewUpiLoading}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[0.5rem] text-[0.6875rem] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 transition shrink-0"
                    >
                      <QrCode className="h-3 w-3" />
                      <span>{previewUpiLoading ? '...' : 'QR'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveMode(row.mode)}
                    className="p-1 rounded-[0.5rem] text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition shrink-0"
                    title="Remove method"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary Footer */}
      <div className="pt-2 border-t border-border/80 flex flex-wrap items-center justify-between gap-2 text-[0.75rem]">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">
            Total Paid: <strong className="text-foreground font-mono">₹{roundedPaid.toFixed(2)}</strong>
          </span>
          {allowCredit && (
            <span className={balanceDue > 0 ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-emerald-600 dark:text-emerald-400 font-semibold'}>
              {balanceDue > 0 ? `${creditLabel}: ₹${balanceDue.toFixed(2)}` : 'Fully Settled'}
            </span>
          )}
        </div>

        {isOverpaid && (
          <div className="flex items-center gap-1 text-[0.6875rem] text-rose-500 font-medium">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Amount paid exceeds total (₹{roundedTotal.toFixed(2)})</span>
          </div>
        )}
      </div>
    </div>
  );
}
