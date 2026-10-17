'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/auth-provider';
import { cachedApiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  PackagePlus,
  Search,
  Filter,
  CheckCircle2,
  Edit3,
  Plus,
  Package,
  Layers,
  Boxes,
} from 'lucide-react';
import { Product, StockItem } from '@/components/warehouses/types';
import { InwardStockModal } from '@/components/warehouses/inward-stock-modal';
import { StockAdjustModal } from '@/components/warehouses/stock-adjust-modal';
import { TablePagination } from '@/components/ui/table-pagination';

export default function WarehousesPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const [products, setProducts] = useState<Product[]>([]);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [successMessage, setSuccessMessage] = useState('');

  // Modal State Triggers
  const [showInwardModal, setShowInwardModal] = useState(false);
  const [inwardConfig, setInwardConfig] = useState<{
    productId?: string;
    batchNo?: string;
  }>({});

  const [selectedAdjustStock, setSelectedAdjustStock] = useState<StockItem | null>(null);

  const showToast = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const loadData = useCallback(async (force = false) => {
    try {
      const [prodList, stockList] = await Promise.all([
        cachedApiRequest<Product[]>('/products', {
          forceRefresh: force,
          onRevalidate: (fresh) => setProducts(fresh),
        }),
        cachedApiRequest<StockItem[]>('/stock', {
          forceRefresh: force,
          onRevalidate: (fresh) => setStocks(fresh),
        }),
      ]);
      setProducts(prodList || []);
      setStocks(stockList || []);
    } catch (err) {
      console.error('Failed to load stock data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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

  // Open Inward Modal
  const openInwardModal = (productId?: string, batchNo?: string) => {
    setInwardConfig({
      productId: productId || products[0]?.id || '',
      batchNo: batchNo || `LOT-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    });
    setShowInwardModal(true);
  };

  // Distinct categories for filter
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [products]);

  // Aggregate stats
  const totalStockUnits = useMemo(() => {
    return stocks.reduce((sum, s) => sum + Number(s.quantity || 0), 0);
  }, [stocks]);

  const uniqueSkusWithStock = useMemo(() => {
    return new Set(stocks.filter((s) => Number(s.quantity || 0) > 0).map((s) => s.productId)).size;
  }, [stocks]);

  const activeBatchCount = useMemo(() => {
    return stocks.filter((s) => Number(s.quantity || 0) > 0).length;
  }, [stocks]);

  // Filtered live stock table
  const filteredStocks = useMemo(() => {
    return stocks.filter((s) => {
      const hasStock = Number(s.quantity || 0) > 0;
      const matchesCat =
        selectedCategory === 'ALL' || s.product?.category === selectedCategory;
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (s.product?.name?.toLowerCase().includes(q) ?? false) ||
        (s.product?.category?.toLowerCase().includes(q) ?? false) ||
        (s.batchNo?.toLowerCase().includes(q) ?? false);
      return hasStock && matchesCat && matchesSearch;
    });
  }, [stocks, selectedCategory, search]);

  // Pagination
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const filterKey = `${search}_${selectedCategory}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setCurrentPage(1);
  }

  const paginatedStocks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStocks.slice(start, start + pageSize);
  }, [filteredStocks, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successMessage && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-sm shadow-sm animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Stock & Inventory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time product inventory tracking, batch lots, and physical count auditing.
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={() => openInwardModal()}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/80 text-primary-foreground font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <PackagePlus className="h-4 w-4" />
              + Inward / Add Stock
            </Button>
          </div>
        )}
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border border-border/80 bg-card/75 backdrop-blur-xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Total Stock In Hand
              </span>
              <span className="text-xl font-bold text-foreground">
                {totalStockUnits.toLocaleString()} units
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-card/75 backdrop-blur-xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Products in Catalog
              </span>
              <span className="text-xl font-bold text-foreground">
                {uniqueSkusWithStock} Active SKUs ({products.length} registered)
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-card/75 backdrop-blur-xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Tracked Stock Lots
              </span>
              <span className="text-xl font-bold text-foreground">
                {activeBatchCount} Batches / Lots
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Stock Ledger Section */}
      <div className="rounded-2xl border border-border/80 bg-card/75 backdrop-blur-xl overflow-hidden space-y-4 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground">Live Stock Ledger</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Direct product-level inventory and lot batches.
            </p>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter by Category */}
            <div className="flex items-center gap-1.5 bg-muted/60 border border-border/80 rounded-xl px-2.5 py-1.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-transparent text-xs text-foreground focus:outline-none"
              >
                <option value="ALL" className="bg-card text-foreground">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat} className="bg-card text-foreground">
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="flex items-center gap-2 bg-muted/60 border border-border/80 rounded-xl px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search product, batch..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none w-36 sm:w-48"
              />
            </div>
          </div>
        </div>

        {/* Stock Table */}
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/80">
              <tr>
                <th className="py-3 px-4">Product / Design</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Batch / Lot No</th>
                <th className="py-3 px-4">Available Quantity</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-muted-foreground text-xs">
                    Loading stock levels...
                  </td>
                </tr>
              ) : filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground space-y-3">
                    <p className="text-xs">No inventory found for the current search or category filter.</p>
                    {canManage && (
                      <Button
                        onClick={() => openInwardModal()}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-3.5 py-1.5 rounded-lg font-medium"
                      >
                        <PackagePlus className="h-3.5 w-3.5 mr-1.5" />
                        Inward Stock for a Product
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedStocks.map((stock) => (
                  <tr key={stock.id} className="hover:bg-muted/30 transition">
                    <td className="py-3.5 px-4 font-medium text-foreground">
                      <div className="font-semibold text-foreground">{stock.product?.name}</div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-muted-foreground">
                      <span className="px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/50 font-medium">
                        {stock.product?.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">
                      {stock.batchNo || 'Default Batch'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`font-bold font-mono ${
                          stock.quantity <= 0
                            ? 'text-rose-500 dark:text-rose-400'
                            : stock.quantity < 10
                            ? 'text-amber-500 dark:text-amber-400'
                            : 'text-emerald-500 dark:text-emerald-400'
                        }`}
                      >
                        {stock.quantity} {stock.product?.unit}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1.5">
                      {canManage ? (
                        <>
                          <button
                            onClick={() => openInwardModal(stock.productId, stock.batchNo)}
                            title="Add more stock to this item"
                            className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 px-2 py-1 rounded-lg hover:bg-emerald-500/10 transition inline-flex items-center gap-1"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Inward
                          </button>

                          <button
                            onClick={() => setSelectedAdjustStock(stock)}
                            title="Direct count adjustment"
                            className="text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition inline-flex items-center gap-1"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Audit
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setSelectedAdjustStock(stock)}
                          title="Direct count adjustment"
                          className="text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 px-2 py-1 rounded-lg hover:bg-purple-500/10 transition inline-flex items-center gap-1"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Audit
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          currentPage={currentPage}
          totalItems={filteredStocks.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Modals */}
      <InwardStockModal
        isOpen={showInwardModal}
        onClose={() => setShowInwardModal(false)}
        onSuccess={async () => {
          showToast('Stock successfully added!');
          await loadData(true);
        }}
        products={products}
        stocks={stocks}
        initialProductId={inwardConfig.productId}
        initialBatchNo={inwardConfig.batchNo}
      />

      <StockAdjustModal
        isOpen={Boolean(selectedAdjustStock)}
        onClose={() => setSelectedAdjustStock(null)}
        onSuccess={async () => {
          showToast('Inventory count updated.');
          await loadData(true);
        }}
        stock={selectedAdjustStock}
      />
    </div>
  );
}
