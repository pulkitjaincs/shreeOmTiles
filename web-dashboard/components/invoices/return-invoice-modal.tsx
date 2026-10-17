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
  Check
} from 'lucide-react';
import { ThemedSelect } from '@/components/ui/themed-select';
import { Warehouse, Invoice, RefundInvoiceDetail } from './types';
import { formatINR } from '@/lib/formatters';

interface ReturnInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouses?: Warehouse[];
  onSuccess: () => Promise<void> | void;
  onDownloadPdf?: (id: string, invoiceNo: string) => void;
  downloadingId?: string | null;
  onDownloadRefundPdf?: (refundId: string, refundNo: string) => void;
  downloadingRefundId?: string | null;
}

export function ReturnInvoiceModal({
  isOpen,
  onClose,
  warehouses,
  onSuccess,
  onDownloadPdf,
  downloadingId,
  onDownloadRefundPdf,
  downloadingRefundId,
}: ReturnInvoiceModalProps) {
  const [returnSearch, setReturnSearch] = useState('');
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnFoundInvoice, setReturnFoundInvoice] = useState<Invoice | null>(null);
  const [returnItemAllocations, setReturnItemAllocations] = useState<
    Record<string, { qty: number; batchNo?: string }>
  >({});
  const [returnRefundMode, setReturnRefundMode] = useState<'CASH' | 'UPI' | 'CREDIT'>('CASH');
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
  } | null>(null);

  if (!isOpen) return null;

  const handleLookupReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnSearch.trim()) return;
    setReturnLoading(true);
    setReturnErrorMsg('');
    setReturnSuccessMsg('');
    setReturnFoundInvoice(null);

    try {
      let query = returnSearch.trim();
      // If staff scanned QR containing JSON, parse inv or id
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

      // Initialize return allocations directly per item
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
      });

      setReturnSuccessMsg(
        `✓ Credit Note #${res.refundNo} generated! Rs. ${res.totalRefund.toFixed(2)} refunded via ${returnRefundMode}. Items restocked to chosen warehouse/showroom.`,
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

  const handleClose = () => {
    setReturnFoundInvoice(null);
    setReturnSuccessMsg('');
    setReturnErrorMsg('');
    setReturnSearch('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-hidden animate-in fade-in">
      <div className="w-full max-w-2xl rounded-[1.5rem] border border-border bg-card shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-foreground">
        <div className="shrink-0 flex items-center justify-between border-b border-border p-6">
          <div>
            <h2 className="text-[1.125rem] font-bold text-foreground flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-500" />
              Process Customer Return & Restock
            </h2>
            <p className="text-[0.75rem] text-muted-foreground mt-0.5">
              Scan QR code or lookup invoice to accept returns and restock into showroom or warehouse
            </p>
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Lookup Form */}
        <form onSubmit={handleLookupReturn} className="flex gap-2">
          <div className="relative flex-1">
            <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Enter Invoice # (e.g. INV-2425-0012) or scan QR..."
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
                  Official Credit Note <strong>#{lastGeneratedRefund.refundNo}</strong> generated & parent invoice updated.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (onDownloadPdf) {
                      onDownloadPdf(
                        lastGeneratedRefund.invoiceId,
                        lastGeneratedRefund.invoiceNo,
                      );
                    } else {
                      window.open(`/api/invoices/${lastGeneratedRefund.invoiceId}/pdf`, '_blank');
                    }
                  }}
                  disabled={downloadingId === lastGeneratedRefund.invoiceId}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[0.625rem] text-[0.75rem] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition disabled:opacity-50 active:scale-98"
                >
                  {downloadingId === lastGeneratedRefund.invoiceId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  <span>Download Updated Invoice PDF</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Invoice Return Form */}
        {returnFoundInvoice && (
          <div className="space-y-5 border-t border-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/40 rounded-[1rem] border border-border text-[0.75rem]">
              <div>
                <span className="font-bold text-foreground font-mono block text-[0.875rem]">
                  {returnFoundInvoice.invoiceNo}
                </span>
                <span className="text-muted-foreground text-[0.6875rem]">
                  {returnFoundInvoice.party.name} • Ph: {returnFoundInvoice.party.phone}
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
                  const alloc = returnItemAllocations[item.id] || {
                    qty: 0,
                    warehouseId: warehouses?.[0]?.id || '',
                  };
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
                          {item.product?.name || 'Item'}
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
                          <label className="text-[0.625rem] text-muted-foreground block mb-0.5">Return Qty:</label>
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
                          <span className="font-bold text-foreground">
                            {formatINR(lineRefund)}
                          </span>
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
                  onChange={(val) => setReturnRefundMode(val as 'CASH' | 'UPI' | 'CREDIT')}
                  options={[
                    { value: 'CASH', label: 'Cash Refund (Counter Settlement)' },
                    { value: 'UPI', label: 'UPI Refund (Direct Bank)' },
                    { value: 'CREDIT', label: 'Store Credit (Party Ledger Adjustment)' },
                  ]}
                />
              </div>

              <div>
                <label className="block text-[0.75rem] font-medium text-foreground mb-1">
                  Reason for Return (Optional)
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
                {returnSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Accept Return & Restock Items
              </Button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
