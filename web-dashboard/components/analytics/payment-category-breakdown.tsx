'use client';

import Link from 'next/link';
import { QrCode, Package } from 'lucide-react';

interface PaymentCategoryBreakdownProps {
  paymentSplit?: Array<{ name: string; value: number; count: number }>;
  categorySplit?: Array<{ name: string; value: number }>;
}

export function PaymentCategoryBreakdown({
  paymentSplit,
  categorySplit,
}: PaymentCategoryBreakdownProps) {
  const formatCurrency = (val: number = 0) => {
    return `₹${Math.round(val).toLocaleString('en-IN')}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
      {/* Payment Methods Breakdown */}
      <div className="p-5 sm:p-6 rounded-3xl border border-border/80 bg-card/75 backdrop-blur-xl space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-sky-500" />
            <h2 className="text-base font-bold text-foreground">Payment Methods Breakdown</h2>
          </div>
          <Link href="/dashboard/payments" className="text-xs text-primary hover:underline font-semibold">
            View Transactions &rarr;
          </Link>
        </div>

        {paymentSplit && paymentSplit.length > 0 ? (
          <div className="space-y-3 pt-1">
            {paymentSplit.map((item) => {
              const totalSplit = paymentSplit.reduce((a, b) => a + b.value, 0) || 1;
              const pct = Math.round((item.value / totalSplit) * 100);
              
              const getModeDetails = (mode: string) => {
                switch (mode?.toUpperCase()) {
                  case 'UPI':
                    return { label: 'UPI', colorClass: 'bg-sky-500' };
                  case 'CASH':
                    return { label: 'Cash', colorClass: 'bg-emerald-500' };
                  case 'BANK_TRANSFER':
                  case 'BANK':
                    return { label: 'Bank Transfer', colorClass: 'bg-indigo-500' };
                  case 'CARD':
                    return { label: 'Card (POS)', colorClass: 'bg-amber-500' };
                  case 'CREDIT':
                    return { label: 'Credit', colorClass: 'bg-rose-500' };
                  default:
                    return { label: mode || 'Other', colorClass: 'bg-primary' };
                }
              };

              const { label, colorClass } = getModeDetails(item.name);

              return (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${colorClass}`} />
                      <span className="font-semibold text-foreground">{label}</span>
                      <span className="text-muted-foreground text-[11px]">({item.count} invoices)</span>
                    </div>
                    <div className="font-mono font-bold text-foreground">
                      {formatCurrency(item.value)}{' '}
                      <span className="text-muted-foreground font-normal">({pct}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border/80 rounded-2xl">
            No payments processed in this period yet.
          </div>
        )}
      </div>

      {/* Product Category Split */}
      <div className="p-5 sm:p-6 rounded-3xl border border-border/80 bg-card/75 backdrop-blur-xl space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-emerald-500" />
            <h2 className="text-base font-bold text-foreground">Sales by Product Category</h2>
          </div>
          <Link href="/dashboard/products" className="text-xs text-primary hover:underline font-semibold">
            Manage Catalog &rarr;
          </Link>
        </div>

        {categorySplit && categorySplit.length > 0 ? (
          <div className="space-y-3 pt-1">
            {categorySplit.map((cat) => {
              const totalCatVal = categorySplit.reduce((a, b) => a + b.value, 0) || 1;
              const pct = Math.round((cat.value / totalCatVal) * 100);

              return (
                <div key={cat.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">{cat.name}</span>
                    <span className="font-mono font-bold text-foreground">
                      {formatCurrency(cat.value)}{' '}
                      <span className="text-muted-foreground font-normal">({pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border/80 rounded-2xl">
            No categories invoiced in this period yet.
          </div>
        )}
      </div>
    </div>
  );
}
