'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { 
  BookOpen, 
  Calendar, 
  ArrowLeft, 
  ArrowRight, 
  Wallet, 
  ArrowDownLeft, 
  ArrowUpRight, 
  QrCode, 
  Building2, 
  Loader2,
  RefreshCw,
  Clock
} from 'lucide-react';
import { formatINR, formatDateTime } from '@/lib/formatters';

interface DayBookResponse {
  date: string;
  summary: {
    openingCash: number;
    cashIn: number;
    cashOut: number;
    expenseCash: number;
    netCashFlow: number;
    closingCash: number;
    digital: {
      upiIn: number;
      bankIn: number;
      totalDigital: number;
    };
  };
  transactions: {
    payments: Array<{
      id: string;
      type: string; // INFLOW or OUTFLOW
      mode: string;
      amount: number;
      partyName: string;
      refNo: string;
      time: string;
      notes?: string;
    }>;
    expenses: Array<{
      id: string;
      expenseNo?: string;
      category: string;
      amount: number;
      paymentMode: string;
      paidTo?: string;
      time: string;
      notes?: string;
    }>;
    purchases: Array<{
      id: string;
      purchaseNo: string;
      partyName?: string;
      total: number;
      paymentMode: string;
      time: string;
    }>;
  };
}

export default function DayBookPage() {
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [data, setData] = useState<DayBookResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDayBook = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res = await apiRequest<DayBookResponse>(`/analytics/day-book?date=${date}`);
      setData(res);
    } catch (err) {
      console.error('Failed to load day book', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDayBook(selectedDate);
    const handleRefresh = () => fetchDayBook(selectedDate);
    window.addEventListener('app:refresh-active-page', handleRefresh);
    return () => window.removeEventListener('app:refresh-active-page', handleRefresh);
  }, [selectedDate, fetchDayBook]);

  const handleShiftDay = (days: number) => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() + days);
    setSelectedDate(cur.toISOString().slice(0, 10));
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().slice(0, 10));
  };

  // Unified chronological transactions list
  const combinedEntries = useMemo(() => {
    if (!data) return [];
    const list: Array<{
      id: string;
      timestamp: number;
      timeStr: string;
      title: string;
      subTitle: string;
      mode: string;
      isCredit: boolean; // true = inflow (green), false = outflow (red)
      amount: number;
    }> = [];

    // Payments
    (data.transactions.payments || []).forEach((p) => {
      list.push({
        id: `pay-${p.id}`,
        timestamp: new Date(p.time).getTime(),
        timeStr: p.time,
        title: p.type === 'INFLOW' ? `Payment Received: ${p.partyName}` : `Payout: ${p.partyName}`,
        subTitle: `Ref: #${p.refNo}${p.notes ? ` • ${p.notes}` : ''}`,
        mode: p.mode,
        isCredit: p.type === 'INFLOW',
        amount: p.amount,
      });
    });

    // Expenses
    (data.transactions.expenses || []).forEach((e) => {
      list.push({
        id: `exp-${e.id}`,
        timestamp: new Date(e.time).getTime(),
        timeStr: e.time,
        title: `Expense: ${e.category.replace(/_/g, ' ')}`,
        subTitle: `${e.paidTo ? `Paid to: ${e.paidTo} • ` : ''}${e.notes || ''}`,
        mode: e.paymentMode,
        isCredit: false,
        amount: e.amount,
      });
    });

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Header & Date Controller */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Day Book & Till Reconciliation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time daily cash drawer balancing, digital inflows, and chronological store ledger
          </p>
        </div>

        {/* Date Selector Navigation */}
        <div className="flex items-center gap-2 bg-card border border-border p-1.5 rounded-2xl shadow-2xs">
          <button
            onClick={() => handleShiftDay(-1)}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition"
            title="Previous Day"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent border-none text-xs font-semibold text-foreground focus:outline-none cursor-pointer px-2"
          />

          <button
            onClick={() => handleShiftDay(1)}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition"
            title="Next Day"
          >
            <ArrowRight className="h-4 w-4" />
          </button>

          <Button
            variant="outline"
            onClick={handleToday}
            className="text-[11px] font-semibold h-7 px-2.5 rounded-xl ml-1"
          >
            Today
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm">Calculating day book balance...</span>
        </div>
      ) : data ? (
        <>
          {/* Main Till Balancing Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Opening Cash */}
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Opening Cash in Hand
              </span>
              <span className="text-2xl font-extrabold text-foreground tracking-tight block">
                {formatINR(data.summary.openingCash)}
              </span>
              <span className="text-[11px] text-muted-foreground block">
                Balance brought forward from previous days
              </span>
            </div>

            {/* Cash Inflow */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                  Cash Inflow (+)
                </span>
                <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight block">
                +{formatINR(data.summary.cashIn)}
              </span>
              <span className="text-[11px] text-muted-foreground block">
                Customer counter cash & driver deposits
              </span>
            </div>

            {/* Cash Outflow */}
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-800 dark:text-rose-300 uppercase tracking-wider">
                  Cash Outflow (-)
                </span>
                <ArrowUpRight className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
              <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight block">
                -{formatINR(data.summary.cashOut + data.summary.expenseCash)}
              </span>
              <span className="text-[11px] text-muted-foreground block">
                Shop expenses ({formatINR(data.summary.expenseCash)}) + Payouts ({formatINR(data.summary.cashOut)})
              </span>
            </div>

            {/* Closing Cash in Hand */}
            <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Closing Cash in Hand
                </span>
                <Wallet className="h-4 w-4 text-primary" />
              </div>
              <span className="text-2xl font-extrabold text-foreground tracking-tight block">
                {formatINR(data.summary.closingCash)}
              </span>
              <span className="text-[11px] text-primary font-medium block">
                Exact physical cash expected in drawer till
              </span>
            </div>
          </div>

          {/* Digital Settlements Card */}
          <div className="p-4 rounded-2xl border border-border/80 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <QrCode className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Digital Inflows (Bank / UPI)</h3>
                <p className="text-xs text-muted-foreground">
                  Direct merchant settlement into store bank accounts (outside physical cash till)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-semibold block">UPI QR</span>
                <span className="text-sm font-bold text-foreground">{formatINR(data.summary.digital.upiIn)}</span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-semibold block">Bank Transfer</span>
                <span className="text-sm font-bold text-foreground">{formatINR(data.summary.digital.bankIn)}</span>
              </div>
              <div className="border-l border-border pl-6">
                <span className="text-[11px] text-primary uppercase font-bold block">Total Digital</span>
                <span className="text-base font-extrabold text-primary">
                  {formatINR(data.summary.digital.totalDigital)}
                </span>
              </div>
            </div>
          </div>

          {/* Unified Chronological Ledger Table */}
          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Chronological Transaction Audit Stream ({combinedEntries.length})
                </h3>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                Date: {selectedDate}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-foreground">
                <thead className="bg-muted/50 uppercase tracking-wider text-[11px] text-muted-foreground border-b border-border font-semibold">
                  <tr>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Transaction / Party</th>
                    <th className="py-3 px-4">Details / Reference</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4 text-right">Inflow (+)</th>
                    <th className="py-3 px-4 text-right">Outflow (-)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {combinedEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground">
                        No financial movements recorded for this date.
                      </td>
                    </tr>
                  ) : (
                    combinedEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          {new Date(entry.timeStr).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-4 font-medium text-foreground">
                          {entry.title}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-[11px]">
                          {entry.subTitle}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                            {entry.mode}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {entry.isCredit ? `+${formatINR(entry.amount)}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-rose-600 dark:text-rose-400">
                          {!entry.isCredit ? `-${formatINR(entry.amount)}` : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
