'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2, X, Loader2, CheckSquare, Square } from 'lucide-react';
import { Invoice } from './types';
import { formatINR, formatDate } from '@/lib/formatters';

interface DeleteInvoiceModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (deletedInvoiceId: string) => void;
}

export function DeleteInvoiceModal({
  invoice,
  isOpen,
  onClose,
  onSuccess,
}: DeleteInvoiceModalProps) {
  const [forceDelivered, setForceDelivered] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !invoice) return null;

  const hasDelivered = invoice.deliveries?.some((d) => d.status === 'DELIVERED');
  const hasRefunds = (invoice.refundInvoices?.length || 0) > 0;

  const handleDelete = async () => {
    if (hasDelivered && !forceDelivered) {
      setError('Please acknowledge the physical goods return/verification checkbox.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await apiRequest(`/invoices/${invoice.id}?forceDelivered=${forceDelivered}`, {
        method: 'DELETE',
      });
      onSuccess(invoice.id);
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to delete invoice');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-[1.5rem] border border-rose-500/30 bg-card p-6 shadow-2xl space-y-5 text-foreground">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-[0.75rem] bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-rose-600 dark:text-rose-400">
                Delete Invoice & Restore Stock
              </h3>
              <p className="text-xs text-muted-foreground">
                Invoice #{invoice.invoiceNo} • {formatDate(invoice.invoiceDate || invoice.createdAt)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Invoice Summary */}
        <div className="p-3.5 rounded-[0.875rem] bg-muted/40 border border-border text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Customer:</span>
            <span className="font-semibold text-foreground">{invoice.party?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Invoice Amount:</span>
            <span className="font-bold text-foreground">{formatINR(invoice.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status & Payment Mode:</span>
            <span className="font-medium text-foreground">
              {invoice.status} ({invoice.paymentMode || 'CASH'})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Items Count:</span>
            <span className="text-foreground">{invoice.items?.length || 0} line item(s)</span>
          </div>
        </div>

        {/* Warning / Impact Description */}
        <div className="rounded-[0.875rem] bg-rose-500/10 border border-rose-500/20 p-3.5 text-xs text-rose-700 dark:text-rose-300 space-y-1.5">
          <p className="font-bold">⚠️ Irreversible Action & Automatic System Effects:</p>
          <ul className="list-disc list-inside space-y-0.5 text-[0.6875rem]">
            <li>Product quantities will be <strong>restored back to showroom/godown stock</strong>.</li>
            <li>All associated deliveries, trips, and ledger entries will be removed.</li>
            <li>Any customer credit balances associated with this invoice will be reversed.</li>
            <li>An immutable audit log will record this deletion by your account.</li>
          </ul>
        </div>

        {hasRefunds && (
          <div className="p-3 rounded-[0.75rem] bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300">
            ⚠️ This invoice has {invoice.refundInvoices?.length} processed credit note(s). Invoices with returns cannot be directly deleted.
          </div>
        )}

        {/* Delivered Goods Acknowledgment Checkbox */}
        {hasDelivered && (
          <div
            onClick={() => setForceDelivered(!forceDelivered)}
            className="p-3 rounded-[0.875rem] border border-amber-500/40 bg-amber-500/10 cursor-pointer flex items-start gap-2.5 transition select-none"
          >
            <div className="mt-0.5 text-amber-600 dark:text-amber-400">
              {forceDelivered ? (
                <CheckSquare className="h-4 w-4 text-primary" />
              ) : (
                <Square className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="text-xs text-foreground">
              <span className="font-semibold block text-amber-800 dark:text-amber-300">
                Goods Have Already Been Delivered
              </span>
              <span className="text-[0.6875rem] text-muted-foreground">
                I acknowledge that products from this order were marked as delivered to the customer, and I verify that physical goods have either been returned to stock or explicitly written off.
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-[0.75rem] bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            disabled={submitting || hasRefunds || (hasDelivered && !forceDelivered)}
            className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 active:scale-98 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            {submitting ? 'Deleting & Restoring...' : 'Permanently Delete Invoice'}
          </Button>
        </div>
      </div>
    </div>
  );
}
