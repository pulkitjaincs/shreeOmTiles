'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/auth-provider';
import { cachedApiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Warehouse as WarehouseIcon,
  ArrowLeftRight,
  Edit3,
  Plus,
  PackagePlus,
  Search,
  Filter,
  CheckCircle2,
  Trash2,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import { Warehouse, Product, StockItem } from '@/components/warehouses/types';

import { InwardStockModal } from '@/components/warehouses/inward-stock-modal';
import { StockTransferModal } from '@/components/warehouses/stock-transfer-modal';
import { StockAdjustModal } from '@/components/warehouses/stock-adjust-modal';
import { WarehouseFormModal } from '@/components/warehouses/warehouse-form-modal';
import { DeleteWarehouseModal, ZeroOutWarehouseModal } from '@/components/warehouses/warehouse-danger-modals';

export default function WarehousesPage() {
  const { user } = useAuth();
  const isSupervisor = user?.role === 'SUPERVISOR';
  const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [filterWarehouseId, setFilterWarehouseId] = useState<string>(
    isSupervisor && user?.scope ? user.scope : 'ALL'
  );
  const [isWhDropdownOpen, setIsWhDropdownOpen] = useState(false);
  const [showAllCards, setShowAllCards] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Modal State Triggers
  const [showInwardModal, setShowInwardModal] = useState(false);
  const [inwardConfig, setInwardConfig] = useState<{
    warehouseId?: string;
    productId?: string;
    batchNo?: string;
  }>({});

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetStock, setTransferTargetStock] = useState<StockItem | null>(null);

  const [selectedAdjustStock, setSelectedAdjustStock] = useState<StockItem | null>(null);

  // Warehouse Create/Edit State
  const [warehouseFormTarget, setWarehouseFormTarget] = useState<Warehouse | null | 'NEW'>(null);

  // Danger Action State
  const [deleteWarehouseTarget, setDeleteWarehouseTarget] = useState<Warehouse | null>(null);
  const [zeroOutWhTarget, setZeroOutWhTarget] = useState<Warehouse | null>(null);

  const showToast = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const loadData = useCallback(async (force = false) => {
    try {
      const [whList, prodList, stockList] = await Promise.all([
        cachedApiRequest<Warehouse[]>('/warehouses', {
          forceRefresh: force,
          onRevalidate: (fresh) => setWarehouses(fresh),
        }),
        cachedApiRequest<Product[]>('/products', {
          forceRefresh: force,
          onRevalidate: (fresh) => setProducts(fresh),
        }),
        cachedApiRequest<StockItem[]>('/stock', {
          forceRefresh: force,
          onRevalidate: (fresh) => setStocks(fresh),
        }),
      ]);
      setWarehouses(whList);
      setProducts(prodList);
      setStocks(stockList);
    } catch (err) {
      console.error('Failed to load warehouse data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const handleRefresh = () => {
      loadData(true);
    };
    window.addEventListener('app:refresh-active-page', handleRefresh);
    return () => window.removeEventListener('app:refresh-active-page', handleRefresh);
  }, [loadData]);

  // Open Inward Modal
  const openInwardModal = (warehouseId?: string, productId?: string, batchNo?: string) => {
    setInwardConfig({
      warehouseId: warehouseId || warehouses[0]?.id || '',
      productId: productId || products[0]?.id || '',
      batchNo: batchNo || `LOT-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    });
    setShowInwardModal(true);
  };

  // Open Transfer Modal
  const openTransferModal = (stockItem?: StockItem) => {
    setTransferTargetStock(stockItem || null);
    setShowTransferModal(true);
  };

  // Open Edit Warehouse
  const handleOpenEditWh = (wh: Warehouse) => {
    setWarehouseFormTarget(wh);
  };

  // Filtered live stock table
  const filteredStocks = stocks.filter((s) => {
    const matchesWarehouse = filterWarehouseId === 'ALL' || s.warehouseId === filterWarehouseId;
    const matchesSearch =
      s.product?.name.toLowerCase().includes(search.toLowerCase()) ||
      s.product?.category.toLowerCase().includes(search.toLowerCase()) ||
      s.warehouse?.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.batchNo && s.batchNo.toLowerCase().includes(search.toLowerCase()));
    return matchesWarehouse && matchesSearch;
  });

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
            Warehouses & Live Stock
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Inward newly added tile designs, manage multi-godown batches, and execute inter-warehouse transfers.
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2.5">
              {/* Primary Action: Add Stock / Inward Design */}
              <Button
                onClick={() => openInwardModal()}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/80 text-primary-foreground font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                <PackagePlus className="h-4 w-4" />
                + Inward / Add Stock
              </Button>

              {/* Transfer Stock Action */}
              <Button
                onClick={() => openTransferModal()}
                variant="outline"
                className="inline-flex items-center gap-2 bg-card/80 hover:bg-muted text-foreground font-medium px-3.5 py-2.5 rounded-xl border border-border/80 transition-all shadow-sm"
              >
                <ArrowLeftRight className="h-4 w-4 text-primary" />
                Transfer Stock
              </Button>

              {/* Add Warehouse */}
              <Button
                onClick={() => {
                  setWarehouseFormTarget('NEW');
                }}
                variant="ghost"
                className="inline-flex items-center gap-2 bg-muted/60 hover:bg-muted text-foreground font-medium px-3.5 py-2.5 rounded-xl border border-border/70 transition-all"
              >
                <Plus className="h-4 w-4" />
                New Warehouse
              </Button>
          </div>
        )}
      </div>

      {/* Interactive Godown / Warehouse Selector Dropdown */}
      <div className="relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-border/80 bg-card/85 backdrop-blur-xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <WarehouseIcon className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Godown / Location Selection
              </span>
              <button
                type="button"
                onClick={() => setIsWhDropdownOpen(!isWhDropdownOpen)}
                className="flex items-center gap-2 text-base sm:text-lg font-bold text-foreground hover:text-primary transition group text-left"
              >
                <span>
                  {filterWarehouseId === 'ALL'
                    ? `All Godowns & Showrooms (${warehouses.length} locations)`
                    : `${warehouses.find((w) => w.id === filterWarehouseId)?.name || 'Godown'} • ${warehouses.find((w) => w.id === filterWarehouseId)?.type || ''}`}
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground group-hover:text-primary transition-transform duration-200 ${isWhDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsWhDropdownOpen(!isWhDropdownOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-semibold border border-primary/20 hover:bg-primary/20 transition"
            >
              <Filter className="h-3.5 w-3.5" />
              <span>{isWhDropdownOpen ? 'Close Dropdown' : 'Select Godown'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAllCards(!showAllCards)}
              className="text-xs text-muted-foreground hover:text-foreground font-medium px-3 py-1.5 rounded-xl border border-border/60 hover:bg-muted transition"
            >
              {showAllCards ? 'Collapse Cards' : 'View All Cards'}
            </button>
          </div>
        </div>

        {/* Godowns Dropdown Popover */}
        {isWhDropdownOpen && (
          <div className="absolute left-0 right-0 top-full mt-2 z-30 rounded-2xl border border-border bg-card/98 backdrop-blur-2xl shadow-2xl p-2.5 space-y-1.5 max-h-80 overflow-y-auto animate-in fade-in zoom-in-95">
            <button
              type="button"
              onClick={() => {
                setFilterWarehouseId('ALL');
                setIsWhDropdownOpen(false);
              }}
              className={`w-full p-3 rounded-xl flex items-center justify-between text-left transition ${
                filterWarehouseId === 'ALL'
                  ? 'bg-primary/10 text-primary font-semibold border border-primary/20'
                  : 'hover:bg-muted/60 text-foreground'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <WarehouseIcon className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-bold text-xs sm:text-sm">All Godowns & Showrooms</p>
                  <p className="text-[11px] text-muted-foreground">Show aggregated live stock across all store locations</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold">
                {stocks.reduce((s, it) => s + it.quantity, 0)} units total
              </span>
            </button>

            <div className="border-t border-border/60 my-1" />

            {warehouses.map((wh) => {
              const whStocks = stocks.filter((s) => s.warehouseId === wh.id);
              const totalUnits = whStocks.reduce((sum, s) => sum + s.quantity, 0);
              const distinctProducts = new Set(whStocks.map((s) => s.productId)).size;
              const isSelected = filterWarehouseId === wh.id;

              return (
                <div
                  key={wh.id}
                  className={`p-3 rounded-xl flex items-center justify-between text-left transition gap-2 ${
                    isSelected
                      ? 'bg-primary/10 text-primary border border-primary/20 font-semibold'
                      : 'hover:bg-muted/60 text-foreground'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setFilterWarehouseId(wh.id);
                      setIsWhDropdownOpen(false);
                    }}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs sm:text-sm text-foreground truncate">{wh.name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground uppercase">
                        {wh.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{wh.address}</p>
                    <div className="flex items-center gap-3 mt-1 text-[11px]">
                      <span className="font-mono text-primary font-semibold">{totalUnits} units</span>
                      <span className="text-muted-foreground">• {distinctProducts} SKUs</span>
                    </div>
                  </button>

                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditWh(wh);
                        }}
                        title="Edit Godown Details"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      {totalUnits === 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteWarehouseTarget(wh);
                          }}
                          title="Delete Empty Godown"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Godown Card or Full Grid if expanded */}
      {(filterWarehouseId !== 'ALL' || showAllCards) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {warehouses
            .filter((wh) => (showAllCards ? true : wh.id === filterWarehouseId))
            .map((wh) => {
              const warehouseStocks = stocks.filter((s) => s.warehouseId === wh.id);
              const totalUnits = warehouseStocks.reduce((sum, s) => sum + s.quantity, 0);
              const distinctProducts = new Set(warehouseStocks.map((s) => s.productId)).size;

              return (
                <div
                  key={wh.id}
                  className="p-5 rounded-2xl border border-border/80 bg-card/75 backdrop-blur-xl space-y-3.5 hover:border-border hover:shadow-md transition duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                      <WarehouseIcon className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border/50">
                        {wh.type}
                      </span>
                      {canManage && (
                        <>
                          <button
                            onClick={() => handleOpenEditWh(wh)}
                            title="Edit Warehouse Details"
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          {totalUnits === 0 && (
                            <button
                              onClick={() => setDeleteWarehouseTarget(wh)}
                              title="Delete Empty Warehouse"
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-foreground text-base tracking-tight">{wh.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{wh.address}</p>
                  </div>

                  <div className="pt-2 border-t border-border/60 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px] font-medium">Total Units</span>
                      <span className="font-bold text-primary text-sm">{totalUnits} units</span>
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground block text-[11px] font-medium">Unique Designs</span>
                      <span className="font-semibold text-foreground text-sm">{distinctProducts} SKUs</span>
                    </div>
                  </div>

                  {canManage && totalUnits > 0 && (
                    <div className="pt-2">
                      <button
                        onClick={() => setZeroOutWhTarget(wh)}
                        title="Set all inventory in this warehouse to 0"
                        className="w-full py-1.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-medium flex items-center justify-center gap-1.5 transition"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Set Stock to 0 (Empty Godown)
                      </button>
                    </div>
                  )}

                  {canManage && totalUnits === 0 && (
                    <div className="pt-2">
                      <button
                        onClick={() => setDeleteWarehouseTarget(wh)}
                        className="w-full py-1.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-medium flex items-center justify-center gap-1.5 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove Empty Warehouse
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Live Stock Ledger Section */}
      <div className="rounded-2xl border border-border/80 bg-card/75 backdrop-blur-xl overflow-hidden space-y-4 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground">Live Stock Ledger by Batch</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Real-time inventory levels broken down by warehouse godown and batch / lot.
            </p>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter by Warehouse */}
            <div className="flex items-center gap-1.5 bg-muted/60 border border-border/80 rounded-xl px-2.5 py-1.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={filterWarehouseId}
                onChange={(e) => setFilterWarehouseId(e.target.value)}
                className="bg-transparent text-xs text-foreground focus:outline-none"
              >
                <option value="ALL" className="bg-card text-foreground">All Warehouses</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id} className="bg-card text-foreground">
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="flex items-center gap-2 bg-muted/60 border border-border/80 rounded-xl px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search design, batch..."
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
                <th className="py-3 px-4">Warehouse Location</th>
                <th className="py-3 px-4">Batch / Lot No</th>
                <th className="py-3 px-4">Available Quantity</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-muted-foreground text-xs">
                    Loading stock levels...
                  </td>
                </tr>
              ) : filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground space-y-3">
                    <p className="text-xs">No inventory found for the current search or warehouse filter.</p>
                    <Button
                      onClick={() => openInwardModal()}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-3.5 py-1.5 rounded-lg font-medium"
                    >
                      <PackagePlus className="h-3.5 w-3.5 mr-1.5" />
                      Inward Stock for a Design
                    </Button>
                  </td>
                </tr>
              ) : (
                filteredStocks.map((stock) => (
                  <tr key={stock.id} className="hover:bg-muted/30 transition">
                    <td className="py-3.5 px-4 font-medium text-foreground">
                      <div className="font-semibold text-foreground">{stock.product?.name}</div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-muted-foreground">
                      <span className="px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/50 font-medium">
                        {stock.product?.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-primary">
                      {stock.warehouse?.name}
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
                          {/* Inward More to this row */}
                          <button
                            onClick={() => openInwardModal(stock.warehouseId, stock.productId, stock.batchNo)}
                            title="Add more stock to this item"
                            className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 px-2 py-1 rounded-lg hover:bg-emerald-500/10 transition inline-flex items-center gap-1"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Inward
                          </button>

                          {/* Transfer from this row */}
                          <button
                            onClick={() => openTransferModal(stock)}
                            title="Transfer stock to another warehouse"
                            className="text-xs font-medium text-primary hover:text-primary/80 px-2 py-1 rounded-lg hover:bg-primary/10 transition inline-flex items-center gap-1"
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                            Transfer
                          </button>

                          {/* Physical count adjust */}
                          <button
                            onClick={() => setSelectedAdjustStock(stock)}
                            title="Direct count adjustment"
                            className="text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition inline-flex items-center gap-1"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Audit
                          </button>
                        </>
                      ) : isSupervisor && stock.warehouseId === user?.scope ? (
                        <>
                          {/* Supervisor can transfer from their warehouse */}
                          <button
                            onClick={() => openTransferModal(stock)}
                            title="Transfer stock to another warehouse"
                            className="text-xs font-medium text-primary hover:text-primary/80 px-2 py-1 rounded-lg hover:bg-primary/10 transition inline-flex items-center gap-1"
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                            Transfer
                          </button>

                          {/* Supervisor can audit / adjust count in their warehouse */}
                          <button
                            onClick={() => setSelectedAdjustStock(stock)}
                            title="Direct count adjustment"
                            className="text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 px-2 py-1 rounded-lg hover:bg-purple-500/10 transition inline-flex items-center gap-1"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Audit
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground font-medium">In Stock</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}

      {/* ======================================================== */}
      {/* EXTRACTED MODALS (LAZY LOADED)                          */}
      {/* ======================================================== */}
      <InwardStockModal
        isOpen={showInwardModal}
        onClose={() => setShowInwardModal(false)}
        onSuccess={async () => {
          showToast('Stock successfully added to warehouse!');
          await loadData();
        }}
        warehouses={warehouses}
        products={products}
        stocks={stocks}
        initialWarehouseId={inwardConfig.warehouseId}
        initialProductId={inwardConfig.productId}
        initialBatchNo={inwardConfig.batchNo}
      />

      <StockTransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        onSuccess={async () => {
          showToast('Stock successfully transferred between warehouses!');
          await loadData();
        }}
        warehouses={warehouses}
        stocks={stocks}
        initialStockItem={transferTargetStock}
      />

      <StockAdjustModal
        isOpen={Boolean(selectedAdjustStock)}
        onClose={() => setSelectedAdjustStock(null)}
        onSuccess={async () => {
          showToast('Inventory count updated.');
          await loadData();
        }}
        stock={selectedAdjustStock}
      />

      <WarehouseFormModal
        isOpen={warehouseFormTarget !== null}
        onClose={() => setWarehouseFormTarget(null)}
        onSuccess={async () => {
          showToast(
            warehouseFormTarget === 'NEW'
              ? 'New warehouse added successfully!'
              : 'Warehouse updated successfully!'
          );
          await loadData();
        }}
        warehouse={warehouseFormTarget === 'NEW' ? null : warehouseFormTarget}
      />

      <DeleteWarehouseModal
        target={deleteWarehouseTarget}
        onClose={() => setDeleteWarehouseTarget(null)}
        onSuccess={async () => {
          showToast('Warehouse successfully deleted.');
          await loadData();
        }}
      />

      <ZeroOutWarehouseModal
        target={zeroOutWhTarget}
        onClose={() => setZeroOutWhTarget(null)}
        onSuccess={async () => {
          showToast(`All inventory in ${zeroOutWhTarget?.name || 'warehouse'} has been set to 0.`);
          await loadData();
        }}
      />
    </div>
  );
}
