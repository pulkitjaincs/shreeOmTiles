'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';
import { apiRequest, cachedApiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Search, 
  Download, 
  X, 
  RotateCcw, 
  CheckCircle2, 
  Eye, 
  Calendar, 
  FileText, 
  Loader2, 
  MessageCircle,
  Trash2,
} from 'lucide-react';
import { ThemedSelect } from '@/components/ui/themed-select';

import {
  Invoice,
  Product,
  Party,
  StockLedgerRecord,
  DatePreset,
  InvoiceStatusFilter,
  PaymentModeFilter,
} from '@/components/invoices/types';

import { CreateInvoiceModal } from '@/components/invoices/create-invoice-modal';
import { ReturnInvoiceModal } from '@/components/invoices/return-invoice-modal';
import { InvoiceDetailsDrawer } from '@/components/invoices/invoice-details-drawer';
import { ShareInvoiceModal } from '@/components/invoices/share-invoice-modal';
import { DeleteInvoiceModal } from '@/components/invoices/delete-invoice-modal';
import { formatINR, formatDate, cleanPhoneNumber } from '@/lib/formatters';

export default function InvoicesPage() {
  const { user } = useAuth();
  const isSalesman = user?.role === 'SALESMAN';
  const isSupervisor = user?.role === 'SUPERVISOR';
  const canDeleteInvoice = !isSupervisor && (user?.role === 'OWNER' || user?.role === 'ADMIN');

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [allStock, setAllStock] = useState<StockLedgerRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('ALL');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>('ALL');
  const [modeFilter, setModeFilter] = useState<PaymentModeFilter>('ALL');

  // Modals & Active State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState<Invoice | null>(null);
  const [createdInvoiceSuccess, setCreatedInvoiceSuccess] = useState<Invoice | null>(null);

  // Loading & Feedback
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [downloadingRefundId, setDownloadingRefundId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadInitialData = useCallback(async (force = false) => {
    try {
      const [invList, prodList, partyList, stockList] = await Promise.all([
        cachedApiRequest<Invoice[]>('/invoices', {
          forceRefresh: force,
          onRevalidate: (fresh) => setInvoices(fresh),
        }).catch(() => []),
        cachedApiRequest<Product[]>('/products', {
          forceRefresh: force,
          onRevalidate: (fresh) => setProducts(fresh),
        }).catch(() => []),
        cachedApiRequest<Party[]>('/parties', {
          forceRefresh: force,
          onRevalidate: (fresh) => setParties(fresh),
        }).catch(() => []),
        cachedApiRequest<StockLedgerRecord[]>('/stock', {
          forceRefresh: force,
          onRevalidate: (fresh) => setAllStock(fresh),
        }).catch(() => []),
      ]);
      setInvoices(invList);
      setProducts(prodList);
      setParties(partyList);
      setAllStock(stockList);
    } catch (err) {
      console.error('Failed to load invoice dependencies', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadInitialData();
    }, 0);
    const handleRefresh = () => {
      loadInitialData(true);
    };
    window.addEventListener('app:refresh-active-page', handleRefresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('app:refresh-active-page', handleRefresh);
    };
  }, [loadInitialData]);

  const refreshStock = async () => {
    const latestStock = await cachedApiRequest<StockLedgerRecord[]>('/stock', { forceRefresh: true }).catch(() => allStock);
    setAllStock(latestStock);
    return latestStock;
  };

  // WhatsApp with generated PDF
  const handleShareOnWhatsAppWithPdf = async (inv: Invoice) => {
    try {
      setSharingId(inv.id);
      const blob = await apiRequest<Blob>(`/invoices/${inv.id}/pdf`);
      const fileName = `Invoice-${inv.invoiceNo}.pdf`;
      const file = new File([blob], fileName, { type: 'application/pdf' });

      const cleanPhone = cleanPhoneNumber(inv.party?.phone);
      const partyName = inv.party?.name || 'Customer';
      const total = Number(inv.total).toLocaleString('en-IN', { maximumFractionDigits: 2 });
      const msg = `Hi ${partyName}, please find attached your Tax Invoice #${inv.invoiceNo} from SHREE OM TILES. Total Amount: Rs. ${total}. Thank you for your business!`;

      const isMobileDevice =
        typeof navigator !== 'undefined' &&
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      if (isMobileDevice && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `Invoice #${inv.invoiceNo}`,
            text: msg,
          });
          setToastMsg(`✓ Invoice #${inv.invoiceNo} PDF shared directly.`);
          setTimeout(() => setToastMsg(null), 4000);
          return;
        } catch (shareErr: unknown) {
          if ((shareErr as Error).name === 'AbortError') return;
        }
      }

      // Desktop / Web: download file and open wa.me
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);

      const targetUrl = cleanPhone
        ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(targetUrl, '_blank', 'noopener,noreferrer');

      setToastMsg(`✓ PDF generated & downloaded (${fileName})! Ready to attach to WhatsApp.`);
      setTimeout(() => setToastMsg(null), 5000);
    } catch (err: unknown) {
      alert('Failed to generate PDF for WhatsApp share: ' + (err as Error).message);
    } finally {
      setSharingId(null);
    }
  };

  // PDF Download
  const handleDownloadPdf = async (invId: string, invNo: string) => {
    try {
      setDownloadingId(invId);
      const blob = await apiRequest<Blob>(`/invoices/${invId}/pdf`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${invNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);

      setToastMsg(`✓ Invoice #${invNo} PDF downloaded successfully.`);
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err: unknown) {
      alert('Failed to download PDF: ' + (err as Error).message);
    } finally {
      setDownloadingId(null);
    }
  };

  // Credit Note / Refund PDF Download
  const handleDownloadRefundPdf = async (refundId: string, refundNo: string) => {
    try {
      setDownloadingRefundId(refundId);
      const blob = await apiRequest<Blob>(`/invoices/refund/${refundId}/pdf`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CreditNote-${refundNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);

      setToastMsg(`✓ Credit Note #${refundNo} PDF downloaded successfully.`);
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err: unknown) {
      alert('Failed to download Credit Note PDF: ' + (err as Error).message);
    } finally {
      setDownloadingRefundId(null);
    }
  };

  const handleOpenInvoiceView = async (inv: Invoice) => {
    setViewingInvoice(inv);
    try {
      const fullInv = await apiRequest<Invoice>(`/invoices/${inv.id}`);
      if (fullInv && fullInv.id === inv.id) {
        setViewingInvoice(fullInv);
      }
    } catch {
      // keep basic inv
    }
  };

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    const cleanSearch = search.toLowerCase().trim();
    const cleanPhoneSearch = search.replace(/\D/g, '');
    const now = new Date();

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);

    const dayOfWeek = now.getDay();
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return invoices.filter((inv) => {
      // Multi-field Search
      if (cleanSearch) {
        const invNo = inv.invoiceNo?.toLowerCase() || '';
        const pName = inv.party?.name?.toLowerCase() || '';
        const pPhone = (inv.party?.phone || '').replace(/\D/g, '');

        const matchesInvNo = invNo.includes(cleanSearch);
        const matchesName = pName.includes(cleanSearch);
        const matchesPhone = cleanPhoneSearch ? pPhone.includes(cleanPhoneSearch) : false;

        if (!matchesInvNo && !matchesName && !matchesPhone) return false;
      }

      // Status
      if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false;

      // Mode
      if (modeFilter !== 'ALL') {
        const matchesDirect = inv.paymentMode === modeFilter;
        const matchesSplit =
          inv.paymentMode === 'SPLIT' &&
          Array.isArray(inv.payments) &&
          inv.payments.some((p) => p.mode === modeFilter);
        if (!matchesDirect && !matchesSplit) return false;
      }

      // Date Presets
      const createdAt = new Date(inv.createdAt);
      if (datePreset === 'TODAY') {
        if (createdAt < startOfToday) return false;
      } else if (datePreset === 'YESTERDAY') {
        if (createdAt < startOfYesterday || createdAt > endOfYesterday) return false;
      } else if (datePreset === 'THIS_WEEK') {
        if (createdAt < startOfWeek) return false;
      } else if (datePreset === 'THIS_MONTH') {
        if (createdAt < startOfMonth) return false;
      } else if (datePreset === 'CUSTOM') {
        if (customFromDate) {
          const from = new Date(customFromDate);
          from.setHours(0, 0, 0, 0);
          if (createdAt < from) return false;
        }
        if (customToDate) {
          const to = new Date(customToDate);
          to.setHours(23, 59, 59, 999);
          if (createdAt > to) return false;
        }
      }

      return true;
    });
  }, [invoices, search, datePreset, customFromDate, customToDate, statusFilter, modeFilter]);

  const hasActiveFilters =
    search.trim() !== '' ||
    datePreset !== 'ALL' ||
    statusFilter !== 'ALL' ||
    modeFilter !== 'ALL' ||
    customFromDate !== '' ||
    customToDate !== '';

  const handleClearFilters = () => {
    setSearch('');
    setDatePreset('ALL');
    setCustomFromDate('');
    setCustomToDate('');
    setStatusFilter('ALL');
    setModeFilter('ALL');
  };

  return (
    <div className="space-y-6 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[1.5rem] font-bold text-foreground tracking-tight">Invoices & Counter Billing</h1>
          <p className="text-[0.8125rem] text-muted-foreground mt-1">
            Instant counter billing, live NPCI UPI QR checkout, QR return & showroom restocking.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!isSalesman && !isSupervisor && (
            <Button
              onClick={() => setShowReturnModal(true)}
              className="flex items-center gap-2 bg-card hover:bg-muted text-foreground border border-border shadow-2xs"
            >
              <RotateCcw className="h-4 w-4 text-amber-500" />
              Process Return / Scan QR
            </Button>
          )}
          {!isSupervisor && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20"
            >
              <Plus className="h-4 w-4" />
              Create New Invoice
            </Button>
          )}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="rounded-[1.25rem] border border-border bg-card/75 p-[clamp(1rem,2vw,1.5rem)] shadow-xs backdrop-blur-xl">
        {/* Search & Filter Controls */}
        <div className="mb-5 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by invoice #, customer name, or 10-digit mobile number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-[0.75rem] border border-input bg-background pl-10 pr-9 py-2 text-[0.8125rem] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Status Dropdown */}
            <div className="w-full sm:w-44">
              <ThemedSelect
                value={statusFilter}
                onChange={(val) => setStatusFilter(val as InvoiceStatusFilter)}
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: 'PAID', label: 'Paid', badge: 'Full' },
                  { value: 'PARTIAL', label: 'Partial', badge: 'Part' },
                  { value: 'CREATED', label: 'Unpaid / Created' },
                ]}
              />
            </div>

            {/* Mode Dropdown */}
            <div className="w-full sm:w-40">
              <ThemedSelect
                value={modeFilter}
                onChange={(val) => setModeFilter(val as PaymentModeFilter)}
                options={[
                  { value: 'ALL', label: 'All Modes' },
                  { value: 'CASH', label: 'Cash' },
                  { value: 'UPI', label: 'UPI' },
                  { value: 'CREDIT', label: 'Credit' },
                  { value: 'SPLIT', label: 'Split Payments' },
                ]}
              />
            </div>
          </div>

          {/* Date Presets Row & Match Summary */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/70">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mr-1">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                Date:
              </span>
              {(['ALL', 'TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'CUSTOM'] as DatePreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDatePreset(preset)}
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
                    : 'Custom Range'}
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
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[0.75rem] text-muted-foreground font-medium">
                Showing <strong className="text-foreground">{filteredInvoices.length}</strong> of {invoices.length} invoices
              </span>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-2.5 py-1 rounded-[0.5rem] bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[0.75rem] font-semibold transition inline-flex items-center gap-1"
                >
                  <X className="h-3 w-3" />
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="overflow-x-auto rounded-[0.875rem] border border-border/70">
          <table className="w-full text-left text-[0.8125rem] text-foreground">
            <thead className="bg-muted/50 text-[0.6875rem] uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="py-3 px-3.5">Invoice #</th>
                <th className="py-3 px-3.5">Customer</th>
                <th className="py-3 px-3.5">Date</th>
                {isSupervisor ? (
                  <th className="py-3 px-3.5">Items</th>
                ) : (
                  <>
                    <th className="py-3 px-3.5">Payment</th>
                    <th className="py-3 px-3.5">Total</th>
                  </>
                )}
                <th className="py-3 px-3.5">Status</th>
                <th className="py-3 px-3.5 text-right">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={isSupervisor ? 6 : 7} className="text-center py-10 text-muted-foreground">
                    Loading invoices...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={isSupervisor ? 6 : 7} className="text-center py-10 text-muted-foreground">
                    No invoices found.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => handleOpenInvoiceView(inv)}
                    className="hover:bg-muted/30 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-3.5 font-mono font-medium text-primary group-hover:text-primary/80">
                      <span className="inline-flex items-center gap-1.5 hover:underline">
                        <FileText className="h-3.5 w-3.5 text-primary/70 group-hover:text-primary" />
                        {inv.invoiceNo}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 font-medium text-foreground">
                      {inv.party?.name || 'Walk-in Customer'}
                      <div className="text-[0.6875rem] text-muted-foreground">{inv.party?.phone}</div>
                    </td>
                    <td className="py-3 px-3.5 text-muted-foreground">
                      {formatDate(inv.createdAt)}
                    </td>
                    {isSupervisor ? (
                      <td className="py-3 px-3.5 text-foreground font-semibold">
                        {inv.items?.length || 0} line items
                      </td>
                    ) : (
                      <>
                        <td className="py-3 px-3.5">
                          {inv.paymentMode === 'SPLIT' ? (
                            <span
                              className="px-2 py-0.5 rounded text-[0.6875rem] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 cursor-help"
                              title={
                                inv.payments && inv.payments.length > 0
                                  ? inv.payments
                                      .map(
                                        (p) =>
                                          `${p.mode}: ₹${Math.round(Number(p.amount)).toLocaleString('en-IN')}`,
                                      )
                                      .join(' | ')
                                  : 'Split Payment'
                              }
                            >
                              Split {inv.payments && inv.payments.length > 0 ? `(${inv.payments.map((p) => p.mode).join('+')})` : ''}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[0.6875rem] font-medium bg-muted text-muted-foreground border border-border">
                              {inv.paymentMode || 'CASH'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 font-bold text-foreground">
                          <div>{formatINR(inv.total)}</div>
                          {inv.refundInvoices && inv.refundInvoices.length > 0 && (
                            <div className="text-[0.625rem] text-rose-600 dark:text-rose-400 font-normal">
                              -{formatINR(inv.refundInvoices.reduce((s, r) => s + Number(r.total || 0), 0))} refunded
                            </div>
                          )}
                        </td>
                      </>
                    )}
                    <td className="py-3 px-3.5">
                      <div className="flex flex-col gap-1 items-start">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[0.6875rem] font-medium ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : inv.status === 'PARTIAL'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-primary/10 text-primary border border-primary/20'
                          }`}
                        >
                          {inv.status}
                        </span>
                        {inv.refundInvoices && inv.refundInvoices.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.625rem] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            Refunded ({inv.refundInvoices.length})
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className="py-3 px-3.5 text-right space-x-2 whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleOpenInvoiceView(inv)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[0.5rem] text-[0.75rem] font-medium text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 shadow-2xs transition"
                        title="View Full Order Details"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View</span>
                      </button>

                      {!isSupervisor && (
                        <>
                          <button
                            onClick={() => handleShareOnWhatsAppWithPdf(inv)}
                            disabled={sharingId === inv.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[0.5rem] text-[0.75rem] font-semibold bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-xs disabled:opacity-50 transition active:scale-95"
                            title="Generate PDF and Share via WhatsApp"
                          >
                            {sharingId === inv.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <MessageCircle className="h-3.5 w-3.5" />
                            )}
                            <span>{sharingId === inv.id ? 'Generating...' : 'WhatsApp'}</span>
                          </button>

                          <button
                            onClick={() => handleDownloadPdf(inv.id, inv.invoiceNo)}
                            disabled={downloadingId === inv.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[0.5rem] text-[0.75rem] font-medium text-foreground bg-card hover:bg-muted border border-border disabled:opacity-50 transition active:scale-95 shadow-2xs"
                            title="Download PDF Invoice"
                          >
                            {downloadingId === inv.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                            ) : (
                              <Download className="h-3.5 w-3.5 text-primary" />
                            )}
                            <span>PDF</span>
                          </button>

                          {canDeleteInvoice && (
                            <button
                              onClick={() => setDeletingInvoice(inv)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[0.5rem] text-[0.75rem] font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 shadow-2xs transition active:scale-95"
                              title="Delete Invoice and Restore Stock"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Delete</span>
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals & Drawers */}
      <CreateInvoiceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={async (createdInvoice) => {
          setShowCreateModal(false);
          await loadInitialData();
          setCreatedInvoiceSuccess(createdInvoice);
        }}
        products={products}
        parties={parties}
        allStock={allStock}
        onRefreshStock={refreshStock}
      />

      <ReturnInvoiceModal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        onSuccess={loadInitialData}
        onDownloadPdf={handleDownloadPdf}
        downloadingId={downloadingId}
        onDownloadRefundPdf={handleDownloadRefundPdf}
        downloadingRefundId={downloadingRefundId}
      />

      <InvoiceDetailsDrawer
        invoice={viewingInvoice}
        onClose={() => setViewingInvoice(null)}
        onShareWhatsApp={handleShareOnWhatsAppWithPdf}
        onDownloadPdf={handleDownloadPdf}
        onDownloadRefundPdf={handleDownloadRefundPdf}
        canDelete={canDeleteInvoice}
        onDelete={(inv) => {
          setViewingInvoice(null);
          setDeletingInvoice(inv);
        }}
        sharingId={sharingId}
        downloadingId={downloadingId}
        downloadingRefundId={downloadingRefundId}
      />

      <DeleteInvoiceModal
        invoice={deletingInvoice}
        isOpen={Boolean(deletingInvoice)}
        onClose={() => setDeletingInvoice(null)}
        onSuccess={async () => {
          setDeletingInvoice(null);
          setToastMsg('Invoice deleted and stock restored successfully.');
          await loadInitialData(true);
        }}
      />

      <ShareInvoiceModal
        invoice={createdInvoiceSuccess}
        onClose={() => setCreatedInvoiceSuccess(null)}
        onShareWhatsApp={handleShareOnWhatsAppWithPdf}
        onDownloadPdf={handleDownloadPdf}
        sharingId={sharingId}
        downloadingId={downloadingId}
      />

      {/* Floating Action Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-card/95 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-[1rem] shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-[0.75rem] font-medium">{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="text-emerald-600 dark:text-emerald-400 hover:text-foreground ml-2">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
