'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Receipt,
  Wallet,
  Calendar,
  RefreshCw,
  Plus,
  ArrowRight,
  Package,
  CheckCircle2,
  Phone,
  Clock,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';

export interface SalesmanRecentInvoice {
  id: string;
  invoiceNo: string;
  partyName: string;
  partyPhone?: string;
  total: number;
  status: string;
  paymentMode: string;
  createdAt: string;
}

export interface SalesmanDashboardProps {
  user: {
    id?: string;
    name?: string;
    phone?: string;
    role?: string;
  } | null;
  data: {
    filter?: {
      preset: string;
      from: string | null;
      to: string | null;
    };
    kpi?: {
      totalRevenue: number;
      deltaRevenue: number | null;
      periodInvoices: number;
      deltaInvoices: number | null;
      todayInvoices: number;
      totalInvoices: number;
    };
    revenueTrend?: Array<{
      date: string;
      label: string;
      invoiced: number;
      collected: number;
      credit: number;
    }>;
    categorySplit?: Array<{
      name: string;
      value: number;
    }>;
    salesmanRecentInvoices?: SalesmanRecentInvoice[];
  } | null;
  loading: boolean;
  preset: string;
  setPreset: (preset: 'today' | '7d' | '30d' | 'month' | 'all' | 'custom') => void;
  customFrom: string;
  setCustomFrom: (val: string) => void;
  customTo: string;
  setCustomTo: (val: string) => void;
  handleApplyCustomDate: () => void;
  loadDashboard: () => Promise<void>;
}

