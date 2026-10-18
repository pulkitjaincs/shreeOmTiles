'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  X,
  RotateCcw,
  QrCode,
  Loader2,
  CheckCircle2,
  Download,
  Check,
  Plus,
  Trash2,
  FileSpreadsheet,
} from 'lucide-react';
import { ThemedSelect } from '@/components/ui/themed-select';
import { Invoice, RefundInvoiceDetail, Product, Party } from './types';
import { formatINR } from '@/lib/formatters';

interface StandaloneReturnItem {
  id: string;
  isCustom: boolean;
  productId?: string;
  customItemName?: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
}

interface ReturnInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  products?: Product[];
  parties?: Party[];
  onDownloadPdf?: (id: string, invoiceNo: string) => void;
  downloadingId?: string | null;
  onDownloadRefundPdf?: (refundId: string, refundNo: string) => void;
  downloadingRefundId?: string | null;
}

export function ReturnInvoiceModal({
  isOpen,
  onClose,
  onSuccess,
  products = [],
  parties = [],
  onDownloadPdf,
  downloadingId,
  onDownloadRefundPdf,
  downloadingRefundId,
}: ReturnInvoiceModalProps) {
  const [activeTab, setActiveTab] = useState<'RECORDED' | 'STANDALONE'>('RECORDED');

  // Recorded Invoice Return States
  const [returnSearch, setReturnSearch] = useState('');
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnFoundInvoice, setReturnFoundInvoice] = useState<Invoice | null>(null);
  const [returnItemAllocations, setReturnItemAllocations] = useState<
    Record<string, { qty: number; batchNo?: string }>
  >({});
  const [returnRefundMode, setReturnRefundMode] = useState<'CASH' | 'UPI' | 'CARD' | 'CREDIT'>('CASH');
  const [returnReason, setReturnReason] = useState('Customer Return');
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnSuccessMsg, setReturnSuccessMsg] = useState('');
  const [returnErrorMsg, setReturnErrorMsg] = useState('');
  const [lastGeneratedRefund, setLastGeneratedRefund] = useState<{
    id: string;
    refundNo: string;
    totalRefund: number;
    refundMode: string;
    invoiceId: string;
    invoiceNo: string;
    isStandalone?: boolean;
  } | null>(null);

  // Standalone Return States
  const [standalonePartyId, setStandalonePartyId] = useState<string>('');
  const [standaloneCustomerName, setStandaloneCustomerName] = useState<string>('');
  const [standaloneCustomerPhone, setStandaloneCustomerPhone] = useState<string>('');
  const [standaloneRefundMode, setStandaloneRefundMode] = useState<'CASH' | 'UPI' | 'CARD' | 'CREDIT'>('CASH');
  const [standaloneReason, setStandaloneReason] = useState('Legacy / Standalone Bill Return');
  const [standaloneItems, setStandaloneItems] = useState<StandaloneReturnItem[]>([
    {
      id: 'item-1',
      isCustom: false,
      productId: products[0]?.id || '',
      qty: 1,
      unitPrice: products[0]?.price ? Number(products[0].price) : 0,
      taxRate: 18,
    },
  ]);

  if (!isOpen) return null;

  // Handle Recorded Invoice Lookup
  const handleLookupReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnSearch.trim()) return;
    setReturnLoading(true);
    setReturnErrorMsg('');
    setReturnSuccessMsg('');
    setReturnFoundInvoice(null);

    try {
      let query = returnSearch.trim();
      if (query.startsWith('{')) {
        try {
          const parsed = JSON.parse(query);
          query = parsed.inv || parsed.id || query;
        } catch {
          // ignore
        }
      }

      const inv = await apiRequest<Invoice>(`/invoices/lookup/${encodeURIComponent(query)}`);
      setReturnFoundInvoice(inv);

      const initialMap: Record<string, { qty: number; batchNo?: string }> = {};
      inv.items.forEach((item) => {
        initialMap[item.id] = {
          qty: 0,
          batchNo: item.batchNo || undefined,
        };
      });
      setReturnItemAllocations(initialMap);
    } catch (err) {
      setReturnErrorMsg((err as Error).message || 'Invoice not found. Please verify the invoice number.');
    } finally {
      setReturnLoading(false);
    }
  };

  // Handle Recorded Invoice Return Submit
  const handleProcessReturnSubmit = async () => {
    if (!returnFoundInvoice) return;
    setReturnSubmitting(true);
    setReturnErrorMsg('');
    setReturnSuccessMsg('');

    try {
      const itemsToReturn: Array<{
        productId: string;
        batchNo?: string;
        qty: number;
        unitPrice: number;
      }> = [];

      for (const item of returnFoundInvoice.items) {
        const alloc = returnItemAllocations[item.id];
        if (alloc && alloc.qty > 0) {
          itemsToReturn.push({
            productId: item.productId,
            batchNo: alloc.batchNo || item.batchNo || undefined,
            qty: alloc.qty,
            unitPrice: Number(item.unitPrice),
          });
        }
      }

      if (itemsToReturn.length === 0) {
        setReturnErrorMsg('Please specify at least 1 item quantity to return.');
        setReturnSubmitting(false);
        return;
      }

      const res = await apiRequest<{
        success: boolean;
        refundInvoice: RefundInvoiceDetail;
        refundNo: string;
        invoiceNo: string;
        totalRefund: number;
        subtotal: number;
        tax: number;
        refundMode: string;
        restockedItems: string[];
      }>(`/invoices/${returnFoundInvoice.id}/return`, {
        method: 'POST',
        body: JSON.stringify({
          items: itemsToReturn,
          refundMode: returnRefundMode,
          reason: returnReason,
        }),
      });

      setLastGeneratedRefund({
        id: res.refundInvoice.id,
        refundNo: res.refundNo,
        totalRefund: res.totalRefund,
        refundMode: res.refundMode,
        invoiceId: returnFoundInvoice.id,
        invoiceNo: res.invoiceNo || returnFoundInvoice.invoiceNo,
        isStandalone: false,
      });

      setReturnSuccessMsg(
        `✓ Credit Note #${res.refundNo} generated! Rs. ${res.totalRefund.toFixed(2)} refunded via ${returnRefundMode}. Items restocked to inventory.`,
      );
      await onSuccess();
      setReturnFoundInvoice(null);
      setReturnSearch('');
    } catch (err) {
      setReturnErrorMsg((err as Error).message || 'Failed to process return');
    } finally {
      setReturnSubmitting(false);
    }
  };

  // Handle Standalone Return Submit
  const handleProcessStandaloneSubmit = async () => {
    if (standaloneItems.length === 0) {
      setReturnErrorMsg('Please add at least 1 item to return.');
      return;
    }

    for (const it of standaloneItems) {
      if (!it.qty || it.qty <= 0) {
        setReturnErrorMsg('Item quantity must be greater than zero.');
        return;
      }
      if (it.unitPrice === undefined || it.unitPrice < 0) {
        setReturnErrorMsg('Unit price cannot be negative.');
        return;
      }
      if (it.isCustom && !it.customItemName?.trim()) {
        setReturnErrorMsg('Please enter a description for the custom/other item.');
        return;
      }
      if (!it.isCustom && !it.productId) {
        setReturnErrorMsg('Please select a valid catalog product.');
        return;
      }
    }

    setReturnSubmitting(true);
    setReturnErrorMsg('');
    setReturnSuccessMsg('');

    try {
      const payload = {
        partyId: standalonePartyId || undefined,
        customerName: !standalonePartyId ? standaloneCustomerName.trim() || undefined : undefined,
        customerPhone: !standalonePartyId ? standaloneCustomerPhone.trim() || undefined : undefined,
        refundMode: standaloneRefundMode,
        reason: standaloneReason.trim() || undefined,
        items: standaloneItems.map((it) => ({
          productId: it.isCustom ? undefined : it.productId,
          customItemName: it.isCustom ? it.customItemName?.trim() : undefined,
          qty: Number(it.qty),
          unitPrice: Number(it.unitPrice),
          taxRate: Number(it.taxRate ?? 18),
        })),
      };

      const res = await apiRequest<{
        success: boolean;
        refundInvoice: RefundInvoiceDetail;
        refundNo: string;
        totalRefund: number;
        subtotal: number;
        tax: number;
        refundMode: string;
        restockedItems: string[];
      }>('/invoices/returns/standalone', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setLastGeneratedRefund({
        id: res.refundInvoice.id,
        refundNo: res.refundNo,
        totalRefund: res.totalRefund,
        refundMode: res.refundMode,
        invoiceId: res.refundInvoice.id,
        invoiceNo: res.refundNo,
        isStandalone: true,
      });

      setReturnSuccessMsg(
        `✓ Standalone Credit Note #${res.refundNo} generated! Rs. ${res.totalRefund.toFixed(2)} refunded via ${res.refundMode}. Catalog items restocked immediately. (Deliveries not queued)`,
      );
      await onSuccess();
      // Reset standalone items
      setStandaloneItems([
        {
          id: `item-${Date.now()}`,
          isCustom: false,
          productId: products[0]?.id || '',
          qty: 1,
          unitPrice: products[0]?.price ? Number(products[0].price) : 0,
          taxRate: 18,
        },
      ]);
      setStandaloneCustomerName('');
      setStandaloneCustomerPhone('');
    } catch (err: unknown) {
      setReturnErrorMsg((err as Error).message || 'Failed to process standalone return');
    } finally {
      setReturnSubmitting(false);
    }
  };

  const handleClose = () => {
    setReturnFoundInvoice(null);
    setReturnSuccessMsg('');
    setReturnErrorMsg('');
    setReturnSearch('');
    onClose();
  };

  // Helper for Standalone Items
  const addStandaloneItem = () => {
    setStandaloneItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        isCustom: false,
        productId: products[0]?.id || '',
        qty: 1,
        unitPrice: products[0]?.price ? Number(products[0].price) : 0,
        taxRate: 18,
      },
    ]);
  };

  const removeStandaloneItem = (id: string) => {
    if (standaloneItems.length === 1) return;
    setStandaloneItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Calculate standalone total
  const standaloneTotals = standaloneItems.reduce(
    (acc, it) => {
      const lineSubtotal = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
      const lineTax = (lineSubtotal * (Number(it.taxRate) || 0)) / 100;
      return {
        subtotal: acc.subtotal + lineSubtotal,
        tax: acc.tax + lineTax,
        total: acc.total + lineSubtotal + lineTax,
      };
    },
    { subtotal: 0, tax: 0, total: 0 },
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-hidden animate-in fade-in">
      <div className="w-full max-w-3xl rounded-[1.5rem] border border-border bg-card shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-foreground">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-border p-5 sm:p-6">
          <div>
            <h2 className="text-[1.125rem] font-bold text-foreground flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-500" />
              Customer Return & Credit Note
            </h2>
            <p className="text-[0.75rem] text-muted-foreground mt-0.5">
              Accept items back from recorded bills or process standalone returns for legacy/uncataloged products
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="shrink-0 flex border-b border-border bg-muted/30 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('RECORDED');
              setReturnErrorMsg('');
            }}
            className={`pb-3 px-3 text-[0.8125rem] font-semibold transition border-b-2 flex items-center gap-2 ${
              activeTab === 'RECORDED'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <QrCode className="h-4 w-4" />
            <span>Return from Recorded Invoice</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('STANDALONE');
              setReturnErrorMsg('');
            }}
            className={`pb-3 px-3 text-[0.8125rem] font-semibold transition border-b-2 flex items-center gap-2 ${
              activeTab === 'STANDALONE'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Standalone / Legacy Return</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Messages */}
          {returnErrorMsg && (
            <div className="rounded-[0.75rem] bg-rose-500/10 border border-rose-500/30 p-3 text-[0.75rem] text-rose-600 dark:text-rose-400">
              {returnErrorMsg}
            </div>
          )}

          {returnSuccessMsg && (
            <div className="rounded-[1rem] bg-emerald-500/10 border border-emerald-500/30 p-4 text-[0.75rem] text-emerald-700 dark:text-emerald-300 space-y-2.5">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{returnSuccessMsg}</span>
              </div>
              {lastGeneratedRefund && (
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-emerald-500/20">
                  <span className="text-[0.6875rem] text-emerald-600 dark:text-emerald-400">
                    Official Credit Note <strong>#{lastGeneratedRefund.refundNo}</strong> generated.
                  </span>
                  <div className="flex items-center gap-2">
                    {onDownloadRefundPdf && (
                      <button
                        type="button"
                        onClick={() =>
                          onDownloadRefundPdf(lastGeneratedRefund.id, lastGeneratedRefund.refundNo)
                        }
                        disabled={downloadingRefundId === lastGeneratedRefund.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[0.625rem] text-[0.75rem] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition disabled:opacity-50 active:scale-98"
                      >
                        {downloadingRefundId === lastGeneratedRefund.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        <span>Download Credit Note PDF</span>
                      </button>
                    )}
                    {!lastGeneratedRefund.isStandalone && onDownloadPdf && (
                      <button
                        type="button"
                        onClick={() =>
                          onDownloadPdf(lastGeneratedRefund.invoiceId, lastGeneratedRefund.invoiceNo)
                        }
                        disabled={downloadingId === lastGeneratedRefund.invoiceId}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[0.625rem] text-[0.75rem] font-semibold bg-card hover:bg-muted text-foreground border border-border transition disabled:opacity-50 active:scale-98"
                      >
                        <span>Invoice PDF</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: RECORDED INVOICE RETURN                                            */}
          {/* ========================================================================= */}
          {activeTab === 'RECORDED' && (
            <div className="space-y-5">
              {/* Lookup Form */}
              <form onSubmit={handleLookupReturn} className="flex gap-2">
                <div className="relative flex-1">
                  <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Enter Invoice # (e.g. INV-2425-0012) or paste QR string..."
                    value={returnSearch}
                    onChange={(e) => setReturnSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-[0.8125rem] rounded-[0.75rem] border border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-2xs"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={returnLoading}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-[0.75rem] px-4 rounded-[0.75rem] shadow-xs active:scale-98"
                >
                  {returnLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Find Invoice'}
                </Button>
              </form>

              {/* Invoice Return Form */}
              {returnFoundInvoice && (
                <div className="space-y-5 border-t border-border pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/40 rounded-[1rem] border border-border text-[0.75rem]">
                    <div>
                      <span className="font-bold text-foreground font-mono block text-[0.875rem]">
                        {returnFoundInvoice.invoiceNo}
                      </span>
                      <span className="text-muted-foreground text-[0.6875rem]">
                        {returnFoundInvoice.party?.name || (returnFoundInvoice.isCashSale ? 'Cash Sale' : 'Walk-in Customer')}
                        {returnFoundInvoice.party?.phone ? ` • Ph: ${returnFoundInvoice.party.phone}` : ''}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground text-[0.6875rem] block">Original Total:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[0.875rem]">
                        {formatINR(returnFoundInvoice.total)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[0.6875rem] font-semibold text-muted-foreground uppercase tracking-wider block">
                      Select Items to Return
                    </label>

                    <div className="space-y-2">
                      {returnFoundInvoice.items.map((item) => {
                        const alloc = returnItemAllocations[item.id] || { qty: 0 };
                        const maxReturnable =
                          item.remainingReturnable !== undefined
                            ? item.remainingReturnable
                            : item.qty;
                        const lineRefund = (alloc.qty || 0) * Number(item.unitPrice);

                        return (
                          <div
                            key={item.id}
                            className="p-3 rounded-[0.875rem] border border-border bg-background/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[0.75rem]"
                          >
                            <div className="flex-1">
                              <span className="font-semibold text-foreground block">
                                {item.product?.name || item.customItemName || 'Item'}
                              </span>
                              <div className="text-[0.6875rem] text-muted-foreground space-x-1.5 pt-0.5">
                                <span>
                                  Purchased:{' '}
                                  <strong className="text-foreground">
                                    {item.qty} {item.product?.unit || 'unit'}
                                  </strong>
                                </span>
                                {Number(item.returnedQty || 0) > 0 && (
                                  <span className="text-rose-600 dark:text-rose-400 font-medium">
                                    • Returned: {item.returnedQty}
                                  </span>
                                )}
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                  • Available: {maxReturnable}
                                </span>
                                <span>• Rate: {formatINR(item.unitPrice)}</span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2.5">
                              <div>
                                <label className="text-[0.625rem] text-muted-foreground block mb-0.5">
                                  Return Qty:
                                </label>
                                {maxReturnable <= 0 ? (
                                  <span className="inline-block px-2 py-1 rounded bg-muted text-[0.6875rem] font-semibold text-muted-foreground border border-border">
                                    Fully Returned
                                  </span>
                                ) : (
                                  <input
                                    type="number"
                                    min="0"
                                    max={maxReturnable}
                                    value={alloc.qty === 0 ? '' : alloc.qty}
                                    placeholder="0"
                                    onChange={(e) => {
                                      const val = Math.max(
                                        0,
                                        Math.min(maxReturnable, parseInt(e.target.value, 10) || 0),
                                      );
                                      setReturnItemAllocations((prev) => ({
                                        ...prev,
                                        [item.id]: {
                                          ...prev[item.id],
                                          qty: val,
                                        },
                                      }));
                                    }}
                                    className="w-16 rounded-[0.5rem] border border-input bg-background px-2 py-1 text-center font-bold text-foreground text-[0.75rem] focus:border-primary focus:outline-none"
                                  />
                                )}
                              </div>

                              <div className="w-24 text-right">
                                <label className="text-[0.625rem] text-muted-foreground block mb-0.5">Refund:</label>
                                <span className="font-bold text-foreground">{formatINR(lineRefund)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Dynamic Return & GST Summary */}
                    {(() => {
                      let previewSubtotal = 0;
                      returnFoundInvoice.items.forEach((it) => {
                        const alloc = returnItemAllocations[it.id];
                        if (alloc && alloc.qty > 0) {
                          previewSubtotal += alloc.qty * Number(it.unitPrice);
                        }
                      });
                      const previewTax = (previewSubtotal * 18) / 100;
                      const previewTotal = previewSubtotal + previewTax;

                      return (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-[0.875rem] border border-primary/20 bg-primary/5 text-[0.75rem] gap-2">
                          <span className="text-foreground font-medium">
                            Estimated Refund (Items + 18% GST reversal):
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-[0.6875rem] text-muted-foreground">
                              Subtotal: {formatINR(previewSubtotal)} | GST: {formatINR(previewTax)}
                            </span>
                            <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-[0.875rem]">
                              = {formatINR(previewTotal)}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Refund Settlement Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[0.75rem] font-medium text-foreground mb-1">
                        Refund Payout Mode
                      </label>
                      <ThemedSelect
                        value={returnRefundMode}
                        onChange={(val) => setReturnRefundMode(val as 'CASH' | 'UPI' | 'CARD' | 'CREDIT')}
                        options={[
                          { value: 'CASH', label: 'Cash Refund (Counter Settlement)' },
                          { value: 'UPI', label: 'UPI Refund (Direct Bank/QR)' },
                          { value: 'CARD', label: 'Card Refund (POS Reverse)' },
                          { value: 'CREDIT', label: 'Store Credit (Party Ledger Adjustment)' },
                        ]}
                      />
                    </div>

                    <div>
                      <label className="block text-[0.75rem] font-medium text-foreground mb-1">
                        Reason for Return
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Unopened intact boxes"
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                        className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-[0.75rem] text-foreground focus:border-primary focus:outline-none placeholder:text-muted-foreground"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-border">
                    <Button
                      type="button"
                      onClick={() => setReturnFoundInvoice(null)}
                      className="bg-card hover:bg-muted text-foreground border border-border text-[0.75rem]"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleProcessReturnSubmit}
                      disabled={returnSubmitting}
                      className="bg-amber-600 hover:bg-amber-500 text-white font-medium text-[0.75rem] flex items-center gap-2 shadow-xs active:scale-98"
                    >
                      {returnSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Accept Return & Restock Items
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: STANDALONE RETURN (LEGACY BILL / UNRECORDED)                       */}
          {/* ========================================================================= */}
          {activeTab === 'STANDALONE' && (
            <div className="space-y-5">
              <div className="rounded-[1rem] bg-amber-500/10 border border-amber-500/20 p-3.5 text-[0.75rem] text-amber-700 dark:text-amber-300">
                <span className="font-semibold block mb-0.5">Standalone Credit Note Workflow</span>
                Used for returning legacy physical bills or uncataloged items. Catalog products are restocked into inventory automatically. Standalone returns are settled immediately and are never pushed into delivery queues.
              </div>

              {/* Customer / Party Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[0.75rem] font-medium text-foreground mb-1">
                    Party (Optional)
                  </label>
                  <ThemedSelect
                    value={standalonePartyId}
                    onChange={(val) => {
                      setStandalonePartyId(val);
                      if (val) {
                        const p = parties.find((party) => party.id === val);
                        if (p) {
                          setStandaloneCustomerName(p.name);
                          setStandaloneCustomerPhone(p.phone || '');
                        }
                      }
                    }}
                    options={[
                      { value: '', label: 'Walk-in / Custom Customer' },
                      ...parties.map((p) => ({
                        value: p.id,
                        label: `${p.name} (${p.phone})`,
                      })),
                    ]}
                  />
                </div>

                {!standalonePartyId && (
                  <>
                    <div>
                      <label className="block text-[0.75rem] font-medium text-foreground mb-1">
                        Customer Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Ramesh Kumar"
                        value={standaloneCustomerName}
                        onChange={(e) => setStandaloneCustomerName(e.target.value)}
                        className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-[0.75rem] text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[0.75rem] font-medium text-foreground mb-1">
                        Phone (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 9876543210"
                        value={standaloneCustomerPhone}
                        onChange={(e) => setStandaloneCustomerPhone(e.target.value)}
                        className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-[0.75rem] text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Standalone Items Table */}
              <div className="space-y-3">
                <div>
                  <label className="text-[0.6875rem] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Returned Items & Products ({standaloneItems.length})
                  </label>
                </div>

                <div className="space-y-3">
                  {standaloneItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-[1rem] border border-border bg-muted/20 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[0.6875rem] font-bold text-muted-foreground">
                            #{idx + 1}
                          </span>
                          {/* Toggle Catalog vs Custom */}
                          <div className="inline-flex rounded-[0.5rem] bg-muted p-0.5 border border-border text-[0.6875rem]">
                            <button
                              type="button"
                              onClick={() => {
                                setStandaloneItems((prev) =>
                                  prev.map((it) =>
                                    it.id === item.id
                                      ? {
                                          ...it,
                                          isCustom: false,
                                          productId: products[0]?.id || '',
                                          unitPrice: products[0]?.price ? Number(products[0].price) : 0,
                                        }
                                      : it,
                                  ),
                                );
                              }}
                              className={`px-2 py-0.5 rounded-[0.375rem] transition font-medium ${
                                !item.isCustom
                                  ? 'bg-card text-foreground shadow-2xs font-bold'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              Catalog Item
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setStandaloneItems((prev) =>
                                  prev.map((it) =>
                                    it.id === item.id
                                      ? {
                                          ...it,
                                          isCustom: true,
                                          productId: undefined,
                                          customItemName: it.customItemName || 'Other Goods / Tiles',
                                        }
                                      : it,
                                  ),
                                );
                              }}
                              className={`px-2 py-0.5 rounded-[0.375rem] transition font-medium ${
                                item.isCustom
                                  ? 'bg-card text-foreground shadow-2xs font-bold'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              Other / Custom Item
                            </button>
                          </div>
                        </div>

                        {standaloneItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeStandaloneItem(item.id)}
                            className="text-rose-600 hover:text-rose-700 p-1 rounded hover:bg-rose-500/10 transition"
                            title="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Item Inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        <div className="sm:col-span-5">
                          <label className="text-[0.625rem] text-muted-foreground block mb-0.5">
                            {item.isCustom ? 'Item Description' : 'Select Catalog Product'}
                          </label>
                          {item.isCustom ? (
                            <input
                              type="text"
                              placeholder="e.g. Broken Granites / Custom Mosaic"
                              value={item.customItemName || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setStandaloneItems((prev) =>
                                  prev.map((it) =>
                                    it.id === item.id ? { ...it, customItemName: val } : it,
                                  ),
                                );
                              }}
                              className="w-full rounded-[0.5rem] border border-input bg-background px-2.5 py-1.5 text-[0.75rem] text-foreground focus:border-primary focus:outline-none"
                            />
                          ) : (
                            <ThemedSelect
                              value={item.productId || ''}
                              onChange={(val) => {
                                const prod = products.find((p) => p.id === val);
                                setStandaloneItems((prev) =>
                                  prev.map((it) =>
                                    it.id === item.id
                                      ? {
                                          ...it,
                                          productId: val,
                                          unitPrice: prod?.price ? Number(prod.price) : it.unitPrice,
                                        }
                                      : it,
                                  ),
                                );
                              }}
                              options={products.map((p) => ({
                                value: p.id,
                                label: `${p.name} (₹${p.price || 0}/${p.unit || 'unit'})`,
                              }))}
                            />
                          )}
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-[0.625rem] text-muted-foreground block mb-0.5">
                            Qty
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                              setStandaloneItems((prev) =>
                                prev.map((it) => (it.id === item.id ? { ...it, qty: val } : it)),
                              );
                            }}
                            className="w-full rounded-[0.5rem] border border-input bg-background px-2 py-1.5 text-center text-[0.75rem] font-bold text-foreground focus:border-primary focus:outline-none"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-[0.625rem] text-muted-foreground block mb-0.5">
                            Unit Price (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setStandaloneItems((prev) =>
                                prev.map((it) =>
                                  it.id === item.id ? { ...it, unitPrice: val } : it,
                                ),
                              );
                            }}
                            className="w-full rounded-[0.5rem] border border-input bg-background px-2 py-1.5 text-right text-[0.75rem] font-bold text-foreground focus:border-primary focus:outline-none"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-[0.625rem] text-muted-foreground block mb-0.5">
                            GST %
                          </label>
                          <ThemedSelect
                            value={String(item.taxRate)}
                            onChange={(val) => {
                              const rate = parseFloat(val) || 0;
                              setStandaloneItems((prev) =>
                                prev.map((it) =>
                                  it.id === item.id ? { ...it, taxRate: rate } : it,
                                ),
                              );
                            }}
                            options={[
                              { value: '0', label: '0% (Exempt)' },
                              { value: '5', label: '5%' },
                              { value: '12', label: '12%' },
                              { value: '18', label: '18% (Standard)' },
                              { value: '28', label: '28%' },
                            ]}
                          />
                        </div>

                        <div className="sm:col-span-1 flex flex-col justify-end text-right">
                          <span className="text-[0.625rem] text-muted-foreground block mb-0.5">Total</span>
                          <span className="text-[0.75rem] font-bold text-foreground">
                            {formatINR(
                              item.qty * item.unitPrice * (1 + (item.taxRate || 0) / 100),
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Product Button directly below last product */}
                <button
                  type="button"
                  onClick={addStandaloneItem}
                  className="w-full py-2.5 px-3 rounded-[0.75rem] border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-[0.75rem] font-semibold flex items-center justify-center gap-1.5 transition active:scale-[0.99]"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Product / Item</span>
                </button>

                {/* Standalone Financial Breakdown */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-[0.875rem] border border-primary/20 bg-primary/5 text-[0.75rem] gap-2">
                  <span className="text-foreground font-semibold">
                    Total Standalone Credit Note Value:
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-[0.6875rem] text-muted-foreground">
                      Subtotal: {formatINR(standaloneTotals.subtotal)} | GST: {formatINR(standaloneTotals.tax)}
                    </span>
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-[1rem]">
                      = {formatINR(standaloneTotals.total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Settlement Mode and Reason */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[0.75rem] font-medium text-foreground mb-1">
                    Refund Payout Mode
                  </label>
                  <ThemedSelect
                    value={standaloneRefundMode}
                    onChange={(val) => setStandaloneRefundMode(val as 'CASH' | 'UPI' | 'CARD' | 'CREDIT')}
                    options={[
                      { value: 'CASH', label: 'Cash Refund (Immediate Counter Settlement)' },
                      { value: 'UPI', label: 'UPI Refund (Bank Transfer)' },
                      { value: 'CARD', label: 'Card Refund (POS Reverse)' },
                      { value: 'CREDIT', label: 'Party Credit Ledger (Offset future dues)' },
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-[0.75rem] font-medium text-foreground mb-1">
                    Reason / Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Return of legacy bill from previous ledger"
                    value={standaloneReason}
                    onChange={(e) => setStandaloneReason(e.target.value)}
                    className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-[0.75rem] text-foreground focus:border-primary focus:outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <Button
                  type="button"
                  onClick={handleClose}
                  className="bg-card hover:bg-muted text-foreground border border-border text-[0.75rem]"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleProcessStandaloneSubmit}
                  disabled={returnSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[0.75rem] flex items-center gap-2 shadow-xs active:scale-98"
                >
                  {returnSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Generate Standalone Credit Note
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
