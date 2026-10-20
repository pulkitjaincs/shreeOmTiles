'use client';

import { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '@/lib/api';
import {
  Truck,
  MapPin,
  Phone,
  CheckCircle,
  CircleDollarSign,
  Building2,
  Check,
  Boxes,
  Share2,
  ExternalLink,
  Clock,
  RefreshCw,
  X,
  Wallet,
  AlertCircle,
  ShieldCheck,
  Package,
} from 'lucide-react';

interface DispatchedItem {
  invoiceItemId?: string;
  productId: string;
  productName: string;
  unit: string;
  warehouseName?: string;
  warehouseAddress?: string;
  batchNo?: string;
  qty: number;
  pickedUp?: boolean;
  pickedUpAt?: string;
}

interface DeliverySupervisorRecord {
  id?: string;
  supervisorId: string;
  supervisor?: {
    id: string;
    name: string;
    phone: string;
    role: string;
  };
}

interface Delivery {
  id: string;
  status: string;
  notes?: string;
  amountToCollect?: number;
  cashCollected?: number;
  cashCollectedAt?: string;
  cashHandedOver?: boolean;
  cashHandedOverAt?: string;
  createdAt: string;
  items?: DispatchedItem[];
  supervisors?: DeliverySupervisorRecord[];
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
      product: { name: string; unit: string };
      warehouse?: { name: string; address?: string } | null;
      batchNo?: string;
      qty: number;
    }[];
  };
}