export default function SalesmanDashboard({
  user,
  data,
  loading,
  preset,
  setPreset,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
  handleApplyCustomDate,
  loadDashboard,
}: SalesmanDashboardProps) {
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null);

  const kpi = data?.kpi;
  const recentInvoices = data?.salesmanRecentInvoices || [];
  const categories = useMemo(() => data?.categorySplit || [], [data?.categorySplit]);
  const trend = useMemo(() => data?.revenueTrend || [], [data?.revenueTrend]);

  const formatCurrency = (val: number = 0) => {
    return `₹${Math.round(val).toLocaleString('en-IN')}`;
  };

  // SVG Trend Path Calculation
  const trendMetrics = useMemo(() => {
    if (!trend || trend.length === 0) {
      return { path: '', areaPath: '', points: [], maxVal: 0 };
    }
    const maxVal = Math.max(...trend.map((t) => t.invoiced), 1000);
    const height = 180;
    const width = 640;
    const padding = 20;
    const availWidth = width - padding * 2;
    const availHeight = height - padding * 2;

    const points = trend.map((t, idx) => {
      const x = padding + (idx / Math.max(trend.length - 1, 1)) * availWidth;
      const y = height - padding - (t.invoiced / maxVal) * availHeight;
      return { x, y, data: t };
    });

    const path = points.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');

    const areaPath =
      points.length > 0
        ? `${path} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${
            height - padding
          } Z`
        : '';

    return { path, areaPath, points, maxVal };
  }, [trend]);

  // Total sales across categories for progress %
  const totalCategorySales = useMemo(() => {
    return categories.reduce((sum, c) => sum + c.value, 0) || 1;
  }, [categories]);

  // Average ticket
  const avgTicket = useMemo(() => {
    if (!kpi?.periodInvoices || kpi.periodInvoices <= 0) return 0;
    return (kpi.totalRevenue || 0) / kpi.periodInvoices;
  }, [kpi]);

  return (
    <div className="space-y-7 max-w-7xl mx-auto pb-14 text-foreground animate-in fade-in transition-colors">
      {/* Top Header & Date Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[1.5rem] font-black text-foreground tracking-tight">Sales Staff Portal</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[0.625rem] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Personal View
            </span>
          </div>
          <p className="text-[0.8125rem] text-muted-foreground mt-1">
            Welcome back, <strong className="text-foreground font-semibold">{user?.name || 'Sales Staff'}</strong>. Track your personal sales metrics, invoices, and performance.
          </p>
        </div>

        {/* Date Filter Presets & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div className="flex items-center p-1 bg-muted/60 border border-border rounded-[0.875rem] shadow-2xs">
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
                className={`px-3 py-1.5 rounded-[0.625rem] text-[0.75rem] font-semibold transition ${
                  preset === p.id
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/80'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setPreset('custom')}
              className={`px-3 py-1.5 rounded-[0.625rem] text-[0.75rem] font-semibold transition flex items-center gap-1 ${
                preset === 'custom'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/80'
              }`}
            >
              <Calendar className="h-3 w-3" />
              Custom
            </button>
          </div>

          {/* Action Buttons */}
          <button
            onClick={() => loadDashboard()}
            disabled={loading}
            title="Refresh analytics data"
            className="p-2 rounded-[0.75rem] bg-card hover:bg-muted text-foreground border border-border transition shadow-2xs"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-primary' : ''}`} />
          </button>

          <Link
            href="/dashboard/invoices"
            className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-[0.75rem] font-bold px-4 py-2 rounded-[0.75rem] shadow-sm transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Create Invoice
          </Link>
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 bg-card/90 border border-border p-3.5 rounded-[1rem] shadow-xs animate-in fade-in">
          <span className="text-[0.75rem] font-semibold text-muted-foreground">Custom Date Range:</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="bg-background border border-input rounded-[0.625rem] px-3 py-1.5 text-[0.75rem] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <span className="text-muted-foreground text-[0.75rem]">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="bg-background border border-input rounded-[0.625rem] px-3 py-1.5 text-[0.75rem] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <button
            onClick={handleApplyCustomDate}
            className="px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-[0.75rem] font-semibold rounded-[0.625rem] transition shadow-2xs"
          >
            Apply Filter
          </button>
        </div>
      )}

      {/* 3 Dedicated Personal KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Card 1: My Invoiced Sales */}
        <div className="relative overflow-hidden rounded-[1.25rem] border border-border bg-card/75 p-5 backdrop-blur-xl shadow-xs transition hover:border-primary/40 group">
          <div className="flex items-center justify-between">
            <span className="text-[0.6875rem] font-semibold text-muted-foreground uppercase tracking-wider">
              My Invoiced Sales
            </span>
            <div className="p-2.5 rounded-[0.75rem] bg-primary/10 text-primary group-hover:scale-110 transition">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-[1.875rem] font-black text-foreground tracking-tight">
              {formatCurrency(kpi?.totalRevenue)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              {kpi?.deltaRevenue !== null && kpi?.deltaRevenue !== undefined ? (
                <span
                  className={`inline-flex items-center gap-1 text-[0.6875rem] font-bold px-2 py-0.5 rounded-full ${
                    kpi.deltaRevenue >= 0
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {kpi.deltaRevenue >= 0 ? '+' : ''}
                  {kpi.deltaRevenue.toFixed(1)}% vs prev period
                </span>
              ) : (
                <span className="text-[0.6875rem] font-medium text-muted-foreground">
                  Selected period volume
                </span>
              )}
            </div>
            <p className="text-[0.6875rem] text-muted-foreground mt-2">
              100% upfront collected via Cash or UPI QR
            </p>
          </div>
        </div>

        {/* Card 2: My Invoices Raised */}
        <div className="relative overflow-hidden rounded-[1.25rem] border border-border bg-card/75 p-5 backdrop-blur-xl shadow-xs transition hover:border-emerald-500/40 group">
          <div className="flex items-center justify-between">
            <span className="text-[0.6875rem] font-semibold text-muted-foreground uppercase tracking-wider">
              My Invoices Raised
            </span>
            <div className="p-2.5 rounded-[0.75rem] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition">
              <Receipt className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-[1.875rem] font-black text-foreground tracking-tight">
              {kpi?.periodInvoices || 0}{' '}
              <span className="text-[1rem] font-semibold text-muted-foreground">invoices</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[0.75rem] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                {kpi?.todayInvoices || 0} raised today
              </span>
            </div>
            <p className="text-[0.6875rem] text-muted-foreground mt-2">
              {kpi?.totalInvoices || 0} lifetime invoices raised by you
            </p>
          </div>
        </div>

        {/* Card 3: Average Ticket Size */}
        <div className="relative overflow-hidden rounded-[1.25rem] border border-border bg-card/75 p-5 backdrop-blur-xl shadow-xs transition hover:border-violet-500/40 group">
          <div className="flex items-center justify-between">
            <span className="text-[0.6875rem] font-semibold text-muted-foreground uppercase tracking-wider">
              Average Ticket Size
            </span>
            <div className="p-2.5 rounded-[0.75rem] bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:scale-110 transition">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-[1.875rem] font-black text-foreground tracking-tight">
              {formatCurrency(avgTicket)}
              <span className="text-[0.75rem] font-normal text-muted-foreground ml-1.5">/ bill</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[0.6875rem] font-semibold text-violet-700 dark:text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20">
                Average invoice order size
              </span>
            </div>
            <p className="text-[0.6875rem] text-muted-foreground mt-2">
              Direct retail billing without credit defaults
            </p>
          </div>
        </div>
      </div>

      {/* Middle Grid: Personal Sales Timeline & Categories Sold */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 Cols): My Sales Timeline */}
        <div className="lg:col-span-2 rounded-[1.25rem] border border-border bg-card/75 p-6 backdrop-blur-xl shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-[1rem] font-bold text-foreground tracking-tight">
                  My Sales Timeline
                </h2>
              </div>
              <span className="text-[0.75rem] font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                {trend.length} Timepoints
              </span>
            </div>
            <p className="text-[0.75rem] text-muted-foreground mb-4">
              Daily trend of invoices billed by you in the selected window.
            </p>
          </div>

          {/* SVG Trend Chart */}
          {trend.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-[0.75rem] border border-dashed border-border rounded-[1rem]">
              No sales data recorded in this period.
            </div>
          ) : (
            <div className="relative w-full overflow-hidden">
              <svg
                viewBox="0 0 640 180"
                className="w-full h-44 overflow-visible"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="salesmanTrendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary, #6366f1)" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="var(--color-primary, #6366f1)" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Subtle Grid Lines */}
                <line x1="20" y1="40" x2="620" y2="40" stroke="currentColor" strokeDasharray="3 3" opacity="0.1" />
                <line x1="20" y1="90" x2="620" y2="90" stroke="currentColor" strokeDasharray="3 3" opacity="0.1" />
                <line x1="20" y1="140" x2="620" y2="140" stroke="currentColor" strokeDasharray="3 3" opacity="0.1" />

                {/* Area under curve */}
                {trendMetrics.areaPath && (
                  <path d={trendMetrics.areaPath} fill="url(#salesmanTrendGrad)" />
                )}

                {/* Line Path */}
                {trendMetrics.path && (
                  <path
                    d={trendMetrics.path}
                    fill="none"
                    stroke="var(--color-primary, #6366f1)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Interactive Points */}
                {trendMetrics.points.map((pt, idx) => (
                  <g key={idx}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={hoveredTrendIdx === idx ? 6 : 4}
                      fill={hoveredTrendIdx === idx ? '#ffffff' : 'var(--color-primary, #6366f1)'}
                      stroke="var(--color-background, #0b0f19)"
                      strokeWidth="2"
                      className="cursor-pointer transition-all duration-150"
                      onMouseEnter={() => setHoveredTrendIdx(idx)}
                      onMouseLeave={() => setHoveredTrendIdx(null)}
                    />
                  </g>
                ))}
              </svg>

              {/* Hover Details Card */}
              {hoveredTrendIdx !== null && trendMetrics.points[hoveredTrendIdx] && (
                <div className="absolute top-2 right-4 bg-card/95 border border-border p-2.5 rounded-[0.875rem] shadow-xl text-[0.75rem] backdrop-blur-md animate-in fade-in">
                  <div className="text-muted-foreground font-medium">
                    {trendMetrics.points[hoveredTrendIdx].data.date}
                  </div>
                  <div className="text-[0.875rem] font-bold text-foreground mt-0.5">
                    {formatCurrency(trendMetrics.points[hoveredTrendIdx].data.invoiced)}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-[0.6875rem] text-muted-foreground pt-3 border-t border-border/70 mt-2">
            <span>Period Start: {trend[0]?.label || 'Start'}</span>
            <span>Period End: {trend[trend.length - 1]?.label || 'Today'}</span>
          </div>
        </div>

        {/* Right (1 Col): Categories Sold by Me */}
        <div className="rounded-[1.25rem] border border-border bg-card/75 p-6 backdrop-blur-xl shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-emerald-500" />
              <h2 className="text-[1rem] font-bold text-foreground tracking-tight">
                Categories Sold
              </h2>
            </div>
            <p className="text-[0.75rem] text-muted-foreground mb-4">
              Product categories invoiced by you.
            </p>

            {categories.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-[0.75rem]">
                No category sales recorded yet.
              </div>
            ) : (
              <div className="space-y-4">
                {categories.map((cat, idx) => {
                  const pct = Math.round((cat.value / totalCategorySales) * 100);
                  const colors = [
                    'from-indigo-500 to-indigo-600',
                    'from-emerald-500 to-emerald-600',
                    'from-cyan-500 to-cyan-600',
                    'from-amber-500 to-amber-600',
                  ];
                  const color = colors[idx % colors.length];

                  return (
                    <div key={cat.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-[0.75rem]">
                        <span className="font-semibold text-foreground">{cat.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-muted-foreground font-medium">
                            {formatCurrency(cat.value)}
                          </span>
                          <span className="text-[0.625rem] font-bold text-muted-foreground">
                            {pct}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border/70 mt-4 flex items-center justify-between text-[0.75rem] text-muted-foreground">
            <span>Total Catalog Volume:</span>
            <span className="font-bold text-foreground font-mono">
              {formatCurrency(totalCategorySales)}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Table: My Recent Invoices */}
      <div className="rounded-[1.25rem] border border-border bg-card/75 p-6 backdrop-blur-xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              <h2 className="text-[1rem] font-bold text-foreground tracking-tight">
                My Recent Invoices
              </h2>
            </div>
            <p className="text-[0.75rem] text-muted-foreground mt-0.5">
              Customer invoices created directly by your account.
            </p>
          </div>

          <Link
            href="/dashboard/invoices"
            className="inline-flex items-center gap-1.5 text-[0.75rem] font-semibold text-primary hover:text-primary/80 transition"
          >
            Go to Invoices
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto rounded-[0.875rem] border border-border/70">
          <table className="w-full text-left text-[0.75rem] text-foreground">
            <thead className="bg-muted/50 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="py-2.5 px-3.5">Invoice #</th>
                <th className="py-2.5 px-3.5">Customer / Party</th>
                <th className="py-2.5 px-3.5">Date & Time</th>
                <th className="py-2.5 px-3.5 text-right">Grand Total</th>
                <th className="py-2.5 px-3.5 text-center">Payment Mode</th>
                <th className="py-2.5 px-3.5 text-center">Status</th>
                <th className="py-2.5 px-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {recentInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted-foreground">
                    No invoices generated yet. Click &quot;Create Invoice&quot; to begin.
                  </td>
                </tr>
              ) : (
                recentInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-3.5 font-mono font-bold text-primary">
                      {inv.invoiceNo}
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="font-semibold text-foreground">{inv.partyName}</div>
                      {inv.partyPhone && (
                        <div className="text-[0.6875rem] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3" />
                          {inv.partyPhone}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-muted-foreground text-[0.6875rem]">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {new Date(inv.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      <span className="text-[0.625rem] text-muted-foreground ml-4">
                        {new Date(inv.createdAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono font-bold text-foreground">
                      {formatCurrency(inv.total)}
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[0.625rem] font-bold ${
                          inv.paymentMode === 'UPI'
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : inv.paymentMode === 'CASH'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {inv.paymentMode}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[0.625rem] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <Link
                        href={`/dashboard/invoices`}
                        className="px-2.5 py-1 rounded-[0.5rem] text-foreground hover:bg-muted bg-card border border-border font-medium text-[0.75rem] transition-colors"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Operational Policy Note */}
      <div className="flex items-start gap-3 rounded-[1.25rem] border border-border bg-card/60 backdrop-blur-xl p-4 text-[0.75rem] text-muted-foreground shadow-2xs">
        <ShieldAlert className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-foreground">Sales Operational Policy:</span>{' '}
          All customer invoices generated by sales staff are collected 100% upfront via Cash or UPI QR. Lending credit, approving customer returns, and driver cash collections are restricted to Store Owners and Administrators.
        </div>
      </div>
    </div>
  );
}
