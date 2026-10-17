'use client';

import { useState, useEffect, useCallback, useMemo, useDeferredValue } from 'react';
import { apiRequest, cachedApiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeftRight, 
  Search, 
  Clock, 
  CreditCard, 
  Banknote, 
  ArrowUpRight, 
  ArrowDownLeft,
  CheckCircle2,
  Loader2,
  Check,
  BookOpen,
  Calendar,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { PaymentStatsGrid } from '@/components/payments/payment-stats-grid';
import { 
  PendingItem, 
  PaymentRecord, 
  CreditLedgerRecord, 
  Party, 
  FinancialStats,
  PendingCreditLedger 
} from '@/components/payments/types';
import { SettlementModal } from '@/components/payments/settlement-modal';
import { CreditLedgerModal } from '@/components/payments/credit-ledger-modal';

export interface DayBookResponse {
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
      type: string;
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

export type TabType = 'daybook' | 'dues' | 'payables' | 'all' | 'inflows' | 'credits';

interface SettlementConfig {
  isOpen: boolean;
  direction: 'COLLECT' | 'PAY';
  partyId?: string;
  invoiceId?: string;
  amount?: string;
  notes?: string;
  mode?: 'UPI' | 'CASH';
}

export default function TransactionsPage() {
  // Data states
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [creditLedgers, setCreditLedgers] = useState<CreditLedgerRecord[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [stats, setStats] = useState<FinancialStats>({
    totalSales: 0,
    totalCollected: 0,
    totalPaidOut: 0,
    cashCollected: 0,
    upiCollected: 0,
    bankCollected: 0,
    pendingReceivables: 0,
    creditsOwed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('dues');
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [dateFilterMode, setDateFilterMode] = useState<'all' | 'specific'>('all');
  const [dayBookData, setDayBookData] = useState<DayBookResponse | null>(null);
  const [dayBookLoading, setDayBookLoading] = useState(false);

  // Modal states
  const [settlementConfig, setSettlementConfig] = useState<SettlementConfig>({
    isOpen: false,
    direction: 'COLLECT',
  });
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [creditPartyId, setCreditPartyId] = useState('');

  // Helper to format pending items: pending invoices + unsettled credit ledgers
  const formatPendingList = useCallback(
    (pData: { invoices: PendingItem[]; ledgers: PendingCreditLedger[] }) => {
      return [
        ...pData.invoices.map((inv) => ({
          id: inv.id,
          invoiceNo: inv.invoiceNo,
          partyId: inv.partyId,
          partyName: inv.partyName,
          partyPhone: inv.partyPhone,
          total: inv.total,
          paid: inv.paid,
          remainingDue: inv.remainingDue,
          createdAt: inv.createdAt,
          status: inv.status,
          isCreditLedger: false,
          creditType: 'RECEIVABLE' as const,
        })),
        ...pData.ledgers
          .filter(
            (cl) =>
              cl.type === 'PAYABLE' ||
              (!cl.invoiceId &&
                !pData.invoices.some(
                  (inv) =>
                    inv.id === cl.invoiceId ||
                    (cl.invoiceNo && inv.invoiceNo === cl.invoiceNo),
                )),
          )
          .map((cl) => ({
            id: cl.id,
            invoiceNo:
              cl.invoiceNo ||
              (cl.type === 'PAYABLE' ? 'Store Payable' : 'Direct Party Credit'),
            partyId: cl.partyId,
            partyName: cl.partyName || 'Party',
            partyPhone: cl.partyPhone || '',
            total: cl.amountDue,
            paid: 0,
            remainingDue: cl.amountDue,
            createdAt: cl.createdAt,
            status: cl.status,
            isCreditLedger: true,
            creditType: cl.type as 'RECEIVABLE' | 'PAYABLE',
          })),
      ];
    },
    [],
  );

  // Load All Data
  const loadData = useCallback(async (force = false) => {
    try {
      const [paymentsData, statsData, pendingData, creditsData, partiesData] = await Promise.all([
        cachedApiRequest<PaymentRecord[]>('/payments', {
          forceRefresh: force,
          onRevalidate: (fresh) => setPayments(fresh),
        }).catch(() => []),
        cachedApiRequest<FinancialStats>('/payments/stats', {
          forceRefresh: force,
          onRevalidate: (fresh) => setStats(fresh),
        }).catch(() => ({
          totalSales: 0,
          totalCollected: 0,
          totalPaidOut: 0,
          cashCollected: 0,
          upiCollected: 0,
          bankCollected: 0,
          pendingReceivables: 0,
          creditsOwed: 0,
        })),
        cachedApiRequest<{ invoices: PendingItem[]; ledgers: PendingCreditLedger[] }>('/payments/pending', {
          forceRefresh: force,
          onRevalidate: (fresh) => setPendingItems(formatPendingList(fresh)),
        }).catch(() => ({
          invoices: [],
          ledgers: [],
        })),
        cachedApiRequest<CreditLedgerRecord[]>('/payments/credits', {
          forceRefresh: force,
          onRevalidate: (fresh) => setCreditLedgers(fresh),
        }).catch(() => []),
        cachedApiRequest<Party[]>('/parties', {
          forceRefresh: force,
          onRevalidate: (fresh) => setParties(fresh),
        }).catch(() => []),
      ]);

      setPayments(paymentsData);
      setStats(statsData);
      setCreditLedgers(creditsData);
      setParties(partiesData);
      setPendingItems(formatPendingList(pendingData));
    } catch (err) {
      console.error('Failed to load transactions data:', err);
    } finally {
      setLoading(false);
    }
  }, [formatPendingList]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    const handleRefresh = () => {
      loadData(true);
    };
    window.addEventListener('app:refresh-active-page', handleRefresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('app:refresh-active-page', handleRefresh);
    };
  }, [loadData]);

  // Load Day Book reconciliation data for selectedDate
  const fetchDayBook = useCallback(async (date: string) => {
    setDayBookLoading(true);
    try {
      const res = await apiRequest<DayBookResponse>(`/analytics/day-book?date=${date}`);
      setDayBookData(res);
    } catch (err) {
      console.error('Failed to load day book reconciliation data:', err);
    } finally {
      setDayBookLoading(false);
    }
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (activeTab === 'daybook' || dateFilterMode === 'specific') {
      timer = setTimeout(() => {
        void fetchDayBook(selectedDate);
      }, 0);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [selectedDate, activeTab, dateFilterMode, fetchDayBook]);

  // Support direct redirect / link: /dashboard/payments?tab=daybook
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'daybook') {
        timer = setTimeout(() => {
          setActiveTab('daybook');
          setDateFilterMode('specific');
        }, 0);
      }
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleShiftDay = (days: number) => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() + days);
    setSelectedDate(cur.toISOString().slice(0, 10));
    setDateFilterMode('specific');
  };

  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const handleToday = () => {
    setSelectedDate(todayStr);
    setDateFilterMode('specific');
  };

  const handleYesterday = () => {
    setSelectedDate(yesterdayStr);
    setDateFilterMode('specific');
  };

  const handleAllTime = () => {
    setDateFilterMode('all');
    if (activeTab === 'daybook') {
      setActiveTab('all');
    }
  };

  // Unified chronological Day Book transactions list
  const combinedDayBookEntries = useMemo(() => {
    if (!dayBookData) return [];
    const list: Array<{
      id: string;
      timestamp: number;
      timeStr: string;
      title: string;
      subTitle: string;
      mode: string;
      isCredit: boolean;
      amount: number;
    }> = [];

    (dayBookData.transactions.payments || []).forEach((p) => {
      list.push({
        id: `pay-${p.id}`,
        timestamp: new Date(p.time).getTime(),
        timeStr: p.time,
        title: p.type === 'INFLOW' ? `Payment Received: ${p.partyName}` : `Payout / Refund: ${p.partyName}`,
        subTitle: `Ref: #${p.refNo}${p.notes ? ` • ${p.notes}` : ''}`,
        mode: p.mode,
        isCredit: p.type === 'INFLOW',
        amount: p.amount,
      });
    });

    (dayBookData.transactions.expenses || []).forEach((e) => {
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
  }, [dayBookData]);

  // Open Modal directly from a Pending Row
  const handleOpenActionForPending = (item: PendingItem) => {
    const isPayable = item.creditType === 'PAYABLE';
    setSettlementConfig({
      isOpen: true,
      direction: isPayable ? 'PAY' : 'COLLECT',
      partyId: item.partyId,
      invoiceId: item.isCreditLedger ? '' : item.id,
      amount: item.remainingDue.toFixed(2),
      mode: isPayable ? 'CASH' : 'UPI',
      notes: isPayable
        ? 'Payment made to ' + item.partyName + ' to settle payable debt'
        : (item.invoiceNo ? 'Payment received for ' + item.invoiceNo : 'Payment received from ' + item.partyName),
    });
  };

  // Open Collect Modal from Header Button (Customer paying store)
  const handleOpenGeneralCollect = () => {
    setSettlementConfig({
      isOpen: true,
      direction: 'COLLECT',
      partyId: parties[0]?.id || '',
      amount: '',
      notes: '',
      mode: 'UPI',
    });
  };

  // Open Pay Modal from Header Button (Store paying party/vendor)
  const handleOpenGeneralPay = () => {
    setSettlementConfig({
      isOpen: true,
      direction: 'PAY',
      partyId: parties[0]?.id || '',
      amount: '',
      notes: '',
      mode: 'CASH',
    });
  };

  // Confirm existing PENDING payment
  const handleConfirmPendingPayment = async (id: string) => {
    try {
      await apiRequest('/payments/' + id + '/confirm', { method: 'PATCH' });
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to confirm payment');
    }
  };

  // Deferred search keeps keyboard input instant while filtering runs on idle frames
  const deferredSearch = useDeferredValue(search);

  // Filters for tables (Separated Dues vs Payables)
  const customerDues = useMemo(
    () => pendingItems.filter((item) => item.creditType === 'RECEIVABLE'),
    [pendingItems]
  );
  const storePayables = useMemo(
    () => pendingItems.filter((item) => item.creditType === 'PAYABLE'),
    [pendingItems]
  );

  const filteredDues = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    if (!q) return customerDues;
    return customerDues.filter(
      (item) =>
        item.partyName.toLowerCase().includes(q) ||
        item.partyPhone.includes(q) ||
        (item.invoiceNo && item.invoiceNo.toLowerCase().includes(q))
    );
  }, [customerDues, deferredSearch]);

  const filteredPayables = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    if (!q) return storePayables;
    return storePayables.filter(
      (item) =>
        item.partyName.toLowerCase().includes(q) ||
        item.partyPhone.includes(q) ||
        (item.invoiceNo && item.invoiceNo.toLowerCase().includes(q))
    );
  }, [storePayables, deferredSearch]);

  const filteredPayments = useMemo(() => {
    let base = payments;
    if (dateFilterMode === 'specific' && selectedDate) {
      base = base.filter((p) => {
        const pDate = p.paidAt || p.createdAt;
        return pDate && pDate.slice(0, 10) === selectedDate;
      });
    }
    const q = deferredSearch.toLowerCase().trim();
    if (!q) return base;
    return base.filter((p) => {
      const partyName = p.invoice?.party?.name || p.party?.name || '';
      const invNo = p.invoice?.invoiceNo || '';
      const utr = p.upiUtr || '';
      return partyName.toLowerCase().includes(q) || invNo.toLowerCase().includes(q) || utr.toLowerCase().includes(q);
    });
  }, [payments, dateFilterMode, selectedDate, deferredSearch]);

  const filteredCredits = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    if (!q) return creditLedgers;
    return creditLedgers.filter((cl) => {
      const partyName = cl.party?.name || '';
      const invNo = cl.invoice?.invoiceNo || '';
      const notes = cl.notes || '';
      return partyName.toLowerCase().includes(q) || invNo.toLowerCase().includes(q) || notes.toLowerCase().includes(q);
    });
  }, [creditLedgers, deferredSearch]);

  return (
    <div className="space-y-6">
      {/* Page Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <ArrowLeftRight className="h-6 w-6 text-primary" />
            Transactions & Cash Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time sales revenue, dynamic UPI QR checkout, counter cash settlements, and party credit ledgers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => {
              setCreditPartyId(parties[0]?.id || '');
              setIsCreditModalOpen(true);
            }}
            className="inline-flex items-center gap-2 border-border/60 text-foreground font-medium px-3.5 py-2 rounded-[0.75rem] text-xs sm:text-sm active:scale-98"
          >
            <CreditCard className="h-4 w-4 text-amber-500" />
            Record Credit / Advance
          </Button>

          <Button
            onClick={handleOpenGeneralPay}
            className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-medium px-3.5 py-2 rounded-[0.75rem] text-xs sm:text-sm shadow-sm active:scale-98"
          >
            <ArrowUpRight className="h-4 w-4" />
            Make Payment (Pay Party)
          </Button>

          <Button
            onClick={handleOpenGeneralCollect}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-[0.75rem] text-xs sm:text-sm shadow-sm active:scale-98"
          >
            <Banknote className="h-4 w-4" />
            Collect Payment
          </Button>
        </div>
      </div>

      {/* Date-wise Navigation Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card/80 p-2.5 rounded-2xl border border-border/80 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 ml-1">
            <Calendar className="h-4 w-4 text-primary" />
            Date Filter:
          </span>

          <div className="flex items-center gap-1.5 bg-muted/40 border border-border/60 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => handleShiftDay(-1)}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition"
              title="Previous Day"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setDateFilterMode('specific');
              }}
              className="bg-transparent border-none text-xs font-semibold text-foreground focus:outline-none cursor-pointer px-1"
            />

            <button
              type="button"
              onClick={() => handleShiftDay(1)}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition"
              title="Next Day"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleYesterday}
            className={`text-xs h-7 px-2.5 rounded-xl ${
              dateFilterMode === 'specific' &&
              selectedDate === yesterdayStr
                ? 'bg-muted font-bold text-foreground'
                : 'text-muted-foreground'
            }`}
          >
            Yesterday
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleToday}
            className={`text-xs h-7 px-2.5 rounded-xl ${
              dateFilterMode === 'specific' &&
              selectedDate === todayStr
                ? 'bg-primary/10 text-primary font-bold border-primary/30'
                : 'text-muted-foreground'
            }`}
          >
            Today
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={dateFilterMode === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={handleAllTime}
            className="text-xs h-7 px-3 rounded-xl"
          >
            All Dates (Overall)
          </Button>

          <Button
            variant={activeTab === 'daybook' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setActiveTab('daybook');
              setDateFilterMode('specific');
            }}
            className="text-xs h-7 px-3 rounded-xl inline-flex items-center gap-1.5"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Till Drawer ({selectedDate})
          </Button>
        </div>
      </div>

      {/* Daily Till Drawer Summary (Opening Cash, Inflows, Outflows, Expenses, Net Flow & Closing Cash) */}
      {(dateFilterMode === 'specific' || activeTab === 'daybook') && (
        <div className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Till Reconciliation & Closing Balance ({selectedDate})
              </h2>
            </div>
            {dayBookLoading && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                Balancing till drawer...
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {/* 1. Opening Cash */}
            <div className="p-3 rounded-xl border border-border/60 bg-muted/20">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Opening Cash</span>
              <div className="text-base font-bold font-mono text-foreground mt-1">
                ₹{(dayBookData?.summary.openingCash || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-muted-foreground">Drawer starting cash</span>
            </div>

            {/* 2. Cash In */}
            <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">Cash Inflows</span>
              <div className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-1">
                +₹{(dayBookData?.summary.cashIn || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-emerald-700/70 dark:text-emerald-300/70">Sales & collected cash</span>
            </div>

            {/* 3. Cash Out */}
            <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5">
              <span className="text-[10px] font-semibold text-rose-700 dark:text-rose-300 uppercase tracking-wider block">Cash Outflows</span>
              <div className="text-base font-bold font-mono text-rose-700 dark:text-rose-300 mt-1">
                -₹{(dayBookData?.summary.cashOut || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-rose-700/70 dark:text-rose-300/70">Customer refunds</span>
            </div>

            {/* 4. Daily Expenses */}
            <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider block">Cash Expenses</span>
              <div className="text-base font-bold font-mono text-amber-700 dark:text-amber-300 mt-1">
                -₹{(dayBookData?.summary.expenseCash || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-amber-700/70 dark:text-amber-300/70">Daily operational expenses</span>
            </div>

            {/* 5. Net Cash Flow */}
            <div className="p-3 rounded-xl border border-primary/20 bg-primary/5">
              <span className="text-[10px] font-semibold text-primary uppercase tracking-wider block">Net Cash Flow</span>
              <div className="text-base font-bold font-mono text-foreground mt-1">
                {(dayBookData?.summary.netCashFlow || 0) >= 0 ? '+' : ''}₹{(dayBookData?.summary.netCashFlow || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-muted-foreground">Inflows - Outflows - Exp</span>
            </div>

            {/* 6. Closing Cash Balance (Till Drawer) */}
            <div className="p-3 rounded-xl border-2 border-emerald-500/60 bg-emerald-500/10 shadow-xs col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-200 uppercase tracking-wider block">
                  Closing Cash (Till)
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-600 text-white font-bold">DRAWER</span>
              </div>
              <div className="text-lg font-extrabold font-mono text-emerald-800 dark:text-emerald-100 mt-1">
                ₹{(dayBookData?.summary.closingCash || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] font-medium text-emerald-800/80 dark:text-emerald-300/80">Target physical cash</span>
            </div>

            {/* 7. Digital Collections */}
            <div className="p-3 rounded-xl border border-border/60 bg-muted/20 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Digital Inflows</span>
              <div className="text-base font-bold font-mono text-foreground mt-1">
                ₹{(dayBookData?.summary.digital.totalDigital || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-muted-foreground truncate block">
                UPI: ₹{(dayBookData?.summary.digital.upiIn || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} • Bank: ₹{(dayBookData?.summary.digital.bankIn || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Financial KPI Summary Cards (Extracted Component) */}
      <PaymentStatsGrid
        stats={stats}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
      />

      {/* Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          {/* 0. Till & Day Book Tab */}
          <button
            onClick={() => {
              setActiveTab('daybook');
              setDateFilterMode('specific');
            }}
            className={`px-3.5 py-1.5 rounded-[0.625rem] text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-98 ${
              activeTab === 'daybook'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Till & Day Book
          </button>

          {/* 1. Customer Dues Tab */}
          <button
            onClick={() => setActiveTab('dues')}
            className={`px-3.5 py-1.5 rounded-[0.625rem] text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-98 ${
              activeTab === 'dues'
                ? 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <Clock className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
            Customer Dues ({customerDues.length})
          </button>

          {/* 2. Store Payables Tab */}
          <button
            onClick={() => setActiveTab('payables')}
            className={`px-3.5 py-1.5 rounded-[0.625rem] text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-98 ${
              activeTab === 'payables'
                ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <ArrowUpRight className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            Store Payables ({storePayables.length})
          </button>

          {/* 3. All Transactions Tab */}
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-[0.625rem] text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-98 ${
              activeTab === 'all'
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            All Transactions ({payments.length})
          </button>

          {/* 4. Settled Inflows Tab */}
          <button
            onClick={() => setActiveTab('inflows')}
            className={`px-3.5 py-1.5 rounded-[0.625rem] text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-98 ${
              activeTab === 'inflows'
                ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Settled Inflows ({payments.filter((p) => p.status === 'CONFIRMED' && p.type !== 'OUTFLOW').length})
          </button>

          {/* 5. Credit Ledger Tab */}
          <button
            onClick={() => setActiveTab('credits')}
            className={`px-3.5 py-1.5 rounded-[0.625rem] text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-98 ${
              activeTab === 'credits'
                ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            Credit Ledger ({creditLedgers.length})
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-card/75 px-3 py-1.5 rounded-[0.75rem] border border-input w-full sm:w-72 shadow-2xs">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={
              activeTab === 'daybook'
                ? 'Filter journal entries...'
                : activeTab === 'dues'
                ? 'Search customer dues...'
                : activeTab === 'payables'
                ? 'Search store payables...'
                : 'Search party, invoice, or UTR...'
            }
            className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground w-full focus:outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 0: TILL & DAY BOOK RECONCILIATION JOURNAL                            */}
      {/* ========================================================================= */}
      {activeTab === 'daybook' && (
        <div className="rounded-[1rem] border border-border/60 bg-card/75 backdrop-blur-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-muted/20">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                Chronological Store Journal & Till Ledger ({selectedDate})
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Every cash inflow, digital checkout, customer settlement, and operational payout recorded on this date.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-foreground bg-muted px-3 py-1 rounded-[0.5rem] border border-border/60">
                {combinedDayBookEntries.length} Transactions
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-foreground">
              <thead className="bg-muted/40 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60">
                <tr>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Transaction / Activity</th>
                  <th className="py-3 px-4">Reference & Notes</th>
                  <th className="py-3 px-4">Payment Mode</th>
                  <th className="py-3 px-4 text-right">Amount Flow</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {combinedDayBookEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground text-xs">
                      No cash or digital transactions recorded for {selectedDate}.
                    </td>
                  </tr>
                ) : (
                  combinedDayBookEntries
                    .filter((entry) => {
                      if (!search.trim()) return true;
                      const q = search.toLowerCase();
                      return (
                        entry.title.toLowerCase().includes(q) ||
                        entry.subTitle.toLowerCase().includes(q) ||
                        entry.mode.toLowerCase().includes(q)
                      );
                    })
                    .map((entry) => (
                      <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(entry.timeStr).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-4 font-semibold text-foreground text-xs">
                          {entry.title}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground font-mono">
                          {entry.subTitle}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-md font-medium border ${
                              entry.mode === 'UPI'
                                ? 'bg-primary/10 text-primary border-primary/20'
                                : entry.mode === 'CASH'
                                ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-500/20'
                                : entry.mode === 'BANK_TRANSFER' || entry.mode === 'BANK'
                                ? 'bg-indigo-500/10 text-indigo-800 dark:text-indigo-400 border-indigo-500/20'
                                : entry.mode === 'SPLIT'
                                ? 'bg-purple-500/10 text-purple-800 dark:text-purple-400 border-purple-500/20'
                                : 'bg-muted text-muted-foreground border-border/50'
                            }`}
                          >
                            {entry.mode === 'BANK_TRANSFER' ? 'BANK' : entry.mode}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-xs whitespace-nowrap">
                          <span className={entry.isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                            {entry.isCredit ? '+' : '-'}₹{entry.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <Check className="h-3 w-3" />
                            Settled
                          </span>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: CUSTOMER DUES (RECEIVABLES)                                        */}
      {/* ========================================================================= */}
      {activeTab === 'dues' && (
        <div className="rounded-[1rem] border border-border/60 bg-card/75 backdrop-blur-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-muted/20">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                Customer Dues & Receivables
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Outstanding invoice balances and credit lent to customers awaiting collection.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-rose-800 dark:text-rose-300 bg-rose-500/10 px-3 py-1 rounded-[0.5rem] border border-rose-500/25">
                Pending to Collect: ₹{filteredDues.reduce((s, i) => s + i.remainingDue, 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-foreground">
              <thead className="bg-muted/40 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60">
                <tr>
                  <th className="py-3 px-4">Party / Customer</th>
                  <th className="py-3 px-4">Invoice / Debt Ref</th>
                  <th className="py-3 px-4">Total Billed</th>
                  <th className="py-3 px-4">Remaining Due</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Collect Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-rose-500" />
                        Loading customer dues...
                      </div>
                    </td>
                  </tr>
                ) : filteredDues.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                      All customer dues are fully cleared! Zero pending receivables.
                    </td>
                  </tr>
                ) : (
                  filteredDues.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="py-3.5 px-4 font-medium text-foreground">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-[0.5rem] bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-xs font-bold uppercase">
                            {item.partyName.slice(0, 2)}
                          </div>
                          <div>
                            <span className="font-semibold text-foreground">{item.partyName}</span>
                            {item.partyPhone && (
                              <p className="text-xs text-muted-foreground font-mono">{item.partyPhone}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs">
                        <span className="text-foreground bg-muted px-2 py-0.5 rounded-[0.375rem] border border-border/60">
                          {item.invoiceNo}
                        </span>
                        <div className="text-[0.625rem] text-muted-foreground mt-1">
                          {new Date(item.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">
                        {item.total ? `₹${item.total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-sm text-rose-600 dark:text-rose-400">
                        ₹{item.remainingDue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold bg-rose-500/10 text-rose-800 dark:text-rose-400 border border-rose-500/20">
                          {item.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Button
                          onClick={() => handleOpenActionForPending(item)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-1.5 rounded-[0.625rem] shadow-sm inline-flex items-center gap-1.5 transition-all active:scale-98"
                        >
                          <Banknote className="h-3.5 w-3.5" />
                          Collect Payment
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: STORE PAYABLES (DEBTS WE OWE TO PARTIES/VENDORS)                   */}
      {/* ========================================================================= */}
      {activeTab === 'payables' && (
        <div className="rounded-[1rem] border border-border/60 bg-card/75 backdrop-blur-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-muted/20">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-amber-500" />
                Store Payables (Debts We Owe)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Debts, loans, and supplier credits owed by the store to be disbursed via cash or bank transfer.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-amber-800 dark:text-amber-300 bg-amber-500/10 px-3 py-1 rounded-[0.5rem] border border-amber-500/25">
                Total Store Owed: ₹{filteredPayables.reduce((s, i) => s + i.remainingDue, 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-foreground">
              <thead className="bg-muted/40 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60">
                <tr>
                  <th className="py-3 px-4">Party / Vendor</th>
                  <th className="py-3 px-4">Debt Reference</th>
                  <th className="py-3 px-4">Total Debt</th>
                  <th className="py-3 px-4">Amount We Owe</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Pay Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                        Loading store payables...
                      </div>
                    </td>
                  </tr>
                ) : filteredPayables.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto text-amber-500 mb-2" />
                      Zero store debts pending! All vendor and party credits are cleared.
                    </td>
                  </tr>
                ) : (
                  filteredPayables.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="py-3.5 px-4 font-medium text-foreground">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-[0.5rem] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center text-xs font-bold uppercase">
                            {item.partyName.slice(0, 2)}
                          </div>
                          <div>
                            <span className="font-semibold text-foreground">{item.partyName}</span>
                            {item.partyPhone && (
                              <p className="text-xs text-muted-foreground font-mono">{item.partyPhone}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs">
                        <span className="text-foreground bg-muted px-2 py-0.5 rounded-[0.375rem] border border-border/60">
                          {item.invoiceNo}
                        </span>
                        <div className="text-[0.625rem] text-muted-foreground mt-1">
                          {new Date(item.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">
                        {item.total ? `₹${item.total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-sm text-amber-700 dark:text-amber-400">
                        ₹{item.remainingDue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-500/20">
                          {item.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Button
                          onClick={() => handleOpenActionForPending(item)}
                          className="bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs px-3.5 py-1.5 rounded-[0.625rem] shadow-sm inline-flex items-center gap-1.5 transition-all active:scale-98"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          Pay Party
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2 & 3: ALL TRANSACTIONS / INFLOWS TABLE                               */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'inflows') && (
        <div className="rounded-[1rem] border border-border/60 bg-card/75 backdrop-blur-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-foreground">
              <thead className="bg-muted/40 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Party & Reference</th>
                  <th className="py-3 px-4">Mode / UTR</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Confirmed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted-foreground">
                      Loading transactions...
                    </td>
                  </tr>
                ) : filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted-foreground">
                      No transaction records found.
                    </td>
                  </tr>
                ) : (
                  (activeTab === 'inflows' ? filteredPayments.filter((p) => p.status === 'CONFIRMED') : filteredPayments).map(
                    (payment) => {
                      const partyName = payment.invoice?.party?.name || payment.party?.name || 'Walk-in Customer';
                      const partyPhone = payment.invoice?.party?.phone || payment.party?.phone || '';

                      return (
                        <tr key={payment.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3.5 px-4 text-muted-foreground text-xs">
                            {new Date(payment.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-foreground text-sm">{partyName}</div>
                            <div className="text-xs text-muted-foreground font-mono flex items-center gap-1.5 mt-0.5">
                              {payment.invoice?.invoiceNo && (
                                <span className="bg-muted px-1.5 py-0.2 rounded border border-border/60">
                                  {payment.invoice.invoiceNo}
                                </span>
                              )}
                              {partyPhone && <span>{partyPhone}</span>}
                            </div>
                            {payment.notes && (
                              <div className="text-[0.6875rem] text-muted-foreground mt-1 italic">
                                {payment.notes}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                                  payment.mode === 'UPI'
                                    ? 'bg-primary/10 text-primary border-primary/20'
                                    : payment.mode === 'CASH'
                                    ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20'
                                    : payment.mode === 'BANK_TRANSFER' || payment.mode === 'BANK'
                                    ? 'bg-indigo-500/10 text-indigo-800 dark:text-indigo-400 border border-indigo-500/20'
                                    : payment.mode === 'SPLIT'
                                    ? 'bg-purple-500/10 text-purple-800 dark:text-purple-400 border border-purple-500/20'
                                    : 'bg-muted text-muted-foreground border-border/50'
                                }`}
                              >
                                {payment.mode === 'BANK_TRANSFER' ? 'BANK' : payment.mode}
                              </span>
                              {payment.type === 'OUTFLOW' ? (
                                <span className="px-1.5 py-0.5 rounded text-[0.625rem] font-semibold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20">
                                  Outflow
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[0.625rem] font-semibold bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
                                  Inflow
                                </span>
                              )}
                            </div>
                            {payment.upiUtr && (
                              <div className="text-[0.625rem] text-muted-foreground font-mono mt-1">
                                UTR: {payment.upiUtr}
                              </div>
                            )}
                          </td>

                          {payment.type === 'OUTFLOW' ? (
                            <td className="py-3.5 px-4 font-mono font-bold text-sm text-amber-700 dark:text-amber-400">
                              <div className="flex items-center gap-1">
                                <ArrowUpRight className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                -₹{Number(payment.amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </div>
                              <div className="text-[0.625rem] text-amber-700/80 dark:text-amber-400/80 font-sans font-medium">Store Paid Out</div>
                            </td>
                          ) : (
                            <td className="py-3.5 px-4 font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                              <div className="flex items-center gap-1">
                                <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                +₹{Number(payment.amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </div>
                              <div className="text-[0.625rem] text-emerald-600/80 dark:text-emerald-400/80 font-sans font-medium">Inflow Received</div>
                            </td>
                          )}

                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                payment.status === 'CONFIRMED'
                                  ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-500/20'
                              }`}
                            >
                              {payment.status}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            {payment.status === 'PENDING' ? (
                              <button
                                onClick={() => handleConfirmPendingPayment(payment.id)}
                                className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline px-3 py-1.5 border border-emerald-500/30 rounded-[0.5rem] hover:bg-emerald-500/10 transition-all inline-flex items-center gap-1.5 active:scale-95"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Confirm
                              </button>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {payment.confirmedBy?.name || 'Counter Staff'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CREDIT & DEBTS LEDGER TABLE                                        */}
      {/* ========================================================================= */}
      {activeTab === 'credits' && (
        <div className="rounded-[1rem] border border-border/60 bg-card/75 backdrop-blur-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-foreground">
              <thead className="bg-muted/40 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Party</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Amount Due</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Status & Notes</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredCredits.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground">
                      No credit ledger entries recorded.
                    </td>
                  </tr>
                ) : (
                  filteredCredits.map((cl) => {
                    const isPayable = cl.type === 'PAYABLE';
                    return (
                      <tr key={cl.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4 text-muted-foreground text-xs">
                          {new Date(cl.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-foreground">
                          <div>{cl.party?.name || 'Party'}</div>
                          <div className="text-xs text-muted-foreground font-mono">{cl.party?.phone}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              isPayable
                                ? 'bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-800 dark:text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {isPayable ? 'Credit Taken (We Owe)' : 'Credit Given (Lent)'}
                          </span>
                        </td>

                        <td
                          className={`py-3.5 px-4 font-mono font-bold text-sm ${
                            isPayable ? 'text-amber-700 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          ₹{Number(cl.amountDue).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>

                        <td className="py-3.5 px-4 text-xs text-foreground">
                          {cl.dueDate ? new Date(cl.dueDate).toLocaleDateString('en-IN') : '—'}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold ${
                              cl.status === 'SETTLED'
                                ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-800 dark:text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {cl.status}
                          </span>
                          {cl.notes && <div className="text-xs text-muted-foreground mt-1">{cl.notes}</div>}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          {cl.status !== 'SETTLED' ? (
                            isPayable ? (
                              <Button
                                onClick={() => {
                                  handleOpenActionForPending({
                                    id: cl.id,
                                    invoiceNo: cl.invoice?.invoiceNo || 'Direct Party Credit',
                                    partyId: cl.partyId,
                                    partyName: cl.party?.name || 'Party',
                                    partyPhone: cl.party?.phone || '',
                                    total: Number(cl.amountDue),
                                    paid: 0,
                                    remainingDue: Number(cl.amountDue),
                                    createdAt: cl.createdAt,
                                    status: cl.status,
                                    isCreditLedger: true,
                                    creditType: 'PAYABLE',
                                  });
                                }}
                                className="bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs px-3 py-1 rounded-[0.5rem] shadow-sm inline-flex items-center gap-1 transition-all active:scale-98"
                              >
                                <ArrowUpRight className="h-3 w-3" />
                                Pay Party
                              </Button>
                            ) : (
                              <Button
                                onClick={() => {
                                  handleOpenActionForPending({
                                    id: cl.id,
                                    invoiceNo: cl.invoice?.invoiceNo || 'Direct Customer Credit',
                                    partyId: cl.partyId,
                                    partyName: cl.party?.name || 'Party',
                                    partyPhone: cl.party?.phone || '',
                                    total: Number(cl.amountDue),
                                    paid: 0,
                                    remainingDue: Number(cl.amountDue),
                                    createdAt: cl.createdAt,
                                    status: cl.status,
                                    isCreditLedger: true,
                                    creditType: 'RECEIVABLE',
                                  });
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3 py-1 rounded-[0.5rem] shadow-sm inline-flex items-center gap-1 transition-all active:scale-98"
                              >
                                <Banknote className="h-3 w-3" />
                                Collect
                              </Button>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground font-medium">Settled</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* Settlement Modal (Extracted Component) */}
      <SettlementModal
        isOpen={settlementConfig.isOpen}
        onClose={() => setSettlementConfig((prev) => ({ ...prev, isOpen: false }))}
        onSuccess={loadData}
        parties={parties}
        onPartyCreated={(newParty) => setParties((prev) => [newParty, ...prev])}
        initialDirection={settlementConfig.direction}
        initialPartyId={settlementConfig.partyId}
        initialInvoiceId={settlementConfig.invoiceId}
        initialAmount={settlementConfig.amount}
        initialNotes={settlementConfig.notes}
        initialMode={settlementConfig.mode}
      />

      {/* Credit Ledger Modal (Extracted Component) */}
      <CreditLedgerModal
        isOpen={isCreditModalOpen}
        onClose={() => setIsCreditModalOpen(false)}
        onSuccess={loadData}
        parties={parties}
        defaultPartyId={creditPartyId}
      />
    </div>
  );
}
