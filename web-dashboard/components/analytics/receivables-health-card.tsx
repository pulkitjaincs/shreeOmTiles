'use client';

import Link from 'next/link';
import { CreditCard } from 'lucide-react';
import { ReceivablesHealth } from './types';

interface ReceivablesHealthCardProps {
  receivablesHealth?: ReceivablesHealth;
}

export function ReceivablesHealthCard({
  receivablesHealth,
}: ReceivablesHealthCardProps) {
  const formatCurrency = (val: number = 0) => {
    return `₹${Math.round(val).toLocaleString('en-IN')}`;
  };

  return (
    <div className="p-[clamp(1rem,2vw,1.5rem)] rounded-[1.25rem] border border-border bg-card/75 backdrop-blur-xl shadow-xs space-y-5 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-rose-500 dark:text-rose-400" />
            <h2 className="text-[1rem] font-bold text-foreground">Receivables & Credit Health</h2>
          </div>
          <p className="text-[0.75rem] text-muted-foreground mt-0.5">
            Outstanding credit balance breakdown and top pending debtor accounts.
          </p>
        </div>

        <Link
          href="/dashboard/payments"
          className="text-[0.75rem] font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-500 dark:hover:text-rose-300 inline-flex items-center gap-1 transition-colors"
        >
          Collect Customer Dues &rarr;
        </Link>
      </div>

      {/* Credit Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-[1rem] bg-muted/40 border border-border/80 space-y-1">
          <span className="text-[0.625rem] uppercase font-bold tracking-wider text-muted-foreground">Unpaid Invoices</span>
          <div className="text-[1.125rem] font-mono font-bold text-foreground">
            {formatCurrency(receivablesHealth?.unpaid.total)}
          </div>
          <p className="text-[0.6875rem] text-muted-foreground">
            {receivablesHealth?.unpaid.count || 0} customer bills awaiting first payment
          </p>
        </div>

        <div className="p-3.5 rounded-[1rem] bg-amber-500/5 border border-amber-500/20 space-y-1">
          <span className="text-[0.625rem] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400">Partially Paid</span>
          <div className="text-[1.125rem] font-mono font-bold text-amber-700 dark:text-amber-300">
            {formatCurrency(receivablesHealth?.partial.total)}
          </div>
          <p className="text-[0.6875rem] text-muted-foreground">
            {receivablesHealth?.partial.count || 0} bills with balance remaining
          </p>
        </div>

        <div className="p-3.5 rounded-[1rem] bg-rose-500/5 border border-rose-500/20 space-y-1">
          <span className="text-[0.625rem] uppercase font-bold tracking-wider text-rose-600 dark:text-rose-400">Overdue Balances</span>
          <div className="text-[1.125rem] font-mono font-bold text-rose-600 dark:text-rose-400">
            {formatCurrency(receivablesHealth?.overdue.total)}
          </div>
          <p className="text-[0.6875rem] text-muted-foreground">
            {receivablesHealth?.overdue.count || 0} overdue beyond payment grace
          </p>
        </div>
      </div>

      {/* Top Pending Receivables */}
      {receivablesHealth?.topPending && receivablesHealth.topPending.length > 0 && (
        <div className="space-y-2 pt-2">
          <h3 className="text-[0.6875rem] font-bold text-muted-foreground uppercase tracking-wider">
            Top Customer Accounts with Pending Balances
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {receivablesHealth.topPending.map((debtor) => (
              <div
                key={debtor.partyId}
                className="p-3.5 rounded-[1rem] bg-card border border-border/80 flex items-center justify-between gap-3 shadow-2xs"
              >
                <div className="min-w-0">
                  <p className="text-[0.75rem] font-bold text-foreground truncate">{debtor.partyName}</p>
                  <p className="text-[0.6875rem] text-muted-foreground font-mono">{debtor.phone}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono font-black text-rose-600 dark:text-rose-400 text-[0.875rem]">
                    {formatCurrency(debtor.amountDue)}
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[0.5625rem] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    {debtor.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
