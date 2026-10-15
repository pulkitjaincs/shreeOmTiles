'use client';

import { FinancialStats } from './types';
import {
  Receipt,
  CheckCircle2,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

interface PaymentStatsGridProps {
  stats: FinancialStats;
  activeTab: 'dues' | 'payables' | 'all' | 'inflows' | 'credits';
  onTabChange: (tab: 'dues' | 'payables' | 'all' | 'inflows' | 'credits') => void;
}

export function PaymentStatsGrid({
  stats,
  onTabChange,
}: PaymentStatsGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* 1. Total Billed Sales */}
      <div className="p-4 rounded-[1rem] border border-border/60 bg-card/75 backdrop-blur-xl shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[0.6875rem] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Billed
          </span>
          <Receipt className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="text-[clamp(1.125rem,2vw,1.25rem)] font-bold text-foreground mt-2 font-mono">
          ₹{stats.totalSales.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </div>
        <span className="text-[0.625rem] text-muted-foreground mt-0.5 block">
          Across all invoices
        </span>
      </div>

      {/* 2. Total Collected (Inflows) */}
      <div
        onClick={() => onTabChange('inflows')}
        className="p-4 rounded-[1rem] border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 cursor-pointer transition-all active:scale-[0.98] shadow-xs flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-[0.6875rem] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
            Total Collected
          </span>
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="text-[clamp(1.125rem,2vw,1.25rem)] font-bold text-emerald-700 dark:text-emerald-300 mt-2 font-mono">
          ₹{stats.totalCollected.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </div>
        <span className="text-[0.625rem] text-emerald-800/80 dark:text-emerald-300/80 mt-0.5 block">
          Total Inflows (Cash + UPI)
        </span>
      </div>

      {/* 3. Total Paid Out (Outflows) */}
      <div
        onClick={() => onTabChange('all')}
        className="p-4 rounded-[1rem] border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15 cursor-pointer transition-all active:scale-[0.98] shadow-xs flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-[0.6875rem] font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
            Total Paid Out
          </span>
          <ArrowUpRight className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="text-[clamp(1.125rem,2vw,1.25rem)] font-bold text-amber-700 dark:text-amber-300 mt-2 font-mono">
          ₹{(stats.totalPaidOut || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </div>
        <span className="text-[0.625rem] text-amber-800/80 dark:text-amber-300/80 mt-0.5 block">
          Paid to parties/vendors
        </span>
      </div>

      {/* 4. Pending Receivables */}
      <div
        onClick={() => onTabChange('dues')}
        className="p-4 rounded-[1rem] border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/15 cursor-pointer transition-all active:scale-[0.98] shadow-xs flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-[0.6875rem] font-semibold text-rose-800 dark:text-rose-300 uppercase tracking-wider">
            Customer Dues
          </span>
          <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
        </div>
        <div className="text-[clamp(1.125rem,2vw,1.25rem)] font-bold text-rose-700 dark:text-rose-300 mt-2 font-mono">
          ₹{stats.pendingReceivables.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </div>
        <span className="text-[0.625rem] text-rose-800/80 dark:text-rose-300/80 mt-0.5 block">
          Parties owe to store
        </span>
      </div>

      {/* 5. Credits Owed (Payables) */}
      <div
        onClick={() => onTabChange('payables')}
        className="p-4 rounded-[1rem] border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15 cursor-pointer transition-all active:scale-[0.98] shadow-xs flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-[0.6875rem] font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
            Store Payables
          </span>
          <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="text-[clamp(1.125rem,2vw,1.25rem)] font-bold text-amber-700 dark:text-amber-300 mt-2 font-mono">
          ₹{stats.creditsOwed.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </div>
        <span className="text-[0.625rem] text-amber-800/80 dark:text-amber-300/80 mt-0.5 block">
          Store owes to parties
        </span>
      </div>

      {/* 6. Cash vs UPI Breakdown */}
      <div className="p-4 rounded-[1rem] border border-primary/30 bg-primary/10 shadow-xs col-span-2 sm:col-span-1 flex flex-col justify-between">
        <span className="text-[0.6875rem] font-semibold text-primary uppercase tracking-wider block">
          Collection Split
        </span>
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <span className="text-muted-foreground">Cash:</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400">
              ₹{stats.cashCollected.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <span className="text-muted-foreground">UPI:</span>
            <span className="font-mono text-primary">
              ₹{stats.upiCollected.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
