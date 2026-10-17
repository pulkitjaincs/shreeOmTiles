'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiRequest } from '@/lib/api';
import {
  Warehouse as WarehouseIcon,
  Truck,
  Boxes,
  CheckCircle,
  Clock,
  RefreshCw,
  Search,
  ShoppingCart,
  Edit3,
  MapPin,
  Phone,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { StockItem, Warehouse } from '@/components/warehouses/types';

const StockAdjustModal = dynamic(
  () => import('@/components/warehouses/stock-adjust-modal').then((mod) => mod.StockAdjustModal),
  { ssr: false }
);

interface DeliveryItem {
  invoiceItemId?: string;
  productId: string;
  productName: string;
  unit: string;
  warehouseId?: string;
  warehouseName?: string;
  warehouseAddress?: string;
  batchNo?: string;
  qty: number;
  pickedUp?: boolean;
  pickedUpAt?: string;
  pickedUpByName?: string;
}

interface Delivery {
  id: string;
  status: string;
  createdAt: string;
  notes?: string;
  driver?: {
    id: string;
    name: string;
    phone: string;
  };
  invoice: {
    id: string;
    invoiceNo: string;
    party: {
      name: string;
      phone: string;
      address?: string;
    };
    items: {
      id?: string;
      productId: string;
      warehouseId?: string;
      product: { name: string; unit: string };
      warehouse: { id: string; name: string; address?: string };
      batchNo?: string;
      qty: number;
    }[];
  };
  items?: DeliveryItem[];
}

interface PurchaseItem {
  id: string;
  productId: string;
  product?: { name: string; unit: string };
  warehouseId: string;
  qty: number;
  batchNo?: string;
}

interface Purchase {
  id: string;
  purchaseInvoiceNo?: string;
  supplierName: string;
  purchaseDate: string;
  items: PurchaseItem[];
}

export default function SupervisorDashboard({
  user,
}: {
  user: { id?: string; name?: string; phone?: string; role?: string; scope?: string | null };
}) {
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stockSearch, setStockSearch] = useState('');

  // Item pickup action state
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [pickupBanner, setPickupBanner] = useState<string | null>(null);

  // Stock audit modal
  const [selectedAdjustStock, setSelectedAdjustStock] = useState<StockItem | null>(null);

  const loadData = useCallback(async (force = false) => {
    if (!force) setLoading(true);
    try {
      const [whRes, delivRes, stockRes, purchRes] = await Promise.allSettled([
        apiRequest<Warehouse[]>('/warehouses'),
        apiRequest<Delivery[] | { data: Delivery[] }>('/delivery'),
        apiRequest<StockItem[]>('/stock'),
        apiRequest<Purchase[] | { data: Purchase[] }>('/purchases'),
      ]);

      if (whRes.status === 'fulfilled' && Array.isArray(whRes.value)) {
        const myWh = whRes.value.find((w) => w.id === user?.scope) || whRes.value[0] || null;
        setWarehouse(myWh);
      }

      if (delivRes.status === 'fulfilled') {
        const val = delivRes.value;
        const list = Array.isArray(val) ? val : (val as { data: Delivery[] }).data || [];
        setDeliveries(list);
      }

      if (stockRes.status === 'fulfilled' && Array.isArray(stockRes.value)) {
        setStocks(stockRes.value);
      }

      if (purchRes.status === 'fulfilled') {
        const val = purchRes.value;
        const list = Array.isArray(val) ? val : (val as { data: Purchase[] }).data || [];
        setPurchases(list);
      }
    } catch (err) {
      console.error('Failed to load supervisor dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.scope]);

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData(true);
    window.addEventListener('app:refresh-active-page', handleRefresh);
    return () => window.removeEventListener('app:refresh-active-page', handleRefresh);
  }, [loadData]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  // Stocks for supervisor inspection (backend already sanitized rates)
  const myWarehouseStocks = useMemo(() => {
    return stocks;
  }, [stocks]);

  const filteredWarehouseStocks = useMemo(() => {
    if (!stockSearch) return myWarehouseStocks;
    const term = stockSearch.toLowerCase();
    return myWarehouseStocks.filter(
      (s) =>
        s.product?.name?.toLowerCase().includes(term) ||
        s.product?.category?.toLowerCase().includes(term) ||
        (s.batchNo && s.batchNo.toLowerCase().includes(term))
    );
  }, [myWarehouseStocks, stockSearch]);

  // Deliveries assigned to this supervisor
  const relevantDeliveries = useMemo(() => {
    return deliveries
      .map((d) => {
        const rawItems: DeliveryItem[] =
          d.items && d.items.length > 0
            ? d.items
            : d.invoice.items.map((it) => ({
                invoiceItemId: it.id,
                productId: it.productId,
                productName: it.product?.name || 'Product',
                unit: it.product?.unit || 'unit',
                warehouseId: it.warehouseId || it.warehouse?.id,
                warehouseName: it.warehouse?.name || 'Warehouse',
                warehouseAddress: it.warehouse?.address || '',
                batchNo: it.batchNo,
                qty: it.qty,
                pickedUp: false,
              }));

        const itemsWithIndex = rawItems.map((item, originalIndex) => ({
          item,
          originalIndex,
        }));

        const warehouseItems = itemsWithIndex;

        const allWarehouseItemsPicked =
          warehouseItems.length > 0 && warehouseItems.every((x) => x.item.pickedUp);

        return {
          delivery: d,
          warehouseItems,
          allWarehouseItemsPicked,
        };
      })
      .filter((entry) => entry.warehouseItems.length > 0);
  }, [deliveries]);

  // Active driver pickups (status OUT_FOR_PICKUP or ASSIGNED)
  const activeDriverPickups = useMemo(() => {
    return relevantDeliveries.filter(
      (entry) =>
        entry.delivery.status === 'OUT_FOR_PICKUP' ||
        entry.delivery.status === 'ASSIGNED' ||
        entry.delivery.status === 'PICKED_UP'
    );
  }, [relevantDeliveries]);

  // Items waiting pickup in this warehouse
  const pendingPickupCount = useMemo(() => {
    let count = 0;
    activeDriverPickups.forEach((entry) => {
      entry.warehouseItems.forEach((x) => {
        if (!x.item.pickedUp) count += x.item.qty;
      });
    });
    return count;
  }, [activeDriverPickups]);

  // Supervisor confirms an item pickup
  const handleConfirmItemPickup = async (
    deliveryId: string,
    originalIndex: number,
    productName: string
  ) => {
    const key = `${deliveryId}-${originalIndex}`;
    setUpdatingItemId(key);
    try {
      await apiRequest(`/delivery/${deliveryId}/items/${originalIndex}/pickup`, {
        method: 'PATCH',
        body: JSON.stringify({ pickedUp: true }),
      });
      setPickupBanner(`✓ Marked "${productName}" as picked by you! Driver checklist updated.`);
      await loadData(true);
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to confirm item pickup');
    } finally {
      setUpdatingItemId(null);
    }
  };

  const totalWarehouseUnits = useMemo(() => {
    return myWarehouseStocks.reduce((sum, s) => sum + s.quantity, 0);
  }, [myWarehouseStocks]);

  const uniqueSkus = useMemo(() => {
    return new Set(myWarehouseStocks.map((s) => s.productId)).size;
  }, [myWarehouseStocks]);

  if (loading && !refreshing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50dvh] gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-xs text-muted-foreground font-medium">
          Loading Supervisor Warehouse Cockpit...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-14 text-foreground">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <WarehouseIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  Supervisor Cockpit
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                  Supervisor Duty
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <UserCheck className="h-3 w-3 text-muted-foreground" />
                <span>Supervisor: {user?.name || user?.phone || 'Field Incharge'}</span>
                <span className="text-muted-foreground/60">•</span>
                <span>Assigned Deliveries & Material Inspection</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-card border border-border/80 text-foreground hover:bg-muted text-xs font-semibold shadow-xs transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-primary' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Pickup Banner Notification */}
      {pickupBanner && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs shadow-xs animate-in fade-in">
          <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="flex-1 font-semibold">{pickupBanner}</span>
          <button
            onClick={() => setPickupBanner(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:text-foreground text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Driver Pickups */}
        <div className="p-5 rounded-2xl border border-purple-500/20 bg-card/80 backdrop-blur-xl flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5" />
              Driver Pickups Waiting
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600">
              Active
            </span>
          </div>
          <div className="text-3xl font-extrabold text-foreground mt-3 font-mono">
            {activeDriverPickups.length}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Orders arriving or at your gate for verification
          </p>
        </div>

        {/* Card 2: Units Pending Pickup */}
        <div className="p-5 rounded-2xl border border-amber-500/20 bg-card/80 backdrop-blur-xl flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Units Awaiting Pickup
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600">
              Pending
            </span>
          </div>
          <div className="text-3xl font-extrabold text-foreground mt-3 font-mono">
            {pendingPickupCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Items to physically inspect and mark as picked
          </p>
        </div>

        {/* Card 3: Warehouse Live Stock Units */}
        <div className="p-5 rounded-2xl border border-emerald-500/20 bg-card/80 backdrop-blur-xl flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Boxes className="h-3.5 w-3.5" />
              Total Units Stocked
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
              Inventory
            </span>
          </div>
          <div className="text-3xl font-extrabold text-foreground mt-3 font-mono">
            {totalWarehouseUnits.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Across {uniqueSkus} distinct product designs
          </p>
        </div>

        {/* Card 4: Inbound Purchases */}
        <div className="p-5 rounded-2xl border border-blue-500/20 bg-card/80 backdrop-blur-xl flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShoppingCart className="h-3.5 w-3.5" />
              Inbound Purchases
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600">
              Shipments
            </span>
          </div>
          <div className="text-3xl font-extrabold text-foreground mt-3 font-mono">
            {purchases.length}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Recent factory deliveries received at godown
          </p>
        </div>
      </div>

      {/* SECTION 1: DRIVER PICKUP DISPATCH QUEUE (MAIN WORKFLOW) */}
      <div className="rounded-2xl border border-border/80 bg-card/80 backdrop-blur-xl p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <Truck className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              Driver Pickup Verification Queue
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              When a delivery driver arrives at your warehouse, inspect their packages and confirm pickup below. The driver cannot depart out for delivery until all items are marked picked.
            </p>
          </div>
          <span className="px-3 py-1 rounded-xl text-xs font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 self-start sm:self-center">
            {activeDriverPickups.length} Active Pickups
          </span>
        </div>

        {activeDriverPickups.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-dashed border-border/80 space-y-2">
            <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto" />
            <p className="text-sm font-semibold text-foreground">No Drivers Waiting for Pickup</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              All assigned driver pickups for this warehouse have been completed or no orders are currently out for pickup.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeDriverPickups.map(({ delivery, warehouseItems, allWarehouseItemsPicked }) => {
              const driver = delivery.driver;
              return (
                <div
                  key={delivery.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition ${
                    allWarehouseItemsPicked
                      ? 'bg-emerald-500/5 border-emerald-500/30'
                      : 'bg-muted/30 border-border/80 hover:border-purple-500/30'
                  }`}
                >
                  {/* Delivery Top Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-border/60">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono font-extrabold text-sm text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
                        #{delivery.invoice?.invoiceNo}
                      </span>
                      <span className="font-bold text-sm text-foreground">
                        {delivery.invoice?.party?.name || 'Customer Order'}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          delivery.status === 'OUT_FOR_PICKUP'
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                            : delivery.status === 'ASSIGNED'
                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20'
                            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                        }`}
                      >
                        {delivery.status === 'OUT_FOR_PICKUP' ? 'Driver Arrived / Out for Pickup' : delivery.status}
                      </span>
                    </div>

                    {/* Driver details */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-semibold text-foreground">{driver?.name || 'Assigned Driver'}</span>
                      </div>
                      {driver?.phone && (
                        <a
                          href={`tel:${driver.phone}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline font-mono"
                        >
                          <Phone className="h-3 w-3" />
                          <span>{driver.phone}</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Items Table for this warehouse */}
                  <div className="mt-3 space-y-2">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Packages to Pick from {warehouse?.name || 'this Warehouse'} ({warehouseItems.length} items):
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {warehouseItems.map(({ item, originalIndex }) => {
                        const isUpdating = updatingItemId === `${delivery.id}-${originalIndex}`;
                        const isPicked = Boolean(item.pickedUp);

                        return (
                          <div
                            key={originalIndex}
                            className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isPicked
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-foreground'
                                : 'bg-card border-border/80 text-foreground shadow-2xs'
                            }`}
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-foreground">
                                  {item.productName}
                                </span>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/60">
                                  {item.qty} {item.unit}
                                </span>
                              </div>
                              {item.batchNo && (
                                <p className="text-[11px] text-muted-foreground font-mono">
                                  Batch / Lot: {item.batchNo}
                                </p>
                              )}
                              {isPicked && item.pickedUpAt && (
                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  <span>
                                    Picked {new Date(item.pickedUpAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    {item.pickedUpByName ? ` by ${item.pickedUpByName}` : ''}
                                  </span>
                                </p>
                              )}
                            </div>

                            {/* Action: Supervisor confirms pickup */}
                            <div>
                              {isPicked ? (
                                <div className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1.5 select-none">
                                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                  <span>✓ Verified & Handed Over</span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleConfirmItemPickup(
                                      delivery.id,
                                      originalIndex,
                                      item.productName
                                    )
                                  }
                                  disabled={isUpdating}
                                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 shadow-sm bg-purple-600 hover:bg-purple-700 text-white active:scale-95 disabled:opacity-50"
                                >
                                  {isUpdating ? (
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Boxes className="h-3.5 w-3.5" />
                                  )}
                                  <span>Confirm Handover & Pick</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {allWarehouseItemsPicked && (
                      <div className="pt-1 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>All warehouse items loaded. Driver is cleared to proceed.</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: WAREHOUSE LIVE STOCK & FAST AUDIT */}
      <div className="rounded-2xl border border-border/80 bg-card/80 backdrop-blur-xl p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <Boxes className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Godown Stock Ledger ({warehouse?.name || 'This Warehouse'})
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live quantities available in your warehouse. Audit or adjust physical counts anytime.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products or lots..."
              value={stockSearch}
              onChange={(e) => setStockSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-muted/40 border border-border/80 text-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Stock Table */}
        <div className="overflow-x-auto rounded-xl border border-border/80">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/80">
              <tr>
                <th className="py-2.5 px-4">Product / Design</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Batch / Lot No</th>
                <th className="py-2.5 px-4">Available Quantity</th>
                <th className="py-2.5 px-4 text-right">Stock Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredWarehouseStocks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                    No products found in this warehouse matching your search.
                  </td>
                </tr>
              ) : (
                filteredWarehouseStocks.map((stock) => (
                  <tr key={stock.id} className="hover:bg-muted/30 transition">
                    <td className="py-3 px-4 font-semibold text-foreground">
                      {stock.product?.name || 'Product'}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      <span className="px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/60 text-[11px]">
                        {stock.product?.category || 'General'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-muted-foreground">
                      {stock.batchNo || 'Default Batch'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-bold font-mono text-sm ${
                          stock.quantity <= 0
                            ? 'text-rose-500'
                            : stock.quantity < 10
                            ? 'text-amber-500'
                            : 'text-emerald-500'
                        }`}
                      >
                        {stock.quantity} {stock.product?.unit || 'units'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedAdjustStock(stock)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 border border-primary/20 transition inline-flex items-center gap-1"
                      >
                        <Edit3 className="h-3 w-3" />
                        <span>Audit / Adjust</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: INBOUND PURCHASES (RECEIVING) */}
      <div className="rounded-2xl border border-border/80 bg-card/80 backdrop-blur-xl p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Inbound Purchases & Factory Deliveries
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Goods receipts dispatched to your godown. Verify incoming materials and batches.
            </p>
          </div>
          <span className="px-3 py-1 rounded-xl text-xs font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 self-start sm:self-center">
            {purchases.length} Shipments Received
          </span>
        </div>

        {purchases.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-dashed border-border/80 text-muted-foreground text-xs">
            No inbound purchases recorded for this godown yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {purchases.slice(0, 6).map((purch) => (
              <div
                key={purch.id}
                className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-primary">
                    Bill #{purch.purchaseInvoiceNo || purch.id.slice(0, 8)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {purch.purchaseDate
                      ? new Date(purch.purchaseDate).toLocaleDateString()
                      : 'Recently received'}
                  </span>
                </div>
                <div className="text-xs font-bold text-foreground">
                  Supplier: {purch.supplierName}
                </div>
                <div className="border-t border-border/60 pt-2 space-y-1">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Received Items:
                  </div>
                  {purch.items && purch.items.length > 0 ? (
                    purch.items.map((it, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs text-muted-foreground"
                      >
                        <span className="text-foreground font-medium">
                          {it.product?.name || 'Product'}
                        </span>
                        <span className="font-mono font-bold text-foreground">
                          {it.qty} {it.product?.unit || 'units'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Direct inventory receipt</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stock Adjust Modal */}
      {selectedAdjustStock && (
        <StockAdjustModal
          isOpen={Boolean(selectedAdjustStock)}
          onClose={() => setSelectedAdjustStock(null)}
          onSuccess={async () => {
            await loadData(true);
            setPickupBanner('✓ Stock adjusted successfully!');
          }}
          stock={selectedAdjustStock}
        />
      )}
    </div>
  );
}
