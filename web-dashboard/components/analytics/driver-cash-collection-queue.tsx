'use client';

import Link from 'next/link';
import { CircleDollarSign, Truck, ArrowRight } from 'lucide-react';
import { PendingDriverDelivery } from './types';

interface DriverCashCollectionQueueProps {
  deliveries: PendingDriverDelivery[];
  collectingId: string | null;
  onCollectCash: (
    deliveryId: string,
    amount: number,
    driverName: string,
    invoiceNo: string
  ) => Promise<void>;
}

export function DriverCashCollectionQueue({
  deliveries,
  collectingId,
  onCollectCash,
}: DriverCashCollectionQueueProps) {
  if (!deliveries || deliveries.length === 0) return null;

  return (
    <div className="p-5 sm:p-6 rounded-3xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 backdrop-blur-xl space-y-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
            <CircleDollarSign className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">
              Driver Cash Awaiting Director Handover ({deliveries.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Drivers completed these deliveries and are holding customer cash. Click &quot;Collect Cash&quot; to verify and settle into store custody.
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/deliveries"
          className="text-xs text-primary hover:underline font-semibold inline-flex items-center gap-1"
        >
          Deliveries Panel <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
        {deliveries.map((item) => {
          const isProcessing = collectingId === item.id;
          return (
            <div
              key={item.id}
              className="p-4 rounded-2xl border border-border/80 bg-card/90 backdrop-blur-md flex flex-col justify-between gap-3 shadow-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-primary">
                    #{item.invoiceNo}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Truck className="h-3 w-3 text-amber-500" />
                    {item.driverName}
                  </span>
                </div>
                <div className="text-sm font-bold text-foreground truncate">{item.partyName}</div>
                <div className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
                  ₹{item.amount.toLocaleString('en-IN')}
                </div>
              </div>

              <button
                onClick={() =>
                  onCollectCash(
                    item.id,
                    item.amount,
                    item.driverName,
                    item.invoiceNo
                  )
                }
                disabled={isProcessing}
                className="w-full py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition inline-flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]"
              >
                <CircleDollarSign className="h-3.5 w-3.5" />
                {isProcessing
                  ? 'Adding to Transactions...'
                  : `Collect Cash (₹${item.amount.toLocaleString('en-IN')})`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
