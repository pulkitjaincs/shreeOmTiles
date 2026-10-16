'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
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
  RefreshCw,
} from 'lucide-react';
import { startTopReload } from '@/components/top-reload-bar';
import { PaymentStatsGrid } from '@/components/payments/payment-stats-grid';
import { 
  PendingItem, 
  PaymentRecord, 
  CreditLedgerRecord, 
  Party, 
  FinancialStats,
  PendingCreditLedger 
} from '@/components/payments/types';

const SettlementModal = dynamic(
  () => import('@/components/payments/settlement-modal').then((mod) => mod.SettlementModal),
  { ssr: false }
);

const CreditLedgerModal = dynamic(
  () => import('@/components/payments/credit-ledger-modal').then((mod) => mod.CreditLedgerModal),
  { ssr: false }
);

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
    pendingReceivables: 0,
    creditsOwed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'dues' | 'payables' | 'all' | 'inflows' | 'credits'>('dues');

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
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  // Filters for tables (Separated Dues vs Payables)
  const customerDues = pendingItems.filter((item) => item.creditType === 'RECEIVABLE');
  const storePayables = pendingItems.filter((item) => item.creditType === 'PAYABLE');

  const filteredDues = customerDues.filter(
    (item) =>
      item.partyName.toLowerCase().includes(search.toLowerCase()) ||
      item.partyPhone.includes(search) ||
      (item.invoiceNo && item.invoiceNo.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredPayables = storePayables.filter(
    (item) =>
      item.partyName.toLowerCase().includes(search.toLowerCase()) ||
      item.partyPhone.includes(search) ||
      (item.invoiceNo && item.invoiceNo.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredPayments = payments.filter((p) => {
    const partyName = p.invoice?.party?.name || p.party?.name || '';
    const invNo = p.invoice?.invoiceNo || '';
    const utr = p.upiUtr || '';
    const q = search.toLowerCase();
    return partyName.toLowerCase().includes(q) || invNo.toLowerCase().includes(q) || utr.toLowerCase().includes(q);
  });

  const filteredCredits = creditLedgers.filter((cl) => {
    const partyName = cl.party?.name || '';
    const invNo = cl.invoice?.invoiceNo || '';
    const notes = cl.notes || '';
    const q = search.toLowerCase();
    return partyName.toLowerCase().includes(q) || invNo.toLowerCase().includes(q) || notes.toLowerCase().includes(q);
  });

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
          <button
            type="button"
            onClick={() => {
              startTopReload();
              loadData(true);
            }}
            disabled={loading}
            title="Refresh transactions, dues, and stats"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[0.75rem] border border-border/80 bg-card hover:bg-muted text-xs font-semibold text-foreground transition shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>

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

      {/* Financial KPI Summary Cards (Extracted Component) */}
      <PaymentStatsGrid
        stats={stats}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
      />

      {/* Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto">
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
              activeTab === 'dues'
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
                                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                  payment.mode === 'UPI'
                                    ? 'bg-primary/10 text-primary border border-primary/20'
                                    : 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20'
                                }`}
                              >
                                {payment.mode}
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
