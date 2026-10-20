'use client';

import { useState, useEffect, useCallback, useMemo, useDeferredValue } from 'react';
import { apiRequest, cachedApiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { 
  ShoppingCart, 
  Plus, 
  Search, 
  X,
  RotateCcw,
  Eye,
  Loader2,
  Pencil,
  Trash2
} from 'lucide-react';
import { Product, Warehouse, Party } from '@/components/invoices/types';
import { CreatePurchaseModal } from '@/components/purchases/create-purchase-modal';
import { formatINR, formatDate } from '@/lib/formatters';
import { useAuth } from '@/components/auth-provider';
import { TablePagination } from '@/components/ui/table-pagination';

interface PurchaseItem {
  id: string;
  productId: string;
  warehouseId?: string;
  batchNo?: string;
  qty: number;
  unitPrice: number;
  discount: number;
  total: number;
  product?: { name: string; unit: string };
  warehouse?: { name: string; code?: string };
}

interface DebitNote {
  id: string;
  debitNoteNo: string;
  amount: number;
  reason?: string;
  createdAt: string;
}

interface PurchaseRecord {
  id: string;
  purchaseNo: string;
  vendorBillNo?: string;
  party: Party;
  partyId: string;
  subtotal: number;
  tax: number;
  taxRate?: number;
  transportCost?: number;
  total: number;
  paymentMode: string;
  status: string;
  notes?: string;
  purchaseDate: string;
  createdAt: string;
  items: PurchaseItem[];
  debitNotes?: DebitNote[];
}

export default function PurchasesPage() {
  const { user } = useAuth();
  const isSupervisor = user?.role === 'SUPERVISOR';
  const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const [deletingPurchase, setDeletingPurchase] = useState<PurchaseRecord | null>(null);
  const [deletingSubmitting, setDeletingSubmitting] = useState(false);

  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & State
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<PurchaseRecord | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<PurchaseRecord | null>(null);

  // Debit Note Modal State
  const [debitNoteTarget, setDebitNoteTarget] = useState<PurchaseRecord | null>(null);
  const [debitNoteAmount, setDebitNoteAmount] = useState<number | ''>('');
  const [debitNoteReason, setDebitNoteReason] = useState('');
  const [submittingDebitNote, setSubmittingDebitNote] = useState(false);
  const [debitNoteError, setDebitNoteError] = useState('');

  const loadData = useCallback(async (force = false) => {
    try {
      const purchList = await cachedApiRequest<PurchaseRecord[]>('/purchases', {
        forceRefresh: force,
        onRevalidate: (fresh) => setPurchases(fresh),
      }).catch(() => []);
      setPurchases(purchList);
    } catch (err) {
      console.error('Failed to load purchases data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Lazy-load products, warehouses, and parties only when creating a purchase
  const loadModalData = useCallback(async () => {
    if (products.length > 0 && warehouses.length > 0 && parties.length > 0) return;
    try {
      const [prodList, whList, partyList] = await Promise.all([
        cachedApiRequest<Product[]>('/products', {
          onRevalidate: (fresh) => setProducts(fresh),
        }).catch(() => []),
        cachedApiRequest<Warehouse[]>('/warehouses', {
          onRevalidate: (fresh) => setWarehouses(fresh),
        }).catch(() => []),
        cachedApiRequest<Party[]>('/parties', {
          onRevalidate: (fresh) => setParties(fresh),
        }).catch(() => []),
      ]);
      setProducts(prodList);
      setWarehouses(whList);
      setParties(partyList);
    } catch (err) {
      console.error('Failed to load purchase modal dependencies', err);
    }
  }, [products.length, warehouses.length, parties.length]);

  const handleOpenCreateModal = () => {
    void loadModalData();
    setShowCreateModal(true);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    const handleRefresh = () => loadData(true);
    window.addEventListener('app:refresh-active-page', handleRefresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('app:refresh-active-page', handleRefresh);
    };
  }, [loadData]);

  // Aggregate stats
  const totalVolume = useMemo(() => {
    return purchases.reduce((sum, p) => sum + Number(p.total || 0), 0);
  }, [purchases]);

  const totalDebitNotes = useMemo(() => {
    return purchases.reduce(
      (sum, p) => sum + (p.debitNotes?.reduce((s, dn) => s + Number(dn.amount || 0), 0) || 0),
      0
    );
  }, [purchases]);

  const deferredSearch = useDeferredValue(search);

  const filteredPurchases = useMemo(() => {
    if (!deferredSearch.trim()) return purchases;
    const q = deferredSearch.toLowerCase().trim();
    return purchases.filter((p) => {
      const pNo = p.purchaseNo?.toLowerCase() || '';
      const vBill = p.vendorBillNo?.toLowerCase() || '';
      const sName = p.party?.name?.toLowerCase() || '';
      const sPhone = p.party?.phone || '';
      return pNo.includes(q) || vBill.includes(q) || sName.includes(q) || sPhone.includes(q);
    });
  }, [purchases, deferredSearch]);

  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [prevFilterKey, setPrevFilterKey] = useState(deferredSearch);
  if (deferredSearch !== prevFilterKey) {
    setPrevFilterKey(deferredSearch);
    setCurrentPage(1);
  }

  const paginatedPurchases = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPurchases.slice(start, start + pageSize);
  }, [filteredPurchases, currentPage, pageSize]);

  const handleCreateDebitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debitNoteTarget || !debitNoteAmount || Number(debitNoteAmount) <= 0) {
      setDebitNoteError('Please enter a valid debit note amount.');
      return;
    }
    setSubmittingDebitNote(true);
    setDebitNoteError('');
    try {
      await apiRequest(`/purchases/${debitNoteTarget.id}/debit-note`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(debitNoteAmount),
          reason: debitNoteReason.trim() || undefined,
        }),
      });
      setDebitNoteTarget(null);
      setDebitNoteAmount('');
      setDebitNoteReason('');
      await loadData(true);
    } catch (err: unknown) {
      setDebitNoteError((err as Error).message || 'Failed to record debit note');
    } finally {
      setSubmittingDebitNote(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" />
            Inward Purchases & Stock Replenishment
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSupervisor
              ? 'View inbound purchase shipments and factory deliveries received for your godown.'
              : 'Record supplier bills, batch lots, and atomic inventory inwarding with row-locked stock ledger'}
          </p>
        </div>
        {!isSupervisor && (
          <Button
            onClick={handleOpenCreateModal}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 shadow-sm active:scale-98"
          >
            <Plus className="h-4 w-4" />
            Record Inward Purchase
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {isSupervisor ? (
          <>
            <div className="rounded-2xl border border-blue-500/20 bg-card p-4 shadow-2xs space-y-1">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                Total Inbound Shipments
              </span>
              <span className="text-2xl font-extrabold text-foreground tracking-tight block">
                {purchases.length}
              </span>
              <span className="text-[11px] text-muted-foreground block">
                Factory orders arriving at godown
              </span>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-card p-4 shadow-2xs space-y-1">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                Total Units Inwarded
              </span>
              <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight block font-mono">
                {purchases.reduce(
                  (sum, p) => sum + (p.items?.reduce((s, it) => s + Number(it.qty || 0), 0) || 0),
                  0
                ).toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-muted-foreground block">
                Tiles, sanitaryware, and boxes inwarded
              </span>
            </div>

            <div className="rounded-2xl border border-purple-500/20 bg-card p-4 shadow-2xs space-y-1">
              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">
                Active Suppliers
              </span>
              <span className="text-2xl font-extrabold text-primary tracking-tight block">
                {new Set(purchases.map((p) => p.partyId)).size}
              </span>
              <span className="text-[11px] text-muted-foreground block">
                Distinct vendors delivering materials
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Total Inward Purchases
              </span>
              <span className="text-2xl font-extrabold text-foreground tracking-tight block">
                {formatINR(totalVolume)}
              </span>
              <span className="text-[11px] text-muted-foreground block">
                {purchases.length} supplier inward order(s)
              </span>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Total Debit Notes / Returns
              </span>
              <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight block">
                {formatINR(totalDebitNotes)}
              </span>
              <span className="text-[11px] text-muted-foreground block">
                Vendor debit adjustments & refunds
              </span>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Net Procurement Outflow
              </span>
              <span className="text-2xl font-extrabold text-primary tracking-tight block">
                {formatINR(Math.max(0, totalVolume - totalDebitNotes))}
              </span>
              <span className="text-[11px] text-muted-foreground block">
                Net total goods inventory value acquired
              </span>
            </div>
          </>
        )}
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border/80 p-3 rounded-2xl shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search supplier, bill #, purchase #..."
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
        <div className="text-xs text-muted-foreground">
          Showing <strong>{filteredPurchases.length}</strong> of {purchases.length} purchases
        </div>
      </div>

      {/* Purchases Table */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-foreground">
            <thead className="bg-muted/50 uppercase tracking-wider text-[11px] text-muted-foreground border-b border-border font-semibold">
              <tr>
                <th className="py-3 px-4">Purchase #</th>
                <th className="py-3 px-4">Vendor Bill #</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Items Inwarded</th>
                {!isSupervisor && (
                  <>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Total Amount</th>
                  </>
                )}
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={isSupervisor ? 6 : 8} className="text-center py-12 text-muted-foreground">
                    Loading inward purchases...
                  </td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={isSupervisor ? 6 : 8} className="text-center py-12 text-muted-foreground">
                    No inward purchases recorded.
                  </td>
                </tr>
              ) : (
                paginatedPurchases.map((p) => {
                  const debitTotal =
                    p.debitNotes?.reduce((s, dn) => s + Number(dn.amount || 0), 0) || 0;

                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-primary">
                        {p.purchaseNo}
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        {p.vendorBillNo || '—'}
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">
                        <div>{p.party?.name || 'Supplier'}</div>
                        <div className="text-[10px] text-muted-foreground">{p.party?.phone}</div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {formatDate(p.purchaseDate || p.createdAt)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-foreground">
                            {p.items?.length || 0} line item(s)
                          </span>
                          <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                            {p.items?.map((it) => `${it.product?.name || 'Item'} (${it.qty})`).join(', ')}
                          </div>
                        </div>
                      </td>
                      {!isSupervisor && (
                        <>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                              {p.paymentMode}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-foreground">
                            <div>{formatINR(p.total)}</div>
                            {debitTotal > 0 && (
                              <div className="text-[10px] text-rose-600 dark:text-rose-400 font-normal">
                                -{formatINR(debitTotal)} debit note
                              </div>
                            )}
                          </td>
                        </>
                      )}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setViewingPurchase(p)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-[0.5rem] text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 transition active:scale-95 shadow-2xs"
                            title="View Inward Breakdown"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {!isSupervisor && (
                            <button
                              onClick={() => {
                                void loadModalData();
                                setEditingPurchase(p);
                                setShowCreateModal(true);
                              }}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-[0.5rem] text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition active:scale-95 shadow-2xs"
                              title="Edit Purchase"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {!isSupervisor && (
                            <button
                              onClick={() => {
                                setDebitNoteTarget(p);
                                setDebitNoteAmount('');
                                setDebitNoteReason('');
                                setDebitNoteError('');
                              }}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-[0.5rem] text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition active:scale-95 shadow-2xs"
                              title="Issue Debit Note (Return to Vendor)"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                          {canManage && (
                            <button
                              onClick={() => setDeletingPurchase(p)}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-[0.5rem] text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition active:scale-95 shadow-2xs"
                              title="Delete Purchase & Revert Inward Stock"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
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
          totalItems={filteredPurchases.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Create Inward Purchase Modal */}
      <CreatePurchaseModal
        isOpen={showCreateModal}
        purchaseToEdit={editingPurchase}
        onClose={() => {
          setShowCreateModal(false);
          setEditingPurchase(null);
        }}
        onSuccess={() => loadData(true)}
        products={products}
        warehouses={warehouses}
        parties={parties}
      />

      {/* Purchase Details Drawer */}
      {viewingPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 text-foreground max-h-[88vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Inward Purchase #{viewingPurchase.purchaseNo}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Vendor Bill: <strong className="text-foreground">{viewingPurchase.vendorBillNo || 'N/A'}</strong> •{' '}
                  {formatDate(viewingPurchase.purchaseDate || viewingPurchase.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setViewingPurchase(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Supplier Card */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs space-y-1">
              <div className="font-semibold text-foreground text-sm">{viewingPurchase.party?.name}</div>
              <div className="text-muted-foreground">Phone: {viewingPurchase.party?.phone}</div>
              {viewingPurchase.party?.address && (
                <div className="text-muted-foreground">Address: {viewingPurchase.party.address}</div>
              )}
            </div>

            {/* Line Items Table */}
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-[11px] font-semibold uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3">Batch / Lot</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    {!isSupervisor && (
                      <>
                        <th className="py-2.5 px-3 text-right">Rate</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {viewingPurchase.items?.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2.5 px-3 font-medium text-foreground">
                        {it.product?.name || 'Product'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-muted-foreground">
                        {it.batchNo || 'Standard Lot'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-foreground">
                        {it.qty} {it.product?.unit || ''}
                      </td>
                      {!isSupervisor && (
                        <>
                          <td className="py-2.5 px-3 text-right text-muted-foreground">
                            {formatINR(it.unitPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-foreground">
                            {formatINR(it.total)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Debit Notes on this purchase */}
            {!isSupervisor && viewingPurchase.debitNotes && viewingPurchase.debitNotes.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
                  Debit Notes Issued Against This Purchase:
                </span>
                <div className="space-y-1.5">
                  {viewingPurchase.debitNotes.map((dn) => (
                    <div
                      key={dn.id}
                      className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-mono font-bold text-foreground">{dn.debitNoteNo}</span>
                        {dn.reason && <p className="text-muted-foreground text-[11px] mt-0.5">{dn.reason}</p>}
                      </div>
                      <span className="font-extrabold text-rose-600 dark:text-rose-400">
                        {formatINR(dn.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Financial Breakdown / Supervisor Goods Overview */}
            {isSupervisor ? (
              <div className="bg-purple-500/5 p-4 rounded-xl space-y-1.5 text-xs text-foreground border border-purple-500/20">
                <div className="flex justify-between text-muted-foreground">
                  <span>Total Line Items:</span>
                  <span className="font-semibold text-foreground">{viewingPurchase.items?.length || 0} items</span>
                </div>
                <div className="flex justify-between text-muted-foreground border-t border-purple-500/20 pt-1.5">
                  <span>Total Quantity Inwarded:</span>
                  <span className="font-bold text-primary font-mono text-sm">
                    {viewingPurchase.items?.reduce((s, it) => s + Number(it.qty || 0), 0) || 0} units
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-muted/40 p-4 rounded-xl space-y-1.5 text-xs text-foreground border border-border">
                <div className="flex justify-between text-muted-foreground">
                  <span>Items Subtotal:</span>
                  <span>₹{Number(viewingPurchase.subtotal || 0).toFixed(2)}</span>
                </div>
                {Number(viewingPurchase.tax || 0) > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax ({viewingPurchase.taxRate || 0}%):</span>
                    <span>₹{Number(viewingPurchase.tax).toFixed(2)}</span>
                  </div>
                )}
                {Number(viewingPurchase.transportCost || 0) > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Freight / Transport:</span>
                    <span>₹{Number(viewingPurchase.transportCost).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-foreground border-t border-border pt-2">
                  <span>Grand Total:</span>
                  <span className="text-primary">₹{Number(viewingPurchase.total).toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setViewingPurchase(null)}
                className="text-xs"
              >
                Close View
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Record Debit Note Modal */}
      {debitNoteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 text-foreground">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
                  <RotateCcw className="h-4 w-4 text-rose-500" />
                  Issue Debit Note (Return to Vendor)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Against Purchase #{debitNoteTarget.purchaseNo} ({debitNoteTarget.party?.name})
                </p>
              </div>
              <button
                onClick={() => setDebitNoteTarget(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDebitNote} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Debit Note Amount (₹) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={debitNoteAmount}
                  onChange={(e) =>
                    setDebitNoteAmount(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Reason for Return / Adjustment (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Broken tiles in box or billing rate mismatch"
                  value={debitNoteReason}
                  onChange={(e) => setDebitNoteReason(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {debitNoteError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400">
                  {debitNoteError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDebitNoteTarget(null)}
                  disabled={submittingDebitNote}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingDebitNote}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs active:scale-98"
                >
                  {submittingDebitNote ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : null}
                  {submittingDebitNote ? 'Recording...' : 'Record Debit Note'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    
      {/* Delete Purchase Confirmation Dialog */}
      {deletingPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 text-foreground">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Delete Inward Purchase?</h3>
                <p className="text-xs text-muted-foreground">Purchase #{deletingPurchase.purchaseNo}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this purchase? Inwarded stock will be deducted back from catalog stock, and linked payment/credit ledger entries will be removed.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={deletingSubmitting}
                onClick={() => setDeletingPurchase(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deletingSubmitting}
                onClick={async () => {
                  if (deletingSubmitting) return;
                  setDeletingSubmitting(true);
                  try {
                    await apiRequest(`/purchases/${deletingPurchase.id}`, { method: 'DELETE' });
                    setDeletingPurchase(null);
                    await loadData(true);
                  } catch (err: any) {
                    alert(err.message || 'Failed to delete purchase');
                  } finally {
                    setDeletingSubmitting(false);
                  }
                }}
              >
                {deletingSubmitting ? 'Deleting...' : 'Delete Purchase'}
              </Button>
            </div>
          </div>
        </div>
      )}
</div>
  );
}
