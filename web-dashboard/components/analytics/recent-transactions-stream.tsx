'use client';

import Link from 'next/link';
import { Truck } from 'lucide-react';
import { TransactionItem } from './types';

interface RecentTransactionsStreamProps {
  recentTransactions?: TransactionItem[];
}

export function RecentTransactionsStream({
  recentTransactions,
}: RecentTransactionsStreamProps) {
  return (
    <div className="p-[clamp(1rem,2vw,1.5rem)] rounded-[1.25rem] border border-border bg-card/75 backdrop-blur-xl shadow-xs space-y-4 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-[1rem] font-bold text-foreground">Recent Confirmed Transactions</h2>
          </div>
          <p className="text-[0.75rem] text-muted-foreground mt-0.5">
            Verified physical cash received from drivers, counter collections, and digital UPI credits.
          </p>
        </div>

        <Link
          href="/dashboard/payments"
          className="text-[0.75rem] font-semibold text-primary hover:text-primary/80 inline-flex items-center gap-1 transition-colors"
        >
          View Full Transactions Ledger &rarr;
        </Link>
      </div>

      <div className="overflow-x-auto rounded-[0.875rem] border border-border/70">
        <table className="w-full text-left text-[0.75rem] text-foreground">
          <thead className="bg-muted/50 font-semibold uppercase tracking-wider text-[0.6875rem] text-muted-foreground border-b border-border">
            <tr>
              <th className="py-2.5 px-3.5">Date & Time</th>
              <th className="py-2.5 px-3.5">Invoice #</th>
              <th className="py-2.5 px-3.5">Customer / Party</th>
              <th className="py-2.5 px-3.5">Payment Source</th>
              <th className="py-2.5 px-3.5">Received By</th>
              <th className="py-2.5 px-3.5 text-right">Amount</th>
              <th className="py-2.5 px-3.5 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {!recentTransactions || recentTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-6 text-muted-foreground">
                  No confirmed transactions recorded yet.
                </td>
              </tr>
            ) : (
              recentTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-3.5 text-muted-foreground font-mono">
                    {tx.paidAt
                      ? new Date(tx.paidAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'N/A'}
                  </td>
                  <td className="py-2.5 px-3.5 font-mono font-bold text-primary">
                    #{tx.invoiceNo}
                  </td>
                  <td className="py-2.5 px-3.5 font-medium text-foreground">{tx.partyName}</td>
                  <td className="py-2.5 px-3.5">
                    {tx.type === 'OUTFLOW' ? (
                      <span className="px-2 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 inline-flex items-center gap-1 text-[0.6875rem]">
                        Store Paid Out ({tx.mode})
                      </span>
                    ) : tx.driverName ? (
                      <span className="px-2 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1 text-[0.6875rem]">
                        <Truck className="h-3 w-3 text-emerald-500" />
                        Handed by {tx.driverName}
                      </span>
                    ) : tx.mode === 'CASH' ? (
                      <span className="px-2 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground border border-border text-[0.6875rem]">
                        Counter Cash
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 text-[0.6875rem]">
                        {tx.mode} Inflow
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3.5 text-muted-foreground">{tx.confirmedByName}</td>
                  <td className={`py-2.5 px-3.5 text-right font-mono font-bold text-[0.875rem] ${
                    tx.type === 'OUTFLOW'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {tx.type === 'OUTFLOW' ? `- ₹${tx.amount.toLocaleString('en-IN')}` : `+ ₹${tx.amount.toLocaleString('en-IN')}`}
                  </td>
                  <td className="py-2.5 px-3.5 text-right">
                    <span className="px-2 py-0.5 rounded-md font-bold text-[0.625rem] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      ✓ CONFIRMED
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
