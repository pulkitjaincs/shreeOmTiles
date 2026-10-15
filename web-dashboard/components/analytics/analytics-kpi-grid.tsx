'use client';

import Link from 'next/link';
import {
  Receipt,
  TrendingUp,
  Wallet,
  Truck,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { DashboardData } from './types';

interface AnalyticsKpiGridProps {
  kpi?: DashboardData['kpi'];
  loading: boolean;
}

export function AnalyticsKpiGrid({ kpi, loading }: AnalyticsKpiGridProps) {
  const formatCurrency = (val: number = 0) => {
    return `₹${Math.round(val).toLocaleString('en-IN')}`;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
      {/* KPI 1: Invoiced Revenue */}
      <Link
        href="/dashboard/invoices"
        className="group p-4 rounded-2xl border border-border/80 bg-card/75 hover:border-primary/40 backdrop-blur-xl transition-all duration-150 flex flex-col justify-between space-y-2 shadow-xs hover:shadow-md"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Invoiced Sales</span>
          <div className="p-1.5 rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition">
            <Receipt className="h-3.5 w-3.5" />
          </div>
        </div>
        <div>
          <div className="text-lg sm:text-xl font-extrabold text-foreground font-mono tracking-tight">
            {loading ? '...' : formatCurrency(kpi?.totalRevenue)}
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[11px] text-muted-foreground">{kpi?.periodInvoices || 0} invoices</p>
            {kpi?.deltaRevenue !== null && kpi?.deltaRevenue !== undefined && (
              <span className={`text-[10px] font-bold ${kpi.deltaRevenue >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {kpi.deltaRevenue >= 0 ? `↑ +${kpi.deltaRevenue}%` : `↓ ${kpi.deltaRevenue}%`}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* KPI 2: Today's / Period Invoices */}
      <Link
        href="/dashboard/invoices"
        className="group p-4 rounded-2xl border border-border/80 bg-card/75 hover:border-primary/40 backdrop-blur-xl transition-all duration-150 flex flex-col justify-between space-y-2 shadow-xs hover:shadow-md"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Invoices Count</span>
          <div className="p-1.5 rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition">
            <TrendingUp className="h-3.5 w-3.5" />
          </div>
        </div>
        <div>
          <div className="text-lg sm:text-xl font-extrabold text-foreground font-mono tracking-tight">
            {loading ? '...' : kpi?.periodInvoices || 0}
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[11px] text-muted-foreground">
              {kpi?.todayInvoices || 0} raised today
            </p>
            {kpi?.deltaInvoices !== null && kpi?.deltaInvoices !== undefined && (
              <span className={`text-[10px] font-bold ${kpi.deltaInvoices >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {kpi.deltaInvoices >= 0 ? `↑ +${kpi.deltaInvoices}%` : `↓ ${kpi.deltaInvoices}%`}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* KPI 3: Actual Collections (Inflow Confirmed) */}
      <Link
        href="/dashboard/payments"
        className="group p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40 backdrop-blur-xl transition-all duration-150 flex flex-col justify-between space-y-2 shadow-xs hover:shadow-md"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Collected (Inflow)</span>
          <div className="p-1.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition">
            <Wallet className="h-3.5 w-3.5" />
          </div>
        </div>
        <div>
          <div className="text-lg sm:text-xl font-extrabold text-emerald-700 dark:text-emerald-300 font-mono tracking-tight">
            {loading ? '...' : formatCurrency(kpi?.totalCollected)}
          </div>
          <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70 mt-1">
            {kpi?.totalCollectedCount || 0} confirmed txns
          </p>
        </div>
      </Link>

      {/* KPI 4: Driver Cash Custody */}
      <Link
        href="/dashboard/deliveries"
        className="group p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 backdrop-blur-xl transition-all duration-150 flex flex-col justify-between space-y-2 shadow-xs hover:shadow-md"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">With Drivers</span>
          <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition">
            <Truck className="h-3.5 w-3.5" />
          </div>
        </div>
        <div>
          <div className="text-lg sm:text-xl font-extrabold text-amber-700 dark:text-amber-300 font-mono tracking-tight">
            {loading ? '...' : formatCurrency(kpi?.cashToBeCollectedFromDrivers)}
          </div>
          <p className="text-[11px] text-amber-600/80 dark:text-amber-300/80 mt-1">
            {kpi?.pendingDriverDeliveriesCount || 0} orders waiting handover
          </p>
        </div>
      </Link>

      {/* KPI 5: Customer Receivables (Dues) */}
      <Link
        href="/dashboard/payments"
        className="group p-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 hover:border-rose-500/40 backdrop-blur-xl transition-all duration-150 flex flex-col justify-between space-y-2 shadow-xs hover:shadow-md"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Receivables</span>
          <div className="p-1.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 group-hover:scale-105 transition">
            <ArrowDownLeft className="h-3.5 w-3.5" />
          </div>
        </div>
        <div>
          <div className="text-lg sm:text-xl font-extrabold text-rose-700 dark:text-rose-300 font-mono tracking-tight">
            {loading ? '...' : formatCurrency(kpi?.receivablesTotal)}
          </div>
          <p className="text-[11px] text-rose-600/70 dark:text-rose-400/70 mt-1">
            {kpi?.receivablesCount || 0} unpaid balances
          </p>
        </div>
      </Link>

      {/* KPI 6: Store Payables */}
      <Link
        href="/dashboard/payments"
        className="group p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40 backdrop-blur-xl transition-all duration-150 flex flex-col justify-between space-y-2 shadow-xs hover:shadow-md"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Store Payables</span>
          <div className="p-1.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </div>
        </div>
        <div>
          <div className="text-lg sm:text-xl font-extrabold text-amber-700 dark:text-amber-300 font-mono tracking-tight">
            {loading ? '...' : formatCurrency(kpi?.payablesTotal)}
          </div>
          <p className="text-[11px] text-amber-600/70 dark:text-amber-400/70 mt-1">
            {kpi?.payablesCount || 0} party debts we owe
          </p>
        </div>
      </Link>
    </div>
  );
}
