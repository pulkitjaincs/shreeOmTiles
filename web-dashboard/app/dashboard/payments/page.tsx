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
  MessageSquare,
  Pencil,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { buildCustomerDuesReminderUrl } from '@/lib/whatsapp';
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
import { TablePagination } from '@/components/ui/table-pagination';
import { InvoiceDetailsDrawer } from '@/components/invoices/invoice-details-drawer';
import { PartyStatementDrawer } from '@/components/parties/party-statement-drawer';
import type { Party as PartyStatementType } from '@/components/parties/types';
import { Invoice } from '@/components/invoices/types';
import { useAuth } from '@/components/auth-provider';

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
      cardIn?: number;
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
  const { user } = useAuth();
  const isSalesman = user?.role === 'SALESMAN';
  const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState('');
  const [editPaymentMode, setEditPaymentMode] = useState('CASH');
  const [editPaymentUtr, setEditPaymentUtr] = useState('');
  const [editPaymentNotes, setEditPaymentNotes] = useState('');
  const [editPaymentSubmitting, setEditPaymentSubmitting] = useState(false);
  const [editPaymentError, setEditPaymentError] = useState('');

  const [deletingPayment, setDeletingPayment] = useState<PaymentRecord | null>(null);
  const [deletingPaymentSubmitting, setDeletingPaymentSubmitting] = useState(false);
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
    cardCollected: 0,
    pendingReceivables: 0,
    creditsOwed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('dues');
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [dateFilterMode, setDateFilterMode] = useState<'all' | 'specific'>('specific');
  const [datePreset, setDatePreset] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM'>('ALL');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [appliedFromDate, setAppliedFromDate] = useState('');
  const [appliedToDate, setAppliedToDate] = useState('');
  const [dayBookData, setDayBookData] = useState<DayBookResponse | null>(null);
  const [dayBookLoading, setDayBookLoading] = useState(false);
  const [isTillOpen, setIsTillOpen] = useState(false);
  const [ownedInvoiceIds, setOwnedInvoiceIds] = useState<Set<string> | null>(null);

  // Modal states
  const [settlementConfig, setSettlementConfig] = useState<SettlementConfig>({
    isOpen: false,
    direction: 'COLLECT',
  });
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [creditPartyId, setCreditPartyId] = useState('');

  // Interconnected Drawers State
  const [statementParty, setStatementParty] = useState<Party | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  const handleOpenParty = useCallback((partyId?: string | null, partyName?: string) => {
    if (!partyId) return;
    const found = parties.find((p) => p.id === partyId);
    if (found) {
      setStatementParty(found);
    } else {
      void apiRequest<Party>(`/parties/${partyId}`)
        .then((fresh) => {
          if (fresh) setStatementParty(fresh);
        })
        .catch(() => {
          if (partyName) {
            setStatementParty({ id: partyId, name: partyName, phone: '' } as Party);
          }
        });
    }
  }, [parties]);

  const handleOpenInvoice = useCallback(async (invoiceIdOrNo?: string | null) => {
    if (!invoiceIdOrNo) return;
    try {
      const inv = await apiRequest<Invoice>(`/invoices/${invoiceIdOrNo}`).catch(() =>
        apiRequest<Invoice>(`/invoices/lookup/${encodeURIComponent(invoiceIdOrNo)}`),
      );
      if (inv) setViewingInvoice(inv);
    } catch (err: unknown) {
      alert('Could not open invoice details: ' + (err as Error).message);
    }
  }, []);

  const handleDownloadInvoicePdf = async (id: string, no: string) => {
    try {
      setDownloadingPdfId(id);
      const blob = await apiRequest<Blob>(`/invoices/${id}/pdf`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${no}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err: unknown) {
      alert('Failed to download invoice PDF: ' + (err as Error).message);
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const handleShareWhatsApp = (inv: Invoice) => {
    const cleanPhone = inv.party?.phone ? inv.party.phone.replace(/\D/g, '').slice(-10) : '';
    const text = `Invoice #${inv.invoiceNo} - Total: Rs. ${Number(inv.total).toFixed(2)}`;
    const url = cleanPhone
      ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

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
      const paymentsParams = new URLSearchParams();
      if (datePreset && datePreset !== 'ALL') {
        if (datePreset === 'CUSTOM') {
          if (appliedFromDate) paymentsParams.set('from', appliedFromDate);
          if (appliedToDate) paymentsParams.set('to', appliedToDate);
        } else {
          paymentsParams.set('preset', datePreset);
        }
      }
      const paymentsQueryStr = paymentsParams.toString();
      const querySuffix = paymentsQueryStr ? `?${paymentsQueryStr}` : '';
      const paymentsUrl = `/payments${querySuffix}`;
      const statsUrl = `/payments/stats${querySuffix}`;
      const pendingUrl = `/payments/pending${querySuffix}`;
      const creditsUrl = `/payments/credits${querySuffix}`;

      const [paymentsData, statsData, pendingData, creditsData, partiesData, invoicesData] = await Promise.all([
        cachedApiRequest<PaymentRecord[]>(paymentsUrl, {
          forceRefresh: force,
          onRevalidate: user?.role === 'SALESMAN' ? undefined : (fresh) => setPayments(fresh),
        }).catch(() => []),
        cachedApiRequest<FinancialStats>(statsUrl, {
          forceRefresh: force,
          onRevalidate: (fresh) => setStats(fresh),
        }).catch(() => ({
          totalSales: 0,
          totalCollected: 0,
          totalPaidOut: 0,
          cashCollected: 0,
          upiCollected: 0,
          bankCollected: 0,
          cardCollected: 0,
          pendingReceivables: 0,
          creditsOwed: 0,
        })),
        cachedApiRequest<{ invoices: PendingItem[]; ledgers: PendingCreditLedger[] }>(pendingUrl, {
          forceRefresh: force,
          onRevalidate:
            user?.role === 'SALESMAN' ? undefined : (fresh) => setPendingItems(formatPendingList(fresh)),
        }).catch(() => ({
          invoices: [],
          ledgers: [],
        })),
        cachedApiRequest<CreditLedgerRecord[]>(creditsUrl, {
          forceRefresh: force,
          onRevalidate: (fresh) => setCreditLedgers(fresh),
        }).catch(() => []),
        cachedApiRequest<Party[]>('/parties', {
          forceRefresh: force,
          onRevalidate: (fresh) => setParties(fresh),
        }).catch(() => []),
        user?.role === 'SALESMAN'
          ? cachedApiRequest<Invoice[]>('/invoices', { forceRefresh: force }).catch(() => [])
          : Promise.resolve(null),
      ]);

      const ownedIds =
        user?.role === 'SALESMAN'
          ? new Set((invoicesData || []).map((invoice) => invoice.id))
          : null;
      setOwnedInvoiceIds(ownedIds);
      setPayments(
        ownedIds === null
          ? paymentsData
          : paymentsData.filter((payment) => Boolean(payment.invoiceId && ownedIds.has(payment.invoiceId))),
      );
      setStats(statsData);
      setCreditLedgers(creditsData);
      setParties(partiesData);
      const formattedPending = formatPendingList(pendingData);
      setPendingItems(
        ownedIds === null
          ? formattedPending
          : formattedPending.filter((item) => !item.isCreditLedger && ownedIds.has(item.id)),
      );
    } catch (err) {
      console.error('Failed to load transactions data:', err);
    } finally {
      setLoading(false);
    }
  }, [formatPendingList, user, datePreset, appliedFromDate, appliedToDate]);

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
    if (!isSalesman && (activeTab === 'daybook' || dateFilterMode === 'specific')) {
      timer = setTimeout(() => {
        void fetchDayBook(selectedDate);
      }, 0);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [selectedDate, activeTab, dateFilterMode, fetchDayBook, isSalesman]);

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

  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const handleSelectPreset = (preset: 'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM') => {
    setDatePreset(preset);
    if (preset === 'TODAY') {
      setSelectedDate(todayStr);
      setDateFilterMode('specific');
      setIsTillOpen(true);
      void fetchDayBook(todayStr);
    } else if (preset === 'YESTERDAY') {
      setSelectedDate(yesterdayStr);
      setDateFilterMode('specific');
      setIsTillOpen(false);
      void fetchDayBook(yesterdayStr);
    } else {
      setIsTillOpen(false);
      if (preset === 'ALL') {
        setDateFilterMode('all');
      }
    }
    if (preset !== 'CUSTOM') {
      setAppliedFromDate('');
      setAppliedToDate('');
    }
  };

  const handleShiftDay = (days: number) => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() + days);
    const newDateStr = cur.toISOString().slice(0, 10);
    setSelectedDate(newDateStr);
    setDateFilterMode('specific');
    if (newDateStr === todayStr) {
      setDatePreset('TODAY');
      setIsTillOpen(true);
    } else if (newDateStr === yesterdayStr) {
      setDatePreset('YESTERDAY');
      setIsTillOpen(false);
    } else {
      setDatePreset('CUSTOM');
      setAppliedFromDate(newDateStr);
      setAppliedToDate(newDateStr);
      setIsTillOpen(false);
    }
    void fetchDayBook(newDateStr);
  };

  const handleToday = () => {
    handleSelectPreset('TODAY');
  };

  const handleYesterday = () => {
    handleSelectPreset('YESTERDAY');
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
    if (isSalesman && isPayable) return;
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
    if (isSalesman) return;
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
    let base = ownedInvoiceIds
      ? payments.filter((payment) => Boolean(payment.invoiceId && ownedInvoiceIds.has(payment.invoiceId)))
      : payments;
    if (activeTab === 'daybook' && dateFilterMode === 'specific' && selectedDate) {
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
  }, [payments, activeTab, dateFilterMode, selectedDate, deferredSearch, ownedInvoiceIds]);

  const filteredCredits = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    const visibleCredits = ownedInvoiceIds
      ? creditLedgers.filter((cl) => Boolean(cl.invoiceId && ownedInvoiceIds.has(cl.invoiceId)))
      : creditLedgers;
    if (!q) return visibleCredits;
    return visibleCredits.filter((cl) => {
      const partyName = cl.party?.name || '';
      const invNo = cl.invoice?.invoiceNo || '';
      const notes = cl.notes || '';
      return partyName.toLowerCase().includes(q) || invNo.toLowerCase().includes(q) || notes.toLowerCase().includes(q);
    });
  }, [creditLedgers, deferredSearch, ownedInvoiceIds]);

  // Pagination
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const filterKey = `${activeTab}_${deferredSearch}_${dateFilterMode}_${selectedDate}_${datePreset}_${appliedFromDate}_${appliedToDate}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setCurrentPage(1);
  }

  const filteredInflows = useMemo(() => {
    return filteredPayments.filter((p) => p.status === 'CONFIRMED');
  }, [filteredPayments]);

  const paginatedDues = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDues.slice(start, start + pageSize);
  }, [filteredDues, currentPage, pageSize]);

  const paginatedPayables = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPayables.slice(start, start + pageSize);
  }, [filteredPayables, currentPage, pageSize]);

  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPayments.slice(start, start + pageSize);
  }, [filteredPayments, currentPage, pageSize]);

  const paginatedInflows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInflows.slice(start, start + pageSize);
  }, [filteredInflows, currentPage, pageSize]);

  const paginatedCredits = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCredits.slice(start, start + pageSize);
  }, [filteredCredits, currentPage, pageSize]);

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

        <div className="flex flex-nowrap items-center gap-1 sm:gap-2">
          <Button
            onClick={handleOpenGeneralCollect}
            className="inline-flex shrink-0 items-center gap-1 sm:gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-2 sm:px-4 py-2 rounded-[0.75rem] text-[0.625rem] sm:text-sm shadow-sm active:scale-98 whitespace-nowrap"
          >
            <Banknote className="h-4 w-4" />
            Collect
          </Button>

          {!isSalesman && (
            <Button
              onClick={handleOpenGeneralPay}
              className="inline-flex shrink-0 items-center gap-1 sm:gap-2 bg-amber-600 hover:bg-amber-500 text-white font-medium px-2 sm:px-3.5 py-2 rounded-[0.75rem] text-[0.625rem] sm:text-sm shadow-sm active:scale-98 whitespace-nowrap"
            >
              <ArrowUpRight className="h-4 w-4" />
              Pay Party
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => {
              setCreditPartyId(parties[0]?.id || '');
              setIsCreditModalOpen(true);
            }}
            className="inline-flex shrink-0 items-center gap-1 sm:gap-2 border-border/60 text-foreground font-medium px-2 sm:px-3.5 py-2 rounded-[0.75rem] text-[0.625rem] sm:text-sm active:scale-98 whitespace-nowrap"
          >
            <CreditCard className="h-4 w-4 text-amber-500" />
            Record Credit / Advance
          </Button>
        </div>
      </div>

      {/* Date-wise Navigation Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card/80 p-2.5 rounded-2xl border border-border/80 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 ml-1 mr-1">
            <Calendar className="h-4 w-4 text-primary" />
            Date Filter:
          </span>

          {(['ALL', 'TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'CUSTOM'] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handleSelectPreset(preset)}
              className={`px-2.5 py-1 rounded-[0.5rem] text-[0.75rem] font-semibold transition ${
                datePreset === preset
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {preset === 'ALL'
                ? 'All Time'
                : preset === 'TODAY'
                ? 'Today'
                : preset === 'YESTERDAY'
                ? 'Yesterday'
                : preset === 'THIS_WEEK'
                ? 'This Week'
                : preset === 'THIS_MONTH'
                ? 'This Month'
                : 'Custom'}
            </button>
          ))}

          {datePreset === 'CUSTOM' && (
            <div className="flex items-center gap-1.5 ml-2">
              <input
                type="date"
                value={customFromDate}
                onChange={(e) => setCustomFromDate(e.target.value)}
                className="rounded-[0.5rem] border border-input bg-background px-2 py-0.5 text-[0.75rem] text-foreground focus:outline-none focus:border-primary"
                title="From date"
              />
              <span className="text-[0.75rem] text-muted-foreground">to</span>
              <input
                type="date"
                value={customToDate}
                onChange={(e) => setCustomToDate(e.target.value)}
                className="rounded-[0.5rem] border border-input bg-background px-2 py-0.5 text-[0.75rem] text-foreground focus:outline-none focus:border-primary"
                title="To date"
              />
              <button
                type="button"
                onClick={() => {
                  if (customFromDate && customToDate) {
                    setAppliedFromDate(customFromDate);
                    setAppliedToDate(customToDate);
                    if (customFromDate === customToDate) {
                      setSelectedDate(customFromDate);
                      setDateFilterMode('specific');
                      setIsTillOpen(customFromDate === todayStr);
                      void fetchDayBook(customFromDate);
                    } else {
                      setIsTillOpen(false);
                    }
                  }
                }}
                disabled={!customFromDate || !customToDate}
                className="px-2.5 py-0.5 rounded-[0.5rem] bg-primary text-primary-foreground text-[0.75rem] font-bold disabled:opacity-50 hover:bg-primary/90 transition shadow-2xs"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {/* Day Book specific day stepper when on daybook tab or single day */}
        {(datePreset === 'TODAY' || datePreset === 'YESTERDAY' || activeTab === 'daybook') && (
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
                setIsTillOpen(e.target.value === todayStr);
                void fetchDayBook(e.target.value);
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
        )}
      </div>

      {/* Daily Till Drawer Summary (Opening Cash, Inflows, Outflows, Expenses, Net Flow & Closing Cash) */}
      {!isSalesman && (
        <div className="rounded-2xl border border-border/80 bg-card/90 shadow-sm overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => setIsTillOpen((prev) => !prev)}
            className="w-full flex items-center justify-between p-3.5 hover:bg-muted/30 transition text-left"
          >
            <div className="flex items-center gap-2.5">
              <BookOpen className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Till Reconciliation & Closing Balance ({selectedDate})
              </h2>
              {dayBookLoading && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1 ml-2">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  Balancing till drawer...
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                Target Cash: ₹{(dayBookData?.summary.closingCash || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
                {isTillOpen ? 'Collapse' : 'Expand Drawer'}
              </span>
              {isTillOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </button>

          {isTillOpen && (
            <div className="p-4 pt-1 border-t border-border/40 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-2">
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
                    UPI: ₹{(dayBookData?.summary.digital.upiIn || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} • Bank: ₹{(dayBookData?.summary.digital.bankIn || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} • Card: ₹{(dayBookData?.summary.digital.cardIn || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Financial KPI Summary Cards (Extracted Component) */}
      {!isSalesman && (
        <PaymentStatsGrid
          stats={stats}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
        />
      )}

      {/* Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          {/* 0. Till & Day Book Tab */}
          {!isSalesman && <button
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
          </button>}

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
          {!isSalesman && <button
            onClick={() => setActiveTab('payables')}
            className={`px-3.5 py-1.5 rounded-[0.625rem] text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-98 ${
              activeTab === 'payables'
                ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <ArrowUpRight className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            Store Payables ({storePayables.length})
          </button>}

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
          {!isSalesman && <button
            onClick={() => setActiveTab('credits')}
            className={`px-3.5 py-1.5 rounded-[0.625rem] text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-98 ${
              activeTab === 'credits'
                ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            Credit Ledger ({creditLedgers.length})
          </button>}
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
      {activeTab === 'daybook' && !isSalesman && (
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
                              entry.mode.toUpperCase() === 'UPI'
                                ? 'bg-primary/10 text-primary border-primary/20'
                                : entry.mode.toUpperCase() === 'CASH'
                                ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-500/20'
                                : entry.mode.toUpperCase() === 'BANK_TRANSFER' || entry.mode.toUpperCase() === 'BANK'
                                ? 'bg-indigo-500/10 text-indigo-800 dark:text-indigo-400 border-indigo-500/20'
                                : entry.mode.toUpperCase() === 'CARD'
                                ? 'bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-500/20'
                                : entry.mode.toUpperCase() === 'SPLIT'
                                ? 'bg-purple-500/10 text-purple-800 dark:text-purple-400 border-purple-500/20'
                                : 'bg-muted text-muted-foreground border-border/50'
                            }`}
                          >
                            {entry.mode.toUpperCase() === 'CARD'
                              ? 'CARD (POS)'
                              : entry.mode.toUpperCase() === 'BANK_TRANSFER' || entry.mode.toUpperCase() === 'BANK'
                              ? 'BANK'
                              : entry.mode}
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
                  paginatedDues.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="py-3.5 px-4 font-medium text-foreground">
                        <div className="flex items-center gap-2.5">
                          {item.partyName.toLowerCase().includes('cash sale') || item.partyName.toLowerCase().includes('walk-in') || !item.partyId ? (
                            <span className="h-8 w-8 rounded-[0.5rem] bg-muted text-muted-foreground border border-border flex items-center justify-center text-xs font-bold uppercase shrink-0">
                              {item.partyName.slice(0, 2)}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenParty(item.partyId, item.partyName)}
                              className="h-8 w-8 rounded-[0.5rem] bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 flex items-center justify-center text-xs font-bold uppercase transition active:scale-95 shrink-0"
                              title="Open Party Ledger Statement"
                            >
                              {item.partyName.slice(0, 2)}
                            </button>
                          )}
                          <div>
                            {item.partyName.toLowerCase().includes('cash sale') || item.partyName.toLowerCase().includes('walk-in') || !item.partyId ? (
                              <span className="font-semibold text-foreground text-left">
                                {item.partyName}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenParty(item.partyId, item.partyName)}
                                className="font-semibold text-foreground hover:text-primary hover:underline text-left transition"
                                title="Open Party Ledger Statement"
                              >
                                {item.partyName}
                              </button>
                            )}
                            {item.partyPhone && (
                              <p className="text-xs text-muted-foreground font-mono">{item.partyPhone}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs">
                        {item.invoiceNo ? (
                          <button
                            type="button"
                            onClick={() => handleOpenInvoice(item.id || item.invoiceNo)}
                            className="text-primary hover:underline font-mono bg-primary/5 hover:bg-primary/10 px-2 py-0.5 rounded-[0.375rem] border border-primary/20 transition inline-block"
                            title="View Full Invoice Details"
                          >
                            {item.invoiceNo}
                          </button>
                        ) : (
                          <span className="text-foreground bg-muted px-2 py-0.5 rounded-[0.375rem] border border-border/60">
                            Direct Credit
                          </span>
                        )}
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

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const url = buildCustomerDuesReminderUrl({
                                phone: item.partyPhone,
                                name: item.partyName,
                                amount: item.remainingDue,
                                invoiceNo: item.invoiceNo,
                              });
                              window.open(url, '_blank');
                            }}
                            title="Send WhatsApp payment reminder"
                            className="h-8 w-8 inline-flex items-center justify-center rounded-[0.5rem] bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-2xs transition active:scale-95"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenActionForPending(item)}
                            className="h-8 px-3 inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-[0.5rem] shadow-2xs transition active:scale-95"
                            title="Collect Payment & Clear Due"
                          >
                            <Banknote className="h-3.5 w-3.5" />
                            <span>Collect</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            currentPage={currentPage}
            totalItems={filteredDues.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: STORE PAYABLES (DEBTS WE OWE TO PARTIES/VENDORS)                   */}
      {/* ========================================================================= */}
      {activeTab === 'payables' && !isSalesman && (
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
                  paginatedPayables.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="py-3.5 px-4 font-medium text-foreground">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleOpenParty(item.partyId, item.partyName)}
                            className="h-8 w-8 rounded-[0.5rem] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center text-xs font-bold uppercase transition active:scale-95 shrink-0"
                            title="Open Party Ledger Statement"
                          >
                            {item.partyName.slice(0, 2)}
                          </button>
                          <div>
                            <button
                              type="button"
                              onClick={() => handleOpenParty(item.partyId, item.partyName)}
                              className="font-semibold text-foreground hover:text-amber-600 dark:hover:text-amber-400 hover:underline text-left transition"
                              title="Open Party Ledger Statement"
                            >
                              {item.partyName}
                            </button>
                            {item.partyPhone && (
                              <p className="text-xs text-muted-foreground font-mono">{item.partyPhone}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs">
                        {item.invoiceNo ? (
                          <button
                            type="button"
                            onClick={() => handleOpenInvoice(item.id || item.invoiceNo)}
                            className="text-amber-700 dark:text-amber-400 hover:underline font-mono bg-amber-500/10 px-2 py-0.5 rounded-[0.375rem] border border-amber-500/20 transition inline-block"
                            title="View Debt / Bill Details"
                          >
                            {item.invoiceNo}
                          </button>
                        ) : (
                          <span className="text-foreground bg-muted px-2 py-0.5 rounded-[0.375rem] border border-border/60">
                            Direct Debt
                          </span>
                        )}
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

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenActionForPending(item)}
                          className="h-8 px-3 inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-[0.5rem] shadow-2xs transition active:scale-95"
                          title="Disburse / Pay Party Debt"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          <span>Pay Party</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            currentPage={currentPage}
            totalItems={filteredPayables.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
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
                  (activeTab === 'inflows' ? paginatedInflows : paginatedPayments).map(
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
                            {payment.invoice?.isCashSale ||
                            (!payment.invoice?.party?.id && !payment.party?.id) ||
                            partyName.toLowerCase().includes('cash sale') ||
                            partyName.toLowerCase().includes('walk-in') ? (
                              <span className="font-semibold text-foreground text-sm">
                                {partyName}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenParty(
                                    payment.invoice?.party?.id || payment.party?.id,
                                    partyName,
                                  )
                                }
                                className="font-semibold text-foreground hover:text-primary hover:underline text-left text-sm transition"
                                title="Open Party Ledger Statement"
                              >
                                {partyName}
                              </button>
                            )}
                            <div className="text-xs text-muted-foreground font-mono flex items-center gap-1.5 mt-0.5">
                              {payment.invoice?.invoiceNo && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenInvoice(
                                      payment.invoice?.id || payment.invoice?.invoiceNo,
                                    )
                                  }
                                  className="bg-muted hover:bg-primary/10 hover:text-primary px-1.5 py-0.2 rounded border border-border/60 transition"
                                  title="Open Invoice Details"
                                >
                                  {payment.invoice.invoiceNo}
                                </button>
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
                                    : payment.mode === 'CARD'
                                    ? 'bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-500/20'
                                    : payment.mode === 'BANK_TRANSFER' || payment.mode === 'BANK'
                                    ? 'bg-indigo-500/10 text-indigo-800 dark:text-indigo-400 border border-indigo-500/20'
                                    : payment.mode === 'SPLIT'
                                    ? 'bg-purple-500/10 text-purple-800 dark:text-purple-400 border border-purple-500/20'
                                    : 'bg-muted text-muted-foreground border-border/50'
                                }`}
                              >
                                {payment.mode === 'CARD' ? 'CARD (POS)' : payment.mode === 'BANK_TRANSFER' ? 'BANK' : payment.mode}
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
                            <div className="flex items-center justify-end gap-1.5">
                              {payment.status === 'PENDING' && (
                                <button
                                  onClick={() => handleConfirmPendingPayment(payment.id)}
                                  className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline px-2.5 py-1 border border-emerald-500/30 rounded-[0.5rem] hover:bg-emerald-500/10 transition-all inline-flex items-center gap-1 active:scale-95"
                                >
                                  <Check className="h-3 w-3" />
                                  Confirm
                                </button>
                              )}

                              {((canManage || (isSalesman && payment.invoiceId && ownedInvoiceIds?.has(payment.invoiceId))) && payment.type !== 'OUTFLOW') && (
                                <button
                                  onClick={() => {
                                    setEditingPayment(payment);
                                    setEditPaymentAmount(String(payment.amount));
                                    setEditPaymentMode(payment.mode);
                                    setEditPaymentUtr(payment.upiUtr || '');
                                    setEditPaymentNotes(payment.notes || '');
                                    setEditPaymentError('');
                                  }}
                                  className="p-1 rounded-[0.4rem] text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition active:scale-95"
                                  title="Edit Payment Details"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              )}

                              {canManage && (
                                <button
                                  onClick={() => setDeletingPayment(payment)}
                                  className="p-1 rounded-[0.4rem] text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition active:scale-95"
                                  title="Delete Payment & Recalculate Balance"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            currentPage={currentPage}
            totalItems={activeTab === 'inflows' ? filteredInflows.length : filteredPayments.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CREDIT & DEBTS LEDGER TABLE                                        */}
      {/* ========================================================================= */}
      {activeTab === 'credits' && !isSalesman && (
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
                  paginatedCredits.map((cl) => {
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

                        <td className="py-3.5 px-4 font-medium text-foreground">
                          <button
                            type="button"
                            onClick={() => handleOpenParty(cl.partyId, cl.party?.name)}
                            className="font-semibold text-foreground hover:text-primary hover:underline text-left transition"
                            title="Open Party Ledger Statement"
                          >
                            {cl.party?.name || 'Party'}
                          </button>
                          <div className="text-xs text-muted-foreground font-mono flex items-center gap-1.5 mt-0.5">
                            {cl.invoice?.invoiceNo && (
                              <button
                                type="button"
                                onClick={() => handleOpenInvoice(cl.invoiceId || cl.invoice?.invoiceNo)}
                                className="bg-muted hover:bg-primary/10 hover:text-primary px-1.5 py-0.2 rounded border border-border/60 transition inline-block"
                                title="Open Invoice Details"
                              >
                                {cl.invoice.invoiceNo}
                              </button>
                            )}
                            {cl.party?.phone && <span>{cl.party.phone}</span>}
                          </div>
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

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {cl.status !== 'SETTLED' ? (
                            isPayable ? (
                              <button
                                type="button"
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
                                className="h-8 px-3 inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-[0.5rem] shadow-2xs transition active:scale-95"
                                title="Pay Party"
                              >
                                <ArrowUpRight className="h-3.5 w-3.5" />
                                <span>Pay</span>
                              </button>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const url = buildCustomerDuesReminderUrl({
                                      phone: cl.party?.phone,
                                      name: cl.party?.name || 'Customer',
                                      amount: Number(cl.amountDue),
                                      invoiceNo: cl.invoice?.invoiceNo,
                                    });
                                    window.open(url, '_blank');
                                  }}
                                  title="Send WhatsApp payment reminder"
                                  className="h-8 w-8 inline-flex items-center justify-center rounded-[0.5rem] bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-2xs transition active:scale-95"
                                >
                                  <MessageSquare className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
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
                                  className="h-8 px-3 inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-[0.5rem] shadow-2xs transition active:scale-95"
                                  title="Collect Payment"
                                >
                                  <Banknote className="h-3.5 w-3.5" />
                                  <span>Collect</span>
                                </button>
                              </div>
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
          <TablePagination
            currentPage={currentPage}
            totalItems={filteredCredits.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
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

      {/* Invoice Details Drawer */}
      <InvoiceDetailsDrawer
        invoice={viewingInvoice}
        onClose={() => setViewingInvoice(null)}
        onShareWhatsApp={handleShareWhatsApp}
        onDownloadPdf={handleDownloadInvoicePdf}
        downloadingId={downloadingPdfId}
        sharingId={null}
        onOpenPartyStatement={(party) => {
          setViewingInvoice(null);
          setStatementParty(party as Party);
        }}
      />

      {/* Party Statement Drawer */}
      <PartyStatementDrawer
        party={statementParty as unknown as PartyStatementType}
        isOpen={Boolean(statementParty)}
        onClose={() => setStatementParty(null)}
        onEdit={() => {}}
      />
    
      {/* Edit Payment Modal */}
      {editingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 text-foreground">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-300">
                  <Pencil className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Edit Received Payment</h3>
                  <p className="text-xs text-muted-foreground">ID: #{editingPayment.id.slice(0, 8)}</p>
                </div>
              </div>
              <button onClick={() => setEditingPayment(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {editPaymentError && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
                {editPaymentError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-foreground mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={editPaymentAmount}
                  onChange={(e) => setEditPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Payment Mode *</label>
                <select
                  value={editPaymentMode}
                  onChange={(e) => setEditPaymentMode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="CASH">CASH</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">CARD (POS)</option>
                  <option value="BANK_TRANSFER">BANK TRANSFER</option>
                </select>
              </div>

              {editPaymentMode !== 'CASH' && (
                <div>
                  <label className="block font-medium text-foreground mb-1">UTR / Reference No.</label>
                  <input
                    type="text"
                    value={editPaymentUtr}
                    onChange={(e) => setEditPaymentUtr(e.target.value)}
                    placeholder="12-digit UTR or Txn ID"
                    className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              <div>
                <label className="block font-medium text-foreground mb-1">Notes</label>
                <textarea
                  value={editPaymentNotes}
                  onChange={(e) => setEditPaymentNotes(e.target.value)}
                  placeholder="Optional remarks"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                disabled={editPaymentSubmitting}
                onClick={() => setEditingPayment(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={editPaymentSubmitting}
                onClick={async () => {
                  if (editPaymentSubmitting) return;
                  const amt = Number(editPaymentAmount);
                  if (!amt || amt <= 0) {
                    setEditPaymentError('Please enter a valid payment amount');
                    return;
                  }
                  setEditPaymentSubmitting(true);
                  try {
                    await apiRequest(`/payments/${editingPayment.id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({
                        amount: amt,
                        mode: editPaymentMode,
                        upiUtr: editPaymentUtr.trim() || undefined,
                        notes: editPaymentNotes.trim() || undefined,
                      }),
                    });
                    setEditingPayment(null);
                    await loadData();
                  } catch (err: any) {
                    setEditPaymentError(err.message || 'Failed to update payment');
                  } finally {
                    setEditPaymentSubmitting(false);
                  }
                }}
              >
                {editPaymentSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Payment Modal */}
      {deletingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 text-foreground">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Delete Payment Entry?</h3>
                <p className="text-xs text-muted-foreground">₹{Number(deletingPayment.amount).toLocaleString('en-IN')} - {deletingPayment.mode}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this payment record? If this payment is linked to an invoice, the invoice paid balance, delivery amount to collect, and customer credit ledger will be automatically recalculated.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={deletingPaymentSubmitting}
                onClick={() => setDeletingPayment(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deletingPaymentSubmitting}
                onClick={async () => {
                  if (deletingPaymentSubmitting) return;
                  setDeletingPaymentSubmitting(true);
                  try {
                    await apiRequest(`/payments/${deletingPayment.id}`, { method: 'DELETE' });
                    setDeletingPayment(null);
                    await loadData();
                  } catch (err: any) {
                    alert(err.message || 'Failed to delete payment');
                  } finally {
                    setDeletingPaymentSubmitting(false);
                  }
                }}
              >
                {deletingPaymentSubmitting ? 'Deleting...' : 'Delete Payment'}
              </Button>
            </div>
          </div>
        </div>
      )}
</div>
  );
}
