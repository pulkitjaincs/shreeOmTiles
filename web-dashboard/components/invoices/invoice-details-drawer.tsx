'use client';

import { Button } from '@/components/ui/button';
import { 
  X, 
  Download, 
  Loader2, 
  MessageCircle, 
  RotateCcw, 
  Calendar, 
  MapPin, 
  User, 
  Layers,
  Trash2,
  Banknote,
  QrCode,
  Building2,
  Pencil,
  ExternalLink,
} from 'lucide-react';
import { Invoice, Party } from './types';
import { formatINR, formatDateTime, formatDate } from '@/lib/formatters';
import { useAuth } from '@/components/auth-provider';

interface InvoiceDetailsDrawerProps {
  invoice: Invoice | null;
  onClose: () => void;
  onShareWhatsApp: (invoice: Invoice) => void;
  onDownloadPdf: (id: string, no: string) => void;
  onDownloadRefundPdf?: (refundId: string, refundNo: string) => void;
  onDelete?: (invoice: Invoice) => void;
  onEdit?: (invoice: Invoice) => void;
  onOpenPartyStatement?: (party: Party) => void;
  canDelete?: boolean;
  sharingId: string | null;
  downloadingId: string | null;
  downloadingRefundId?: string | null;
}

export function InvoiceDetailsDrawer({
  invoice,
  onClose,
  onShareWhatsApp,
  onDownloadPdf,
  onDownloadRefundPdf,
  onDelete,
  onEdit,
  onOpenPartyStatement,
  canDelete = false,
  sharingId,
  downloadingId,
  downloadingRefundId,
}: InvoiceDetailsDrawerProps) {
  const { user } = useAuth();
  const isSupervisor = user?.role === 'SUPERVISOR';

  if (!invoice) return null;

  const totalRefunded =
    invoice.refundInvoices?.reduce((sum, r) => sum + Number(r.total || 0), 0) || 0;
  const netAdjustedTotal = Math.max(0, Number(invoice.total) - totalRefunded);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in">
      <div className="w-full max-w-4xl rounded-[1.5rem] border border-border bg-card shadow-2xl space-y-6 my-8 max-h-[88dvh] overflow-y-auto p-[clamp(1.25rem,2.5vw,1.75rem)] text-foreground">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[1.25rem] font-extrabold text-foreground tracking-tight">
                {invoice.invoiceNo}
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.6875rem] font-semibold ${
                  invoice.status === 'PAID'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : invoice.status === 'PARTIAL'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                    : 'bg-primary/10 text-primary border border-primary/20'
                }`}
              >
                {invoice.status}
              </span>
              {!isSupervisor && (
                <span className="px-2 py-0.5 rounded text-[0.6875rem] font-mono font-medium bg-muted text-muted-foreground border border-border">
                  Mode: {invoice.paymentMode || 'CASH'}
                </span>
              )}
              {invoice.refundInvoices && invoice.refundInvoices.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-[0.6875rem] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  Refunded ({invoice.refundInvoices.length} Credit Note{invoice.refundInvoices.length > 1 ? 's' : ''})
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-[0.75rem] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {formatDateTime(invoice.createdAt)}
              </span>
              {invoice.salesman?.name && (
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Billed by: <strong className="text-foreground">{invoice.salesman.name}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            {!isSupervisor && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(invoice)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[0.625rem] text-[0.75rem] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 transition shadow-2xs active:scale-98"
                title="Edit bill details, quantities, pricing, address"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Edit Bill</span>
              </button>
            )}

            {!isSupervisor && (
              <>
                <button
                  onClick={() => onShareWhatsApp(invoice)}
                  disabled={sharingId === invoice.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[0.625rem] text-[0.75rem] font-semibold bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-2xs disabled:opacity-50 transition active:scale-95"
                  title="Share invoice on WhatsApp"
                >
                  {sharingId === invoice.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <MessageCircle className="h-3.5 w-3.5" />
                  )}
                  <span>{sharingId === invoice.id ? 'Generating...' : 'Share on WhatsApp'}</span>
                </button>

                <button
                  onClick={() => onDownloadPdf(invoice.id, invoice.invoiceNo)}
                  disabled={downloadingId === invoice.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[0.625rem] text-[0.75rem] font-medium text-foreground bg-card hover:bg-muted border border-border disabled:opacity-50 transition shadow-2xs active:scale-98"
                  title="Download PDF Invoice"
                >
                  {downloadingId === invoice.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  ) : (
                    <Download className="h-3.5 w-3.5 text-primary" />
                  )}
                  <span>Download PDF</span>
                </button>
              </>
            )}

            {!isSupervisor && canDelete && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(invoice)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[0.625rem] text-[0.75rem] font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition shadow-2xs active:scale-98"
                title="Delete invoice, cancel deliveries & restore stock"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-[0.5rem] transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Info Cards (Customer & Dispatch Details) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Customer */}
          <div className="rounded-[1rem] border border-border bg-muted/30 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[0.6875rem] font-semibold text-muted-foreground uppercase tracking-wider block">
                Customer / Billed To
              </span>
              {invoice.isCashSale && (
                <span className="text-[0.625rem] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                  Cash Sale (Pickup)
                </span>
              )}
            </div>
            {invoice.party && onOpenPartyStatement ? (
              <button
                type="button"
                onClick={() => onOpenPartyStatement(invoice.party)}
                className="text-[0.875rem] font-bold text-primary hover:underline text-left inline-flex items-center gap-1 group"
                title="View Party Ledger & Statement"
              >
                <span>{invoice.party.name}</span>
                <ExternalLink className="h-3 w-3 opacity-70 group-hover:opacity-100 transition-opacity" />
              </button>
            ) : (
              <p className="text-[0.875rem] font-bold text-foreground">
                {invoice.party?.name || (invoice.isCashSale ? 'Cash Sale' : 'Walk-in Customer')}
              </p>
            )}
            <p className="text-[0.75rem] text-muted-foreground font-mono">
              {invoice.party?.phone || 'No phone provided'}
            </p>
            {(invoice.address || invoice.party?.address) && (
              <div className="text-[0.75rem] text-muted-foreground flex items-start gap-1 pt-1">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground/80">
                    {invoice.address ? 'Bill / Delivery Address: ' : 'Address: '}
                  </span>
                  <span>{invoice.address || invoice.party?.address}</span>
                </div>
              </div>
            )}
            {Number(invoice.previousBalance || 0) > 0 && (
              <div className="mt-2 pt-2 border-t border-border/60 text-[0.6875rem] text-amber-600 dark:text-amber-400 font-medium flex items-center justify-between">
                <span>Prior Balance Context:</span>
                <span className="font-mono font-bold">{formatINR(Number(invoice.previousBalance))}</span>
              </div>
            )}
          </div>

          {/* Order & Billing Info */}
          <div className="rounded-[1rem] border border-border bg-muted/30 p-3.5 space-y-1.5">
            <span className="text-[0.6875rem] font-semibold text-muted-foreground uppercase tracking-wider block">
              Billing Details
            </span>
            <div className="text-[0.75rem] space-y-1">
              {!isSupervisor && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Payment Mode:</span>
                  <span className="font-semibold text-foreground">
                    {invoice.paymentMode === 'SPLIT' && invoice.payments && invoice.payments.length > 1
                      ? `Split (${invoice.payments.map((p) => p.mode).join(' + ')})`
                      : invoice.paymentMode || 'CREDIT'}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{invoice.status}</span>
              </div>
              {!isSupervisor && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax Percentage:</span>
                  <span className="font-bold text-foreground font-mono">
                    {(invoice.taxBreakup as { rate?: number })?.rate ??
                      (Number(invoice.subtotal) > 0
                        ? Math.round((Number(invoice.tax) / Number(invoice.subtotal)) * 100)
                        : 18)}%
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Line Items:</span>
                <span className="font-semibold text-foreground">{invoice.items?.length || 0} items</span>
              </div>
              {invoice.notes && (
                <div className="pt-1 text-[0.6875rem] text-amber-700 dark:text-amber-300 italic">
                  Note: {invoice.notes}
                </div>
              )}
            </div>
          </div>

          {/* Financial Snapshot / Supervisor Goods Snapshot */}
          {isSupervisor ? (
            <div className="rounded-[1rem] border border-purple-500/30 bg-purple-500/5 p-3.5 space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-[0.6875rem] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">
                  Order Dispatch Overview
                </span>
                <div className="text-[1.5rem] font-black text-foreground tracking-tight mt-1">
                  {invoice.items?.reduce((sum, it) => sum + Number(it.qty || 0), 0) || 0} Units
                </div>
              </div>
              <div className="text-[0.75rem] space-y-1 pt-2 border-t border-border text-foreground">
                <div className="flex justify-between text-[0.6875rem]">
                  <span className="text-muted-foreground">Unique Items:</span>
                  <span className="font-semibold">{invoice.items?.length || 0} products</span>
                </div>
              </div>
            </div>
          ) : (
            <div
              className={`rounded-[1rem] border p-3.5 space-y-1.5 flex flex-col justify-between ${
                totalRefunded > 0
                  ? 'border-rose-500/30 bg-rose-500/5'
                  : 'border-primary/30 bg-primary/5'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[0.6875rem] font-semibold text-primary uppercase tracking-wider block">
                    Net Payable Total
                  </span>
                  {totalRefunded > 0 && (
                    <span className="text-[0.625rem] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                      Refunds Deducted
                    </span>
                  )}
                </div>
                <div className="text-[1.5rem] font-black text-foreground tracking-tight mt-1">
                  {formatINR(netAdjustedTotal)}
                </div>
              </div>
              <div className="text-[0.75rem] space-y-1 pt-2 border-t border-border text-foreground">
                <div className="flex justify-between text-[0.6875rem]">
                  <span className="text-muted-foreground">Original Total:</span>
                  <span>{formatINR(invoice.total)}</span>
                </div>
                {totalRefunded > 0 && (
                  <div className="flex justify-between text-[0.6875rem] font-semibold text-rose-600 dark:text-rose-400">
                    <span>Total Refunded:</span>
                    <span>-{formatINR(totalRefunded)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[0.6875rem]">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>{formatINR(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between text-[0.6875rem]">
                  <span className="text-muted-foreground">
                    Tax (
                    {(invoice.taxBreakup as { rate?: number })?.rate ??
                      (Number(invoice.subtotal) > 0
                        ? Math.round((Number(invoice.tax) / Number(invoice.subtotal)) * 100)
                        : 18)}
                    %):
                  </span>
                  <span className="font-semibold text-foreground">{formatINR(invoice.tax)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Line Items Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[0.75rem] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-primary" />
              Order Items ({invoice.items?.length || 0})
            </h3>
          </div>

          <div className="rounded-[0.875rem] border border-border overflow-hidden bg-background/50">
            <table className="w-full text-left text-[0.75rem]">
              <thead className="bg-muted/50 text-muted-foreground uppercase tracking-wider border-b border-border text-[0.6875rem]">
                <tr>
                  <th className="py-2.5 px-3 text-center w-10">#</th>
                  <th className="py-2.5 px-3">Item / Product</th>
                  <th className="py-2.5 px-3 text-right">Quantity</th>
                  {!isSupervisor && (
                    <>
                      <th className="py-2.5 px-3 text-right">Rate</th>
                      <th className="py-2.5 px-3 text-right">Discount</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {!invoice.items || invoice.items.length === 0 ? (
                  <tr>
                    <td colSpan={isSupervisor ? 3 : 6} className="py-6 text-center text-muted-foreground">
                      No line items found for this invoice.
                    </td>
                  </tr>
                ) : (
                  invoice.items.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 text-center font-mono text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-foreground">
                        {item.product?.name || 'Item'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-foreground">
                        {item.qty} <span className="font-normal text-muted-foreground text-[0.6875rem]">{item.product?.unit || ''}</span>
                      </td>
                      {!isSupervisor && (
                        <>
                          <td className="py-2.5 px-3 text-right text-foreground">
                            {formatINR(item.unitPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-muted-foreground">
                            {Number(item.discount) > 0 ? formatINR(item.discount) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {formatINR(item.total)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-muted/40 border-t border-border font-semibold text-[0.75rem]">
                <tr>
                  <td colSpan={4} className="py-2.5 px-3 text-right text-muted-foreground uppercase tracking-wider text-[0.6875rem]">
                    Total Quantity:
                  </td>
                  <td className="py-2.5 px-3 text-right text-foreground font-bold">
                    {invoice.items?.reduce((acc, it) => acc + Number(it.qty || 0), 0) || 0}
                  </td>
                  {!isSupervisor && (
                    <>
                      <td colSpan={2} className="py-2.5 px-3 text-right text-muted-foreground">
                        Subtotal: {formatINR(invoice.subtotal)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                        {formatINR(invoice.total)}
                      </td>
                    </>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* PAYMENT BREAKDOWN & RECEIPTS */}
        {!isSupervisor && invoice.payments && invoice.payments.length > 0 && (
          <div className="space-y-2 pt-2">
            <h3 className="text-[0.75rem] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Banknote className="h-4 w-4 text-emerald-500" />
              Payment Receipts & Settlement ({invoice.payments.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {invoice.payments.map((p, pIdx) => (
                <div
                  key={p.id || pIdx}
                  className="rounded-[0.75rem] border border-border bg-card p-3 flex items-center justify-between shadow-2xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-[0.5rem] bg-primary/10 text-primary">
                      {p.mode === 'UPI' ? (
                        <QrCode className="h-4 w-4" />
                      ) : p.mode === 'CASH' ? (
                        <Banknote className="h-4 w-4" />
                      ) : (
                        <Building2 className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <div className="text-[0.8125rem] font-semibold text-foreground">
                        {p.mode}
                      </div>
                      <div className="text-[0.6875rem] text-muted-foreground">
                        {p.paidAt ? formatDateTime(p.paidAt) : 'Confirmed'}
                        {p.upiUtr ? ` • UTR: ${p.upiUtr}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-mono font-bold text-[0.875rem] text-emerald-600 dark:text-emerald-400">
                    {formatINR(p.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ATTACHED REFUND INVOICES / CREDIT NOTES SECTION */}
        {invoice.refundInvoices && invoice.refundInvoices.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[0.75rem] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-300 flex items-center gap-1.5">
                <RotateCcw className="h-4 w-4 text-rose-500" />
                Attached Refund Invoices / Credit Notes ({invoice.refundInvoices.length})
              </h3>
              <span className="text-[0.6875rem] text-muted-foreground">
                Official GST credit notes & restocked items
              </span>
            </div>

            <div className="space-y-3">
              {invoice.refundInvoices.map((refund) => (
                <div
                  key={refund.id}
                  className="rounded-[1rem] border border-rose-500/20 bg-rose-500/5 p-4 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-2.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-[0.875rem] font-bold text-rose-600 dark:text-rose-400">
                        {refund.refundNo}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[0.625rem] font-medium bg-muted text-foreground border border-border">
                        Mode: {refund.refundMode}
                      </span>
                      <span className="text-[0.75rem] text-muted-foreground">
                        {formatDate(refund.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {!isSupervisor && (
                        <>
                          <span className="text-[0.75rem] font-bold text-rose-700 dark:text-rose-300">
                            Refund Amount: {formatINR(refund.total)}
                          </span>
                          <button
                            type="button"
                            onClick={() => onDownloadPdf(invoice.id, invoice.invoiceNo)}
                            disabled={downloadingId === invoice.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[0.5rem] text-[0.75rem] font-medium text-primary hover:bg-primary/10 border border-primary/20 shadow-2xs transition disabled:opacity-50 active:scale-98"
                            title="Download Updated Invoice PDF"
                          >
                            {downloadingId === invoice.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                            <span>Updated Invoice PDF</span>
                          </button>
                          {onDownloadRefundPdf && (
                            <button
                              type="button"
                              onClick={() => onDownloadRefundPdf(refund.id, refund.refundNo)}
                              disabled={downloadingRefundId === refund.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[0.5rem] text-[0.75rem] font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 shadow-2xs transition disabled:opacity-50 active:scale-98"
                              title="Download Credit Note (Refund) PDF"
                            >
                              {downloadingRefundId === refund.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                              <span>Credit Note PDF</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {refund.reason && (
                    <div className="text-[0.75rem] text-muted-foreground italic">
                      Reason: <span className="text-foreground">{refund.reason}</span>
                      {refund.createdBy?.name && (
                        <span className="ml-2 font-normal not-italic text-muted-foreground">
                          • Processed by {refund.createdBy.name}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Items in this refund */}
                  {refund.items && refund.items.length > 0 && (
                    <div className="rounded-[0.75rem] border border-border overflow-hidden bg-background/60">
                      <table className="w-full text-left text-[0.6875rem]">
                        <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                          <tr>
                            <th className="py-2 px-3">Returned Item</th>
                            <th className="py-2 px-3 text-right">Qty</th>
                            {!isSupervisor && (
                              <>
                                <th className="py-2 px-3 text-right">Rate</th>
                                <th className="py-2 px-3 text-right">Refund Total</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {refund.items.map((rItem, rIdx) => (
                            <tr key={rItem.id || rIdx} className="text-foreground">
                              <td className="py-2 px-3 font-medium text-foreground">
                                {rItem.product?.name || 'Item'}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-rose-600 dark:text-rose-400">
                                {rItem.qty} {rItem.product?.unit || ''}
                              </td>
                              {!isSupervisor && (
                                <>
                                  <td className="py-2 px-3 text-right">
                                    {formatINR(rItem.unitPrice)}
                                  </td>
                                  <td className="py-2 px-3 text-right font-bold text-rose-600 dark:text-rose-400">
                                    {formatINR(rItem.total)}
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Close Button */}
        <div className="flex items-center justify-end pt-3 border-t border-border gap-3">
          <Button
            type="button"
            onClick={onClose}
            className="bg-card hover:bg-muted text-foreground border border-border text-[0.75rem] px-4"
          >
            Close View
          </Button>
        </div>
      </div>
    </div>
  );
}
