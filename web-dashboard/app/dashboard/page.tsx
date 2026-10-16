'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { apiRequest, cachedApiRequest } from '@/lib/api';
import {
  Plus,
  X,
  Calendar,
  CheckCircle,
} from 'lucide-react';
import DriverDashboard from '@/components/driver-dashboard';
import SalesmanDashboard from '@/components/salesman-dashboard';
import SupervisorDashboard from '@/components/supervisor-dashboard';
import { DashboardData, DatePreset } from '@/components/analytics/types';
import { AnalyticsKpiGrid } from '@/components/analytics/analytics-kpi-grid';
import { DriverCashCollectionQueue } from '@/components/analytics/driver-cash-collection-queue';
import { RevenueCashflowChart } from '@/components/analytics/revenue-cashflow-chart';
import { SalesmenPerformanceTable } from '@/components/analytics/salesmen-performance-table';
import { PaymentCategoryBreakdown } from '@/components/analytics/payment-category-breakdown';
import { ReceivablesHealthCard } from '@/components/analytics/receivables-health-card';
import { RecentTransactionsStream } from '@/components/analytics/recent-transactions-stream';

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<DatePreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const isDriver = user?.role === 'DRIVER';
  const isSupervisor = user?.role === 'SUPERVISOR';

  const loadDashboard = useCallback(
    async (
      selectedPreset: DatePreset = preset,
      customRange?: { from: string; to: string },
      force = false,
    ) => {
      try {
        let queryUrl = `/analytics/dashboard?preset=${selectedPreset}`;
        if (selectedPreset === 'custom' && customRange) {
          queryUrl = `/analytics/dashboard?from=${encodeURIComponent(customRange.from)}&to=${encodeURIComponent(customRange.to)}`;
        }

        const res = await cachedApiRequest<DashboardData>(queryUrl, {
          forceRefresh: force,
          onRevalidate: (fresh) => setData(fresh),
        });
        setData(res);
      } catch (err) {
        console.error('Failed to load dashboard data', err);
        setData((prev) => prev || {
          filter: { preset: 'all', from: null, to: null },
          kpi: {
            totalRevenue: 0,
            deltaRevenue: null,
            periodInvoices: 0,
            deltaInvoices: null,
            todayInvoices: 0,
            totalInvoices: 0,
            totalCollected: 0,
            totalCollectedCount: 0,
            cashToBeCollectedFromDrivers: 0,
            pendingDriverDeliveriesCount: 0,
            receivablesTotal: 0,
            receivablesCount: 0,
            payablesTotal: 0,
            payablesCount: 0,
            pendingUpi: 0,
            productCount: 0,
            partyCount: 0,
          },
          pendingDriverDeliveries: [],
          revenueTrend: [],
          paymentSplit: [],
          categorySplit: [],
          salesmenPerformance: [],
          receivablesHealth: {
            unpaid: { count: 0, total: 0 },
            partial: { count: 0, total: 0 },
            overdue: { count: 0, total: 0 },
            topPending: [],
          },
          recentTransactions: [],
          salesmanRecentInvoices: [],
        });
      } finally {
        setLoading(false);
      }
    },
    [preset]
  );

  useEffect(() => {
    if (isDriver || isSupervisor) return;
    void loadDashboard(preset);
  }, [isDriver, isSupervisor, preset, loadDashboard]);

  useEffect(() => {
    const handleRefresh = () => {
      void loadDashboard(preset, undefined, true);
    };
    window.addEventListener('app:refresh-active-page', handleRefresh);
    return () => window.removeEventListener('app:refresh-active-page', handleRefresh);
  }, [preset, loadDashboard]);

  const handleApplyCustomDate = () => {
    if (!customFrom || !customTo) {
      alert('Please select both start and end date');
      return;
    }
    setPreset('custom');
    loadDashboard('custom', { from: customFrom, to: customTo });
  };

  // Owner collects cash from driver
  const handleCollectCashFromDriver = async (
    deliveryId: string,
    amount: number,
    driverName: string,
    invoiceNo: string
  ) => {
    setCollectingId(deliveryId);
    try {
      await apiRequest(`/delivery/${deliveryId}/handover-cash`, {
        method: 'PATCH',
      });
      setSuccessBanner(
        `✓ Cash of ₹${amount.toLocaleString('en-IN')} collected from ${driverName} for Invoice #${invoiceNo}! Added to transactions and deducted from driver custody.`
      );
      await loadDashboard(preset, undefined, true);
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to collect cash from driver');
    } finally {
      setCollectingId(null);
    }
  };

  if (user?.role === 'DRIVER') {
    return <DriverDashboard userName={user.name || user.phone} />;
  }

  if (user?.role === 'SUPERVISOR') {
    return <SupervisorDashboard user={user} />;
  }

  if (user?.role === 'SALESMAN' || data?.role === 'SALESMAN') {
    return (
      <SalesmanDashboard
        user={user}
        data={data}
        loading={loading}
        preset={preset}
        setPreset={setPreset}
        customFrom={customFrom}
        setCustomFrom={setCustomFrom}
        customTo={customTo}
        setCustomTo={setCustomTo}
        handleApplyCustomDate={handleApplyCustomDate}
        loadDashboard={loadDashboard}
      />
    );
  }

  return (
    <div className="space-y-6 sm:space-y-7 max-w-7xl mx-auto pb-14 text-foreground">
      {/* Top Header & Date Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">Executive Dashboard</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-primary/10 text-primary border border-primary/20">
              Live Intel
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Real-time sales, confirmed collections, driver handovers, credit health, and staff performance.
          </p>
        </div>

        {/* Date Filter Presets & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div className="flex items-center p-1 bg-muted/60 border border-border/80 rounded-2xl shadow-xs">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: '7d', label: '7 Days' },
                { id: '30d', label: '30 Days' },
                { id: 'month', label: 'This Month' },
                { id: 'all', label: 'All Time' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                  preset === p.id
                    ? 'bg-card text-foreground shadow-xs font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setPreset('custom')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center gap-1 ${
                preset === 'custom'
                  ? 'bg-card text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Calendar className="h-3 w-3" />
              Custom
            </button>
          </div>

          {/* Action Buttons */}
          <Link
            href="/dashboard/invoices"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            New Invoice
          </Link>
        </div>
      </div>

      {/* Custom Date Range Picker Bar (shows when Custom is active) */}
      {preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-card/85 border border-border/80 shadow-md backdrop-blur-xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Calendar className="h-4 w-4 text-primary" />
            <span>Select Range:</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-muted/40 border border-border text-xs text-foreground focus:outline-none focus:border-primary"
            />
            <span className="text-muted-foreground text-xs">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-muted/40 border border-border text-xs text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={handleApplyCustomDate}
            className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition"
          >
            Apply Range
          </button>
        </div>
      )}

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs shadow-md animate-in fade-in">
          <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="flex-1 font-semibold">{successBanner}</span>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 6 Executive Primary KPI Cards */}
      <AnalyticsKpiGrid kpi={data?.kpi} loading={loading} />

      {/* Driver Cash Handover Queue */}
      <DriverCashCollectionQueue
        deliveries={data?.pendingDriverDeliveries || []}
        collectingId={collectingId}
        onCollectCash={handleCollectCashFromDriver}
      />

      {/* Revenue & Cashflow Timeline Interactive SVG Chart */}
      <RevenueCashflowChart trendData={data?.revenueTrend || []} />

      {/* Sales Staff Overview Table */}
      <SalesmenPerformanceTable salesmenPerformance={data?.salesmenPerformance} />

      {/* Payment Methods and Category Split Grid */}
      <PaymentCategoryBreakdown
        paymentSplit={data?.paymentSplit}
        categorySplit={data?.categorySplit}
      />

      {/* Receivables & Credit Health Panel */}
      <ReceivablesHealthCard receivablesHealth={data?.receivablesHealth} />

      {/* Confirmed Transactions Stream */}
      <RecentTransactionsStream recentTransactions={data?.recentTransactions} />
    </div>
  );
}