export default function DriverDashboard({ userName }: { userName?: string }) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingIndex, setUpdatingIndex] = useState<number | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Cash Collection Modal State
  const [collectCashDelivery, setCollectCashDelivery] = useState<Delivery | null>(null);
  const [cashAmountInput, setCashAmountInput] = useState<number | ''>('');
  const [cashNotesInput, setCashNotesInput] = useState('');
  const [submittingCash, setSubmittingCash] = useState(false);
  const [cashBanner, setCashBanner] = useState<string | null>(null);

  useEffect(() => {
    loadDeliveries();
    const handleRefresh = () => {
      loadDeliveries();
    };
    window.addEventListener('app:refresh-active-page', handleRefresh);
    return () => window.removeEventListener('app:refresh-active-page', handleRefresh);
  }, []);

  async function loadDeliveries() {
    setLoading(true);
    try {
      const data = await apiRequest<Delivery[]>('/delivery');
      setDeliveries(data);
    } catch (err) {
      console.error('Failed to load driver deliveries', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const [activeDeliveryId, setActiveDeliveryId] = useState<string | null>(null);

  // Active delivery: Currently in pickup, on the way to customer, or awaiting cash collection on current delivery
  const activeDelivery = useMemo(() => {
    if (activeDeliveryId) {
      const found = deliveries.find((d) => d.id === activeDeliveryId);
      if (found && found.status !== 'CANCELLED') return found;
    }
    return deliveries.find(
      (d) =>
        d.status === 'OUT_FOR_PICKUP' ||
        d.status === 'OUT_FOR_DELIVERY' ||
        d.status === 'PICKED_UP' ||
        (d.status === 'DELIVERED' &&
          Number(d.amountToCollect || 0) > 0 &&
          Number(d.cashCollected || 0) === 0)
    );
  }, [deliveries, activeDeliveryId]);

  // Assigned deliveries waiting for driver to click "Out for Pickup"
  const pendingAssigned = useMemo(() => {
    return deliveries.filter((d) => d.status === 'ASSIGNED');
  }, [deliveries]);

  // Lock item pickup once picked
  const handleToggleItemPickup = async (
    deliveryId: string,
    itemIndex: number,
    currentPicked: boolean
  ) => {
    if (currentPicked) return; // Requirement: Once picked up, cannot mark as not picked (locked)
    setUpdatingIndex(itemIndex);
    try {
      await apiRequest(`/delivery/${deliveryId}/items/${itemIndex}/pickup`, {
        method: 'PATCH',
        body: JSON.stringify({ pickedUp: true }),
      });
      await loadDeliveries();
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to update item pickup status');
    } finally {
      setUpdatingIndex(null);
    }
  };

  // Update status (e.g., ASSIGNED -> OUT_FOR_PICKUP, or OUT_FOR_PICKUP -> OUT_FOR_DELIVERY, or -> DELIVERED)
  const handleStatusChange = async (deliveryId: string, newStatus: string) => {
    setStatusUpdating(true);
    try {
      const updated = await apiRequest<Delivery>(`/delivery/${deliveryId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      await loadDeliveries();

      // Requirement: Once delivered, prompt "Collect Cash" ONLY if amountToCollect > 0
      if (newStatus === 'DELIVERED') {
        const target = deliveries.find((d) => d.id === deliveryId) || updated;
        if (Number(target.amountToCollect || 0) > 0) {
          openCollectCashModal(target);
        }
      }
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to update delivery status');
    } finally {
      setStatusUpdating(false);
    }
  };

  // Open modal to record collected cash
  const openCollectCashModal = (delivery: Delivery) => {
    setCollectCashDelivery(delivery);
    const expectedAmount = Number(delivery.amountToCollect || 0);
    const alreadyCollected = Number(delivery.cashCollected || 0);
    // Pre-fill with remaining amount or expected amount
    setCashAmountInput(alreadyCollected > 0 ? alreadyCollected : expectedAmount > 0 ? expectedAmount : '');
    setCashNotesInput('');
  };

  // Submit cash collection
  const handleRecordCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectCashDelivery) return;

    const amt = Number(cashAmountInput || 0);
    if (isNaN(amt) || amt < 0) {
      alert('Please enter a valid cash amount');
      return;
    }

    setSubmittingCash(true);
    try {
      await apiRequest(`/delivery/${collectCashDelivery.id}/collect-cash`, {
        method: 'PATCH',
        body: JSON.stringify({
          amount: amt,
          notes: cashNotesInput.trim() || undefined,
        }),
      });

      setCashBanner(
        `✓ Cash of ₹${amt.toFixed(2)} recorded for Invoice #${collectCashDelivery.invoice.invoiceNo}! You are carrying this cash in your custody.`
      );
      setCollectCashDelivery(null);
      setActiveDeliveryId(null);
      await loadDeliveries();
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to record collected cash');
    } finally {
      setSubmittingCash(false);
    }
  };

  // Flat item list with originalIndex for tracking pickup
  const checklistItems = useMemo(() => {
    if (!activeDelivery) return [];

    const items: DispatchedItem[] =
      activeDelivery.items && activeDelivery.items.length > 0
        ? activeDelivery.items
        : activeDelivery.invoice.items.map((it) => ({
            invoiceItemId: it.id,
            productId: it.productId,
            productName: it.product?.name || 'Product',
            unit: it.product?.unit || 'unit',
            batchNo: it.batchNo,
            qty: it.qty,
            pickedUp: false,
          }));

    return items.map((item, originalIndex) => ({ item, originalIndex }));
  }, [activeDelivery]);

  const allItemsList = useMemo(() => {
    if (!activeDelivery) return [];
    if (activeDelivery.items && activeDelivery.items.length > 0) {
      return activeDelivery.items;
    }
    return (activeDelivery.invoice?.items || []).map((it) => ({
      productId: it.productId,
      productName: it.product?.name || 'Product',
      unit: it.product?.unit || 'unit',
      warehouseName: it.warehouse?.name || 'Main Warehouse',
      warehouseAddress: it.warehouse?.address || '',
      batchNo: it.batchNo,
      qty: it.qty,
      pickedUp: false,
    }));
  }, [activeDelivery]);

  const pickedCount = allItemsList.filter((i) => i.pickedUp).length;
  const totalItemsCount = allItemsList.length;

  // Requirement: ALL items must be picked by driver before "Out for Delivery" option appears
  const allPickedUp = totalItemsCount > 0 && pickedCount === totalItemsCount;

  // Total cash currently in driver custody (not yet handed over to office)
  const totalCashInCustody = useMemo(() => {
    return deliveries
      .filter((d) => !d.cashHandedOver)
      .reduce((sum, d) => sum + Number(d.cashCollected || 0), 0);
  }, [deliveries]);

  if (loading && !refreshing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50dvh] gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-[0.8125rem] text-muted-foreground font-medium">Loading driver dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 transition-colors">
      {/* Driver Welcome Header & Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-[1.5rem] font-bold text-foreground tracking-tight">
              Driver Operations Dashboard
            </h1>
          </div>
          <p className="text-[0.8125rem] text-muted-foreground mt-1">
            Logged in as <span className="text-foreground font-semibold">{userName || 'Driver'}</span>. Active route, warehouse pickups & customer cash collections.
          </p>
        </div>
      </div>

      {/* Cash Collection Success Banner */}
      {cashBanner && (
        <div className="flex items-center gap-3 p-4 rounded-[1rem] bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[0.8125rem] shadow-xs animate-in fade-in">
          <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="flex-1 font-semibold">{cashBanner}</span>
          <button
            onClick={() => setCashBanner(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Top Status Cards: Strictly The Total Cash and The Pickup in Current Delivery */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Pickup in Current Delivery (Mission Status, Pickup Progress & Cash to Collect) */}
        <div className="p-5 rounded-[1.25rem] border border-primary/25 bg-card/75 backdrop-blur-xl flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[0.75rem] font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                <Boxes className="h-4 w-4" />
                Pickup in Current Delivery
              </span>
              {activeDelivery && (
                <span className={`text-[0.6875rem] font-bold px-2.5 py-0.5 rounded-full ${
                  allPickedUp
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-primary/10 text-primary border border-primary/20'
                }`}>
                  {pickedCount}/{totalItemsCount} Picked
                </span>
              )}
            </div>
            <div className="text-[1.125rem] font-bold text-foreground mt-2">
              {activeDelivery
                ? activeDelivery.status === 'OUT_FOR_PICKUP'
                  ? `Warehouse Pickup (${pickedCount}/${totalItemsCount} Picked)`
                  : activeDelivery.status === 'OUT_FOR_DELIVERY'
                  ? 'Out for Delivery (All Items Loaded)'
                  : 'Delivered • Ready to Collect Cash'
                : pendingAssigned.length > 0
                ? 'Assigned • Ready for Pickup'
                : 'Standby / Ready'}
            </div>
            <p className="text-[0.8125rem] text-muted-foreground mt-1">
              {activeDelivery
                ? `Invoice #${activeDelivery.invoice?.invoiceNo} • ${activeDelivery.invoice?.party?.name}`
                : pendingAssigned.length > 0
                ? `${pendingAssigned.length} order(s) waiting to start pickup`
                : 'Waiting for dispatch assignment'}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-border/70 flex items-center justify-between text-[0.75rem]">
            <span className="text-muted-foreground">Cash to collect from customer:</span>
            <span className={`font-bold ${
              activeDelivery && Number(activeDelivery.amountToCollect || 0) > 0
                ? 'text-amber-600 dark:text-amber-400 font-mono text-[0.875rem]'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {activeDelivery && Number(activeDelivery.amountToCollect || 0) > 0
                ? `₹${Number(activeDelivery.amountToCollect).toFixed(2)}`
                : '₹0.00 (Prepaid / Settled at Counter)'}
            </span>
          </div>
        </div>

        {/* 2. Total Cash to Hand Over to Owner */}
        <div className="p-5 rounded-[1.25rem] border border-emerald-500/25 bg-emerald-500/5 backdrop-blur-xl flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[0.75rem] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Wallet className="h-4 w-4" />
                Total Cash to Hand Over to Director
              </span>
              <span
                className={`text-[0.6875rem] font-bold px-2.5 py-0.5 rounded-full ${
                  totalCashInCustody > 0
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                }`}
              >
                {totalCashInCustody > 0 ? 'Pending Office Handover' : 'All Settled'}
              </span>
            </div>
            <div className="text-[1.5rem] font-black text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
              ₹{totalCashInCustody.toFixed(2)}
            </div>
            <p className="text-[0.75rem] text-muted-foreground mt-1">
              {totalCashInCustody > 0
                ? 'Physical cash in hand to be granted & handed over to director.'
                : 'All cash collections granted & settled with director.'}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-emerald-500/20 flex items-center justify-between text-[0.75rem] text-muted-foreground">
            <span>Status with Director:</span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">
              {totalCashInCustody > 0
                ? `₹${totalCashInCustody.toFixed(2)} to be granted to director`
                : 'Up to date with office'}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 1: CURRENT ACTIVE DELIVERY (THE COCKPIT) */}
      {activeDelivery && (
        <div className="rounded-[1.5rem] border border-primary/25 bg-card/85 backdrop-blur-2xl p-[clamp(1rem,2.5vw,2rem)] shadow-lg space-y-6">
          {/* Active Mission Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/80 pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-[0.6875rem] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 shadow-2xs ${
                    activeDelivery.status === 'OUT_FOR_PICKUP'
                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                      : activeDelivery.status === 'DELIVERED'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-primary/10 text-primary border border-primary/20'
                  }`}
                >
                  {activeDelivery.status === 'OUT_FOR_PICKUP' ? (
                    <>
                      <Boxes className="h-3.5 w-3.5 text-purple-500" />
                      TASK 1: WAREHOUSE PICKUP IN PROGRESS
                    </>
                  ) : activeDelivery.status === 'DELIVERED' ? (
                    <>
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                      TASK COMPLETED: ORDER DELIVERED
                    </>
                  ) : (
                    <>
                      <Truck className="h-3.5 w-3.5 text-primary" />
                      TASK 2: ON THE WAY TO CUSTOMER (OUT FOR DELIVERY)
                    </>
                  )}
                </span>
                <span className="font-mono text-[0.875rem] font-semibold text-muted-foreground">
                  #{activeDelivery.invoice.invoiceNo}
                </span>
              </div>
              <p className="text-[0.75rem] text-muted-foreground">
                {activeDelivery.status === 'OUT_FOR_PICKUP'
                  ? 'Visit the designated warehouses below. The warehouse supervisor will inspect and mark items as picked before you can depart for delivery.'
                  : activeDelivery.status === 'DELIVERED'
                  ? Number(activeDelivery.amountToCollect || 0) > 0 && Number(activeDelivery.cashCollected || 0) === 0
                    ? 'Delivery handed over to customer. Please collect the pending cash balance below.'
                    : 'Order successfully delivered and settled.'
                  : 'All packages loaded on vehicle! Proceed to customer address for delivery handover.'}
              </p>
            </div>

            {/* Stage Transition Buttons */}
            <div>
              {activeDelivery.status === 'OUT_FOR_PICKUP' ? (
                /* Requirement: Driver ONLY gets "Out for Delivery" option once ALL assigned items are picked */
                allPickedUp ? (
                  <button
                    onClick={() => {
                      setActiveDeliveryId(activeDelivery.id);
                      void handleStatusChange(activeDelivery.id, 'OUT_FOR_DELIVERY');
                    }}
                    disabled={statusUpdating}
                    className="w-full md:w-auto px-5 py-2.5 rounded-[0.75rem] bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-[0.75rem] transition inline-flex items-center justify-center gap-2 shadow-md animate-pulse active:scale-98"
                    title="All warehouse items have been picked! Click to proceed out for delivery."
                  >
                    <Truck className="h-4 w-4" />
                    All Items Picked Up → Out for Delivery
                  </button>
                ) : (
                  /* Requirement: Before that, they should NOT have it */
                  <div className="px-3.5 py-2 rounded-[0.75rem] bg-muted/60 border border-border text-muted-foreground text-[0.75rem] font-medium flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                    <span>
                      Pick all items to unlock &quot;Out for Delivery&quot; ({pickedCount}/{totalItemsCount})
                    </span>
                  </div>
                )
              ) : activeDelivery.status === 'DELIVERED' ? (
                /* Requirement: Current delivery delivered and has amount > 0: Collect Cash */
                Number(activeDelivery.amountToCollect || 0) > 0 && Number(activeDelivery.cashCollected || 0) === 0 ? (
                  <button
                    onClick={() => openCollectCashModal(activeDelivery)}
                    className="w-full md:w-auto px-5 py-2.5 rounded-[0.75rem] bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[0.75rem] transition inline-flex items-center justify-center gap-2 shadow-md shadow-emerald-600/30 animate-pulse active:scale-98"
                  >
                    <CircleDollarSign className="h-4 w-4" />
                    Collect Cash (₹{Number(activeDelivery.amountToCollect).toFixed(2)})
                  </button>
                ) : (
                  <div className="px-4 py-2 rounded-[0.75rem] bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold text-[0.75rem] flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    Delivered & Settled
                  </div>
                )
              ) : (
                /* Out for delivery stage: Click "Delivered" */
                <button
                  onClick={async () => {
                    setActiveDeliveryId(activeDelivery.id);
                    await handleStatusChange(activeDelivery.id, 'DELIVERED');
                    if (Number(activeDelivery.amountToCollect || 0) <= 0) {
                      setActiveDeliveryId(null);
                    }
                  }}
                  disabled={statusUpdating}
                  className="w-full md:w-auto px-5 py-2.5 rounded-[0.75rem] bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[0.75rem] transition inline-flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-98"
                >
                  <CheckCircle className="h-4 w-4" />
                  Mark as Delivered
                </button>
              )}
            </div>
          </div>

          {/* Customer & Destination Details Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Receiver Info */}
            <div className="p-4 rounded-[1.25rem] bg-muted/40 border border-border space-y-3">
              <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                Customer & Delivery Destination
              </div>
              <div>
                <div className="text-[1rem] font-bold text-foreground">
                  {activeDelivery.invoice.party.name}
                </div>
                <div className="text-[0.75rem] text-muted-foreground mt-1 flex items-start gap-1.5">
                  <span className="shrink-0">📍</span>
                  <span>{activeDelivery.invoice.party.address || 'Counter Pickup'}</span>
                </div>
                <div className="text-[0.75rem] text-muted-foreground mt-1 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{activeDelivery.invoice.party.phone}</span>
                </div>
              </div>

              {/* Direct Communication Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  href={`tel:${activeDelivery.invoice.party.phone.replace(/[^0-9]/g, '')}`}
                  className="px-3 py-1.5 rounded-[0.625rem] bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/20 text-[0.6875rem] font-semibold transition inline-flex items-center gap-1.5"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Call Customer
                </a>

                <a
                  href={`https://wa.me/91${activeDelivery.invoice.party.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `Hello ${activeDelivery.invoice.party.name}, I am your delivery driver for Invoice #${activeDelivery.invoice.invoiceNo}. I am on my way to deliver your items.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-[0.625rem] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[0.6875rem] font-semibold transition inline-flex items-center gap-1.5"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  WhatsApp
                </a>

                {activeDelivery.invoice.party.address && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      activeDelivery.invoice.party.address
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-[0.625rem] bg-card hover:bg-muted text-foreground border border-border text-[0.6875rem] font-semibold transition inline-flex items-center gap-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    Open Maps
                  </a>
                )}
              </div>
            </div>

            {/* Cash Collection Banner */}
            <div
              className={`p-4 rounded-[1.25rem] border flex flex-col justify-between ${
                Number(activeDelivery.amountToCollect || 0) > 0
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
              }`}
            >
              <div>
                <div className="text-[0.6875rem] font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <CircleDollarSign className="h-4 w-4" />
                  Cash to Collect from Customer
                </div>
                <div className="text-[1.5rem] font-black tracking-tight mt-1">
                  {Number(activeDelivery.amountToCollect || 0) > 0
                    ? `₹${Number(activeDelivery.amountToCollect).toFixed(2)} CASH`
                    : '✓ PREPAID — COLLECT ₹0'}
                </div>
              </div>
              <p className="text-[0.75rem] mt-3 opacity-90">
                {Number(activeDelivery.amountToCollect || 0) > 0
                  ? '⚠️ Once delivered, click "Collect Cash" to enter the exact cash received and carry it with you.'
                  : '✓ This invoice has already been settled. Do not collect any cash from receiver.'}
              </p>
            </div>
          </div>

          {/* Assigned Supervisor(s) Contact Coordinator Card */}
          {activeDelivery.supervisors && activeDelivery.supervisors.length > 0 && (
            <div className="p-4 rounded-[1.25rem] bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-3">
              <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                Assigned Dispatch Supervisor(s)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeDelivery.supervisors.map((sRec, sIdx) => {
                  const sup = sRec.supervisor;
                  if (!sup) return null;
                  return (
                    <div
                      key={sIdx}
                      className="p-3 rounded-xl bg-card border border-border flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="space-y-0.5">
                        <div className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          <span>{sup.name}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-indigo-500/10 text-indigo-600">
                            Supervisor
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span>{sup.phone}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${sup.phone.replace(/[^0-9]/g, '')}`}
                          className="p-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/20 transition"
                          title={`Call ${sup.name}`}
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                        <a
                          href={`https://wa.me/91${sup.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                            `Hello ${sup.name}, I am your driver for Invoice #${activeDelivery.invoice.invoiceNo}. I am coordinating pickup of the items.`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 transition"
                          title={`WhatsApp ${sup.name}`}
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ITEM PICKUP CHECKLIST (SUPERVISOR CONFIRMATION) */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 pb-3">
              <div>
                <h3 className="text-[0.875rem] font-bold text-foreground flex items-center gap-2">
                  <Package className="h-4 w-4 text-purple-500" />
                  Item Pickup Checklist (Awaiting Supervisor Confirmation)
                </h3>
                <p className="text-[0.75rem] text-muted-foreground mt-0.5">
                  Coordinate with the assigned supervisor. The supervisor will inspect and mark items as verified in the system.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[0.75rem] font-semibold text-muted-foreground">
                  Pickup Progress:
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[0.6875rem] font-bold ${
                    allPickedUp
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-primary/10 text-primary border border-primary/20'
                  }`}
                >
                  {pickedCount} of {totalItemsCount} Picked
                </span>
              </div>
            </div>

            {/* Checklist items */}
            <div className="space-y-2">
              {checklistItems.map(({ item, originalIndex }) => {
                const isPicked = Boolean(item.pickedUp);

                return (
                  <div
                    key={originalIndex}
                    className={`p-3.5 rounded-[1rem] border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                      isPicked
                        ? 'bg-emerald-500/5 border-emerald-500/25 text-foreground'
                        : 'bg-muted/30 border-border text-foreground hover:border-primary/40'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[0.875rem] font-bold text-foreground">
                          {item.productName}
                        </span>
                        <span className="text-[0.6875rem] font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border">
                          {item.qty} {item.unit}
                        </span>
                      </div>
                      {item.batchNo && (
                        <div className="text-[0.6875rem] text-muted-foreground">
                          Lot / Batch Number: <span className="font-mono text-foreground">{item.batchNo}</span>
                        </div>
                      )}
                      {item.pickedUpAt && (
                        <div className="text-[0.625rem] text-emerald-600 dark:text-emerald-400">
                          Picked up at {new Date(item.pickedUpAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>

                    <div>
                      {isPicked ? (
                        <div
                          className="px-3.5 py-2 rounded-[0.75rem] text-[0.75rem] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 inline-flex items-center gap-1.5 select-none opacity-90"
                          title="Item verified and pickup confirmed by Supervisor."
                        >
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                          <span>✓ Verified by Supervisor</span>
                        </div>
                      ) : (
                        <div
                          className="px-3.5 py-2 rounded-[0.75rem] text-[0.75rem] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 inline-flex items-center gap-1.5 select-none"
                          title="Coordinate with the assigned supervisor to confirm pickup."
                        >
                          <Clock className="h-3.5 w-3.5 text-amber-500" />
                          <span>Awaiting Supervisor Confirmation</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: NEW DELIVERIES ASSIGNED AND WAITING FOR DRIVER TO ACCEPT */}
      {pendingAssigned.length > 0 && (
        <div className="rounded-[1.5rem] border border-amber-500/30 bg-card/85 backdrop-blur-xl p-[clamp(1rem,2.5vw,2rem)] space-y-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-[1rem] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-[1.125rem] font-bold text-foreground">
                {activeDelivery
                  ? `Queued Delivery Assignments (${pendingAssigned.length})`
                  : 'You Have an Assigned Delivery Waiting!'}
              </h2>
              <p className="text-[0.75rem] text-muted-foreground">
                {activeDelivery
                  ? 'These deliveries have been pushed to you by the office and are ready once you complete your current route.'
                  : 'Click "Accept & Start Pickup" below to accept this assignment and begin warehouse collections.'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {pendingAssigned.map((d) => (
              <div
                key={d.id}
                className="p-4 rounded-[1.25rem] border border-border bg-muted/30 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-primary text-[0.875rem]">
                      #{d.invoice.invoiceNo}
                    </span>
                    <span className="text-foreground font-bold">{d.invoice.party.name}</span>
                  </div>
                  <div className="text-[0.75rem] text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span>{d.invoice.party.address || 'Counter Pickup'}</span>
                  </div>
                  {Number(d.amountToCollect || 0) > 0 ? (
                    <div className="text-[0.75rem] font-semibold text-amber-600 dark:text-amber-400">
                      💰 Cash to collect: ₹{Number(d.amountToCollect).toFixed(2)}
                    </div>
                  ) : (
                    <div className="text-[0.75rem] text-muted-foreground">✓ Prepaid Order (₹0)</div>
                  )}
                </div>

                <div>
                  <button
                    onClick={() => handleStatusChange(d.id, 'OUT_FOR_PICKUP')}
                    disabled={statusUpdating}
                    className="w-full md:w-auto px-4 py-2.5 rounded-[0.75rem] bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-[0.75rem] transition inline-flex items-center justify-center gap-2 shadow-xs active:scale-98"
                  >
                    <Boxes className="h-4 w-4" />
                    Accept & Start Pickup (Out for Pickup)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 3: ALL CLEAR / NO ACTIVE DELIVERIES */}
      {!activeDelivery && pendingAssigned.length === 0 && (
        <div className="p-10 rounded-[1.5rem] border border-border bg-card/60 backdrop-blur-xl text-center space-y-3 shadow-xs">
          <div className="h-12 w-12 rounded-[1rem] bg-muted text-muted-foreground flex items-center justify-center mx-auto">
            <Truck className="h-6 w-6" />
          </div>
          <h3 className="text-[1rem] font-bold text-foreground">No Active Deliveries Right Now</h3>
          <p className="text-[0.75rem] text-muted-foreground max-w-md mx-auto">
            You are not currently on a delivery run. Once the admin or director assigns an order and pushes it to you, it will appear here instantly.
          </p>
        </div>
      )}

      {/* COLLECT CASH MODAL */}
      {collectCashDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-[28rem] max-h-[88dvh] overflow-y-auto rounded-[1.5rem] border border-border bg-card p-[clamp(1.25rem,2vw,1.75rem)] shadow-2xl space-y-5 text-foreground">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-[0.75rem] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CircleDollarSign className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-[1rem] font-bold text-foreground">Collect Cash from Customer</h2>
                  <p className="text-[0.75rem] text-muted-foreground">
                    Invoice #{collectCashDelivery.invoice.invoiceNo}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCollectCashDelivery(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRecordCash} className="space-y-4">
              {/* Customer & Expected Amount Box */}
              <div className="p-3.5 rounded-[1rem] bg-muted/40 border border-border space-y-1.5 text-[0.75rem]">
                <div className="flex justify-between text-muted-foreground">
                  <span>Customer:</span>
                  <span className="font-semibold text-foreground">
                    {collectCashDelivery.invoice.party.name}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Target Amount:</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    ₹{Number(collectCashDelivery.amountToCollect || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Exact Amount Input */}
              <div>
                <label className="block text-[0.75rem] font-semibold text-foreground mb-1.5">
                  Exact Cash Amount Collected (₹) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={cashAmountInput}
                    onChange={(e) =>
                      setCashAmountInput(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full pl-8 pr-4 py-2.5 rounded-[0.75rem] border border-input bg-background text-foreground font-mono font-bold text-[1rem] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-xs"
                    autoFocus
                  />
                </div>
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-[0.75rem] font-medium text-muted-foreground mb-1">
                  Collection Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid exact cash / short ₹50"
                  value={cashNotesInput}
                  onChange={(e) => setCashNotesInput(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-[0.75rem] border border-input bg-background text-[0.75rem] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* Custody Warning Note */}
              <div className="p-3 rounded-[0.75rem] bg-amber-500/10 border border-amber-500/20 text-[0.6875rem] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <span>
                  You will carry this cash with you in your custody. Hand over the physical cash to the cashier or director at the office upon return.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setCollectCashDelivery(null)}
                  className="px-4 py-2 rounded-[0.75rem] bg-muted hover:bg-muted/80 text-foreground text-[0.75rem] font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCash}
                  className="px-5 py-2 rounded-[0.75rem] bg-emerald-600 hover:bg-emerald-500 text-white text-[0.75rem] font-bold transition inline-flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-98"
                >
                  <CircleDollarSign className="h-4 w-4" />
                  {submittingCash ? 'Recording...' : 'Confirm Cash Collection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
