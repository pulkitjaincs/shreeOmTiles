'use client';

import { Button } from '@/components/ui/button';
import { CheckCircle, X, Share2 } from 'lucide-react';
import { PushSuccessDialogData } from './types';
import { formatINR } from '@/lib/formatters';

interface PushSuccessModalProps {
  data: PushSuccessDialogData | null;
  onClose: () => void;
}

export function PushSuccessModal({ data, onClose }: PushSuccessModalProps) {
  if (!data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-[1.25rem] border border-border/70 bg-card/95 backdrop-blur-xl p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-[0.75rem] bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Delivery Pushed to Driver!</h3>
              <p className="text-xs text-muted-foreground">Invoice #{data.invoiceNo}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2.5 rounded-[0.875rem] bg-muted/30 border border-border/60 p-3.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Assigned Driver:</span>
            <span className="text-foreground font-semibold">
              {data.driverName} {data.driverPhone ? `(${data.driverPhone})` : ''}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Driver Queue Status:</span>
            <span className="text-cyan-700 dark:text-cyan-300 font-medium">Assigned (Waiting to Accept)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Items Dispatched:</span>
            <span className="text-foreground font-semibold">{data.itemsCount} item(s)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Collect from Customer:</span>
            <span className="text-amber-700 dark:text-amber-400 font-bold">{formatINR(data.amountToCollect)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Internal Transport Pricing:</span>
            <span className="text-foreground font-mono">{formatINR(data.transportCost)}</span>
          </div>
          {data.hasRemaining && (
            <div className="pt-2 border-t border-border/60 text-[0.6875rem] text-amber-800 dark:text-amber-300">
              ℹ️ Remaining split items are preserved in Pending Dispatch for your next driver.
            </div>
          )}
        </div>

        <p className="text-[0.6875rem] text-muted-foreground leading-relaxed">
          The order is now queued in the driver&apos;s mobile dashboard. When the driver accepts the assignment, the status will automatically update to <strong>Out for Pickup</strong>.
        </p>

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <Button
            type="button"
            onClick={() => {
              window.open(data.waUrl, '_blank');
            }}
            className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 text-xs font-semibold inline-flex items-center gap-1.5 active:scale-98"
            title="Send dispatch manifest directly to driver on WhatsApp"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share on WhatsApp
          </Button>
          <Button
            type="button"
            onClick={onClose}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-4 active:scale-98"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
