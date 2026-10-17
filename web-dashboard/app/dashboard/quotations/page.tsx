'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiRequest, cachedApiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Plus, 
  Search, 
  Download, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  X,
  Eye,
  Loader2,
  Calendar,
  Share2
} from 'lucide-react';
import { Product, Party } from '@/components/invoices/types';
import { CreateQuotationModal } from '@/components/quotations/create-quotation-modal';
import { MultiPaymentSplitSelector, SplitRow } from '@/components/shared/multi-payment-split-selector';
import { formatINR, formatDate } from '@/lib/formatters';

interface QuotationItem {
  id: string;
  productId: string;
  qty: number;
  unitPrice: number;
  discount: number;
  total: number;
  product?: { name: string; unit: string };
}

interface QuotationRecord {
  id: string;
  quotationNo: string;
  party?: Party;
  partyId?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  subtotal: number;
  tax: number;
  taxRate?: number;
  transportCost?: number;
  transportGstRate?: number;
  total: number;
  status: string;
  validUntil?: string;
  notes?: string;
  createdAt: string;
  items: QuotationItem[];
}

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingQuotation, setViewingQuotation] = useState<QuotationRecord | null>(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  // Conversion Confirmation Dialog State
  const [convertTarget, setConvertTarget] = useState<QuotationRecord | null>(null);
  const [convertSplits, setConvertSplits] = useState<SplitRow[]>([{ mode: 'CASH', amount: '0' }]);
  const [convertSubmitting, setConvertSubmitting] = useState(false);
  const [convertError, setConvertError] = useState('');

  const loadData = useCallback(async (force = false) => {
    try {
      const [quoteRes, prodList, partyList] = await Promise.all([
        cachedApiRequest<{ data: QuotationRecord[] } | QuotationRecord[]>('/quotations', {
          forceRefresh: force,
          onRevalidate: (fresh) => {
            const list = Array.isArray(fresh)
              ? fresh
              : (fresh as { data?: QuotationRecord[] })?.data || [];
            setQuotations(list);
          },
        }).catch(() => []),
        cachedApiRequest<Product[]>('/products', {
          forceRefresh: force,
          onRevalidate: (fresh) => setProducts(fresh),
        }).catch(() => []),
        cachedApiRequest<Party[]>('/parties', {
          forceRefresh: force,
          onRevalidate: (fresh) => setParties(fresh),
        }).catch(() => []),
      ]);

      const list = Array.isArray(quoteRes)
        ? quoteRes
        : (quoteRes as { data?: QuotationRecord[] })?.data || [];
      setQuotations(list);
      setProducts(prodList);
      setParties(partyList);
    } catch (err) {
      console.error('Failed to load quotations data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData(true);
    window.addEventListener('app:refresh-active-page', handleRefresh);
    return () => window.removeEventListener('app:refresh-active-page', handleRefresh);
  }, [loadData]);

  const filteredQuotes = useMemo(() => {
    return quotations.filter((q) => {
      if (statusFilter !== 'ALL' && q.status !== statusFilter) return false;
      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const qNo = q.quotationNo?.toLowerCase() || '';
        const cName = (q.party?.name || q.customerName || '').toLowerCase();
        const cPhone = q.party?.phone || q.customerPhone || '';
        return qNo.includes(query) || cName.includes(query) || cPhone.includes(query);
      }
      return true;
    });
  }, [quotations, search, statusFilter]);

  const handleDownloadPdf = async (quote: QuotationRecord) => {
    setDownloadingPdfId(quote.id);
    try {
      const blob = await apiRequest<Blob>(`/quotations/${quote.id}/pdf`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Estimate-${quote.quotationNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to download quotation PDF');
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const handleExecuteConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertTarget) return;

    const validSplits = convertSplits.filter((s) => {
      const p = parseFloat(s.amount);
      return !isNaN(p) && p > 0;
    });
    const totalPaid = validSplits.reduce((acc, s) => acc + parseFloat(s.amount), 0);
    const resolvedMode =
      validSplits.length > 1
        ? 'SPLIT'
        : validSplits.length === 1
        ? validSplits[0].mode
        : 'CREDIT';

    setConvertSubmitting(true);
    setConvertError('');

    try {
      await apiRequest(`/quotations/${convertTarget.id}/convert-to-invoice`, {
        method: 'POST',
        body: JSON.stringify({
          paymentMode: resolvedMode,
          amountPaidNow: totalPaid,
          payments: validSplits.map((s) => ({
            mode: s.mode,
            amount: parseFloat(s.amount),
            upiUtr: s.upiUtr?.trim() || undefined,
            notes: s.notes?.trim() || undefined,
          })),
        }),
      });

      setConvertTarget(null);
      await loadData(true);
      alert(`Quotation ${convertTarget.quotationNo} successfully converted to Tax Invoice!`);
    } catch (err: unknown) {
      setConvertError((err as Error).message || 'Failed to convert quotation to invoice');
    } finally {
      setConvertSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Price Estimates & Quotations (EST)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate formal customer quotes, track deal conversion rates, and convert to invoice in 1 click
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 shadow-sm active:scale-98"
        >
          <Plus className="h-4 w-4" />
          Create New Quotation
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border/80 p-3 rounded-2xl shadow-2xs">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search estimate #, customer, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {['ALL', 'DRAFT', 'CONVERTED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  statusFilter === st
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Showing <strong>{filteredQuotes.length}</strong> of {quotations.length} quotes
        </div>
      </div>

      {/* Quotations Table */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-foreground">
            <thead className="bg-muted/50 uppercase tracking-wider text-[11px] text-muted-foreground border-b border-border font-semibold">
              <tr>
                <th className="py-3 px-4">Estimate #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Items Summary</th>
                <th className="py-3 px-4">Quoted Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    Loading price estimates...
                  </td>
                </tr>
              ) : filteredQuotes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    No quotations found. Click &quot;Create New Quotation&quot; to give a quick quote.
                  </td>
                </tr>
              ) : (
                filteredQuotes.map((q) => {
                  const customerDisplayName = q.party?.name || q.customerName || 'Walk-in Prospect';
                  const customerPhone = q.party?.phone || q.customerPhone || '';
                  const isConverted = q.status === 'CONVERTED';

                  return (
                    <tr key={q.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-primary">
                        {q.quotationNo}
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">
                        <div>{customerDisplayName}</div>
                        {customerPhone && (
                          <div className="text-[10px] text-muted-foreground">{customerPhone}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {formatDate(q.createdAt)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-foreground">
                            {q.items?.length || 0} product(s)
                          </span>
                          <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                            {q.items?.map((it) => `${it.product?.name || 'Item'} (${it.qty})`).join(', ')}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-foreground">
                        {formatINR(q.total)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            isConverted
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : 'bg-primary/10 text-primary border-primary/20'
                          }`}
                        >
                          {q.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setViewingQuotation(q)}
                          className="px-2.5 py-1.5 rounded-lg text-foreground bg-muted hover:bg-muted/80 border border-border text-xs font-medium inline-flex items-center gap-1 transition"
                          title="View Quotation Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View</span>
                        </button>

                        <button
                          onClick={() => handleDownloadPdf(q)}
                          disabled={downloadingPdfId === q.id}
                          className="px-2.5 py-1.5 rounded-lg text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 text-xs font-medium inline-flex items-center gap-1 transition"
                          title="Download Estimate PDF"
                        >
                          {downloadingPdfId === q.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          <span>PDF</span>
                        </button>

                        {!isConverted && (
                          <button
                            onClick={() => {
                              setConvertTarget(q);
                              setConvertSplits([{ mode: 'CASH', amount: String(q.total) }]);
                              setConvertError('');
                            }}
                            className="px-2.5 py-1.5 rounded-lg text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-semibold inline-flex items-center gap-1 transition active:scale-98"
                            title="Convert Quotation into Official Tax Invoice"
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                            <span>Convert to Invoice</span>
                          </button>
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

      {/* Create Modal */}
      <CreateQuotationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => loadData(true)}
        products={products}
        parties={parties}
      />

      {/* Quotation Details Drawer */}
      {viewingQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 text-foreground max-h-[88vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Estimate #{viewingQuotation.quotationNo}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Created {formatDate(viewingQuotation.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setViewingQuotation(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Customer Details */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs space-y-1">
              <div className="font-semibold text-foreground text-sm">
                {viewingQuotation.party?.name || viewingQuotation.customerName || 'Walk-in Prospect'}
              </div>
              {(viewingQuotation.party?.phone || viewingQuotation.customerPhone) && (
                <div className="text-muted-foreground">
                  Phone: {viewingQuotation.party?.phone || viewingQuotation.customerPhone}
                </div>
              )}
              {(viewingQuotation.party?.address || viewingQuotation.customerAddress) && (
                <div className="text-muted-foreground">
                  Address: {viewingQuotation.party?.address || viewingQuotation.customerAddress}
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-[11px] font-semibold uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Quoted Rate</th>
                    <th className="py-2.5 px-3 text-right">Discount</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {viewingQuotation.items?.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2.5 px-3 font-medium text-foreground">
                        {it.product?.name || 'Product'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-foreground">
                        {it.qty} {it.product?.unit || ''}
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">
                        {formatINR(it.unitPrice)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">
                        {it.discount ? formatINR(it.discount) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-foreground">
                        {formatINR(it.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div className="bg-muted/40 p-4 rounded-xl space-y-1.5 text-xs text-foreground border border-border">
              <div className="flex justify-between text-muted-foreground">
                <span>Items Subtotal:</span>
                <span>₹{Number(viewingQuotation.subtotal || 0).toFixed(2)}</span>
              </div>
              {Number(viewingQuotation.tax || 0) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Items GST ({viewingQuotation.taxRate || 0}%):</span>
                  <span>₹{Number(viewingQuotation.tax).toFixed(2)}</span>
                </div>
              )}
              {Number(viewingQuotation.transportCost || 0) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Estimated Freight:</span>
                  <span>₹{Number(viewingQuotation.transportCost).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-foreground border-t border-border pt-2">
                <span>Estimated Quote Total:</span>
                <span className="text-primary">₹{Number(viewingQuotation.total).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => handleDownloadPdf(viewingQuotation)}
                className="text-xs inline-flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Download Estimate PDF
              </Button>
              <Button
                variant="outline"
                onClick={() => setViewingQuotation(null)}
                className="text-xs"
              >
                Close View
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Invoice Modal */}
      {convertTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 text-foreground">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
                  <ArrowRight className="h-4 w-4 text-primary" />
                  Convert Estimate to Tax Invoice
                </h3>
                <p className="text-xs text-muted-foreground">
                  Estimate #{convertTarget.quotationNo} • Total: {formatINR(convertTarget.total)}
                </p>
              </div>
              <button
                onClick={() => setConvertTarget(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteConversion} className="space-y-4">
              <MultiPaymentSplitSelector
                totalAmount={Number(convertTarget.total) || 0}
                splits={convertSplits}
                onChange={setConvertSplits}
                allowCredit={true}
                creditLabel="Balance Due (Customer Credit / Pay Later)"
              />

              {convertError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400">
                  {convertError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConvertTarget(null)}
                  disabled={convertSubmitting}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={convertSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs active:scale-98"
                >
                  {convertSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  )}
                  {convertSubmitting ? 'Converting...' : 'Generate Tax Invoice Now'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
