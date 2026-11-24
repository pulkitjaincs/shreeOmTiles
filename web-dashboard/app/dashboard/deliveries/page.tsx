'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { apiRequest, cachedApiRequest } from '@/lib/api';
import { 
  Share2, 
  X, 
  UserCheck, 
  CheckCircle, 
  Truck, 
  Search, 
  Send, 
  Lock, 
  MapPin, 
  Phone, 
  Check, 
  ArrowRight, 
  CircleDollarSign, 
  Boxes, 
  Wallet, 
  Clock,
  FileText,
  Eye,
  Edit2,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';

import { 
  Delivery, 
  DriverUser, 
  FilterTab, 
  PushSuccessDialogData 
} from '@/components/deliveries/types';
import { DeliveryDetailsModal } from '@/components/deliveries/delivery-details-modal';
import { PushDeliveryModal } from '@/components/deliveries/push-delivery-modal';
import { PushSuccessModal } from '@/components/deliveries/push-success-modal';
import { AddTripModal } from '@/components/deliveries/add-trip-modal';
import { formatINR, cleanPhoneNumber, formatDate } from '@/lib/formatters';
import { TablePagination } from '@/components/ui/table-pagination';

export default function DeliveriesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isDriver = user?.role === 'DRIVER';
  const isSupervisor = user?.role === 'SUPERVISOR';
  const isOwnerOrAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const isSalesman = user?.role === 'SALESMAN';
  const isAccountant = user?.role === 'ACCOUNTANT';
  const isViewOnly = isSalesman || isAccountant || isSupervisor;

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [drivers, setDrivers] = useState<DriverUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeFilter, setActiveFilter] = useState<FilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [detailsModalDelivery, setDetailsModalDelivery] = useState<Delivery | null>(null);
  const [pushModalDelivery, setPushModalDelivery] = useState<Delivery | null>(null);
  const [pushSuccessDialog, setPushSuccessDialog] = useState<PushSuccessDialogData | null>(null);
  const [activeDeliveryId, setActiveDeliveryId] = useState<string | null>(null);
  const [submittingHandover, setSubmittingHandover] = useState<string | null>(null);
  const [downloadingChallanId, setDownloadingChallanId] = useState<string | null>(null);

  const handleDownloadChallan = async (deliveryId: string, invoiceNo?: string) => {
    setDownloadingChallanId(deliveryId);
    try {
      const blob = await apiRequest<Blob>(`/delivery/${deliveryId}/challan-pdf`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Delivery-Challan-${invoiceNo || deliveryId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to download delivery challan');
    } finally {
      setDownloadingChallanId(null);
    }
  };

  useEffect(() => {
    loadDeliveries();
    if (isOwnerOrAdmin) {
      loadDrivers();
    }
    const handleRefresh = () => {
      loadDeliveries(true);
      if (isOwnerOrAdmin) loadDrivers();
    };
    window.addEventListener('app:refresh-active-page', handleRefresh);
    return () => window.removeEventListener('app:refresh-active-page', handleRefresh);
  }, [isOwnerOrAdmin]);

  async function loadDeliveries(force = false) {
    try {
      const data = await cachedApiRequest<Delivery[]>('/delivery', {
        forceRefresh: force,
        onRevalidate: (fresh) => setDeliveries(fresh),
      });
      setDeliveries(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadDrivers(force = false) {
    try {
      const data = await cachedApiRequest<DriverUser[]>('/users?role=DRIVER&isActive=true', {
        forceRefresh: force,
        onRevalidate: (fresh) => setDrivers(fresh),
      });
      setDrivers(data);
    } catch {
      // Ignore if non-owner
    }
  }

  const counts = useMemo(() => {
    const total = deliveries.length;
    const pending = deliveries.filter(
      (d) => d.status === 'PENDING' || d.status === 'ASSIGNED',
    ).length;
    const outForPickup = deliveries.filter((d) => d.status === 'OUT_FOR_PICKUP').length;
    const outForDelivery = deliveries.filter(
      (d) => d.status === 'OUT_FOR_DELIVERY' || d.status === 'PICKED_UP',
    ).length;
    const delivered = deliveries.filter((d) => d.status === 'DELIVERED').length;
    const cancelled = deliveries.filter((d) => d.status === 'CANCELLED').length;
    return { total, pending, outForPickup, outForDelivery, delivered, cancelled };
  }, [deliveries]);

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      if (activeFilter === 'PENDING') {
        if (d.status !== 'PENDING' && d.status !== 'ASSIGNED') return false;
      } else if (activeFilter === 'OUT_FOR_PICKUP') {
        if (d.status !== 'OUT_FOR_PICKUP') return false;
      } else if (activeFilter === 'OUT_FOR_DELIVERY') {
        if (d.status !== 'OUT_FOR_DELIVERY' && d.status !== 'PICKED_UP') return false;
      } else if (activeFilter === 'DELIVERED') {
        if (d.status !== 'DELIVERED') return false;
      } else if (activeFilter === 'CANCELLED') {
        if (d.status !== 'CANCELLED') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const invNo = d.invoice?.invoiceNo?.toLowerCase() || '';
        const partyName = d.invoice?.party?.name?.toLowerCase() || '';
        const partyPhone = d.invoice?.party?.phone || '';
        const partyAddr = d.invoice?.party?.address?.toLowerCase() || '';
        const driverName = d.driver?.name?.toLowerCase() || '';
        return (
          invNo.includes(q) ||
          partyName.includes(q) ||
          partyPhone.includes(q) ||
          partyAddr.includes(q) ||
          driverName.includes(q)
        );
      }

      return true;
    });
  }, [deliveries, activeFilter, searchQuery]);

  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [prevFilterKey, setPrevFilterKey] = useState(`${searchQuery}_${activeFilter}`);
  const currentFilterKey = `${searchQuery}_${activeFilter}`;
  if (currentFilterKey !== prevFilterKey) {
    setPrevFilterKey(currentFilterKey);
    setCurrentPage(1);
  }

  const paginatedDeliveries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDeliveries.slice(start, start + pageSize);
  }, [filteredDeliveries, currentPage, pageSize]);

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await apiRequest(`/delivery/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      loadDeliveries();
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to update status');
    }
  };


  const handleCollectCashFromDriver = async (deliveryId: string) => {
    if (!confirm('Confirm receipt of physical cash from the driver into company office?')) {
      return;
    }
    setSubmittingHandover(deliveryId);
    try {
      await apiRequest(`/delivery/${deliveryId}/handover-cash`, {
        method: 'PATCH',
        body: JSON.stringify({}),
      });
      await loadDeliveries();
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to confirm cash collection from driver');
    } finally {
      setSubmittingHandover(null);
    }
  };

  const handleShareWithDriver = (delivery: Delivery) => {
    const inv = delivery.invoice;
    const party = inv.party;
    const dateStr = formatDate(delivery.createdAt);

    const activeItems =
      delivery.items && delivery.items.length > 0
        ? delivery.items
        : delivery.invoice.items.map((it) => ({
            productId: it.productId,
            productName: it.product?.name || 'Item',
            unit: it.product?.unit || 'units',
            warehouseName: it.warehouse?.name || 'Warehouse',
            warehouseAddress: it.warehouse?.address || '',
            batchNo: it.batchNo,
            qty: it.qty,
          }));

    const itemsList = activeItems
      .map((item, idx) => {
        const whName = item.warehouseName || 'Warehouse';
        const whAddr = item.warehouseAddress ? ` (${item.warehouseAddress})` : '';
        const batch = item.batchNo ? ` [Lot/Batch: ${item.batchNo}]` : '';
        return `${idx + 1}. *${item.productName || 'Item'}* — *${item.qty} ${item.unit || 'units'}*\n   📍 *Pick from:* ${whName}${whAddr}${batch}`;
      })
      .join('\n\n');

    const isPaid =
      inv.status === 'PAID' ||
      inv.status === 'CANCELLED' ||
      delivery.cashHandedOver === true;
    const toCollect = isPaid ? 0 : Number(delivery.amountToCollect || 0);
    const paymentLine =
      !isPaid && toCollect > 0
        ? `💵 *AMOUNT TO COLLECT FROM CUSTOMER:* *₹${toCollect.toFixed(2)}* (Please collect from customer before delivering)`
        : `💵 *AMOUNT TO COLLECT:* *₹0 (Prepaid / Already Settled)*`;

    const msg = `📦 *DELIVERY ASSIGNMENT — OUT FOR PICKUP*
*Invoice:* #${inv.invoiceNo}
*Date:* ${dateStr}

${paymentLine}

👤 *RECEIVER DETAILS:*
• *Customer Name:* ${party.name}
• *Phone:* ${party.phone}
• *Delivery Address:* ${party.address || 'Counter Pickup / Direct Delivery'}

🏭 *ITEMS TO PICK UP FROM WAREHOUSES:*
${itemsList}

⏰ *Next Steps:*
1. Reach respective warehouses and pick up each item.
2. Mark items as picked up on your mobile app.
3. Once collected, deliver to the customer and collect specified payment.`;

    const cleanPhone = cleanPhoneNumber(delivery.driver?.phone);
    const url = cleanPhone
      ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" />
            {isDriver ? 'My Assigned Deliveries' : 'Delivery Dispatch & Logistics'}
            {isViewOnly && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                View Only
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isDriver
              ? 'Clean overview of delivery orders assigned to your route. Click "Out for Pickup" or "Go to Active Dashboard" to manage warehouse collections.'
              : 'Assign delivery drivers, push pickup assignments, track multi-warehouse collection progress, and manage customer collections.'}
          </p>
        </div>
        {isDriver && (
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-[0.75rem] bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm active:scale-98"
          >
            Go to Active Dashboard <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* Filter Tabs & Search Bar Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/75 backdrop-blur-xl border border-border/60 p-3 rounded-[1rem] shadow-xs">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setActiveFilter('ALL')}
            className={`px-3 py-1.5 rounded-[0.625rem] text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeFilter === 'ALL'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <span>All</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[0.625rem] ${
                activeFilter === 'ALL' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {counts.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('PENDING')}
            className={`px-3 py-1.5 rounded-[0.625rem] text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeFilter === 'PENDING'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <span>{isDriver ? 'Ready for Pickup' : 'Pending Dispatch'}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[0.625rem] ${
                activeFilter === 'PENDING' ? 'bg-black/20 text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              {counts.pending}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('OUT_FOR_PICKUP')}
            className={`px-3 py-1.5 rounded-[0.625rem] text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeFilter === 'OUT_FOR_PICKUP'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <span>Out for Pickup</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[0.625rem] ${
                activeFilter === 'OUT_FOR_PICKUP' ? 'bg-black/20 text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              {counts.outForPickup}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('OUT_FOR_DELIVERY')}
            className={`px-3 py-1.5 rounded-[0.625rem] text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeFilter === 'OUT_FOR_DELIVERY'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <span>Out for Delivery</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[0.625rem] ${
                activeFilter === 'OUT_FOR_DELIVERY' ? 'bg-black/20 text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              {counts.outForDelivery}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('DELIVERED')}
            className={`px-3 py-1.5 rounded-[0.625rem] text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeFilter === 'DELIVERED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <span>Delivered</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[0.625rem] ${
                activeFilter === 'DELIVERED' ? 'bg-black/20 text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              {counts.delivered}
            </span>
          </button>

          {counts.cancelled > 0 && (
            <button
              type="button"
              onClick={() => setActiveFilter('CANCELLED')}
              className={`px-3 py-1.5 rounded-[0.625rem] text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeFilter === 'CANCELLED'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <span>Cancelled</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[0.625rem] ${
                  activeFilter === 'CANCELLED' ? 'bg-black/20 text-white' : 'bg-muted text-muted-foreground'
                }`}
              >
                {counts.cancelled}
              </span>
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search invoice, customer, driver..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-xs rounded-[0.625rem] border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Deliveries Table */}
      <div className="rounded-[1rem] border border-border/60 bg-card/75 backdrop-blur-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-muted/40 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Receiver & Destination</th>
                {!isDriver && <th className="py-3 px-4">Items</th>}
                {!isDriver && !isSupervisor && <th className="py-3 px-4">Collect from Customer</th>}
                <th className="py-3 px-4">{isDriver || isSupervisor ? 'Status' : 'Status & Logistics Cost'}</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={isDriver ? 4 : isSupervisor ? 5 : 6} className="text-center py-12 text-muted-foreground">
                    Loading deliveries...
                  </td>
                </tr>
              ) : filteredDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={isDriver ? 4 : isSupervisor ? 5 : 6} className="text-center py-12 text-muted-foreground">
                    {searchQuery
                      ? 'No deliveries matched your search filter.'
                      : activeFilter === 'PENDING'
                      ? isDriver
                        ? 'No orders waiting for pickup.'
                        : 'No pending deliveries waiting for dispatch.'
                      : activeFilter === 'OUT_FOR_PICKUP'
                      ? 'No deliveries currently out for warehouse pickup.'
                      : activeFilter === 'OUT_FOR_DELIVERY'
                      ? 'No deliveries currently on the way to customers.'
                      : activeFilter === 'DELIVERED'
                      ? 'No completed deliveries found.'
                      : 'No deliveries recorded yet.'}
                  </td>
                </tr>
              ) : (
                paginatedDeliveries.map((delivery) => {
                  const totalTripCost =
                    delivery.trips?.reduce((sum, t) => sum + Number(t.cost || 0), 0) || 0;
                  const isDriverAssigned = Boolean(delivery.driverId);
                  const isDelivered = delivery.status === 'DELIVERED';
                  const isCancelled = delivery.status === 'CANCELLED';
                  const isOutForPickup = delivery.status === 'OUT_FOR_PICKUP';
                  const isOutForDelivery =
                    delivery.status === 'OUT_FOR_DELIVERY' || delivery.status === 'PICKED_UP';
                  const isAssignedToDriver = delivery.status === 'ASSIGNED';
                  const isCustomerPickup =
                    (delivery.status === 'DELIVERED' && !delivery.driverId) ||
                    Boolean(delivery.notes && /customer\s*picked\s*up|self-pickup|counter\s*pickup/i.test(delivery.notes));
                  const isPendingPush =
                    delivery.status === 'PENDING' &&
                    !isDelivered &&
                    !isCancelled &&
                    !isCustomerPickup;

                  return (
                    <tr key={delivery.id} className="hover:bg-muted/30 transition-colors">
                      {/* Invoice No */}
                      <td className="py-3.5 px-4 font-mono font-medium text-primary align-top">
                        {delivery.invoice?.invoiceNo || 'N/A'}
                        <div className="text-[0.625rem] text-muted-foreground font-sans mt-0.5">
                          {formatDate(delivery.createdAt)}
                        </div>
                      </td>

                      {/* Receiver & Destination */}
                      <td className="py-3.5 px-4 font-medium text-foreground max-w-xs align-top">
                        <div>{delivery.invoice?.party?.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span>{delivery.invoice?.party?.phone}</span>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-start gap-1 mt-1 truncate">
                          <MapPin className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                          <span className="truncate" title={delivery.invoice?.party?.address || 'Counter Pickup'}>
                            {delivery.invoice?.party?.address || 'Counter Pickup'}
                          </span>
                        </div>
                      </td>

                      {/* Items Count Badge */}
                      {!isDriver && (
                        <td className="py-3.5 px-4 text-xs align-top">
                          {(() => {
                            const items = delivery.items || [];
                            const picked = items.filter((it) => it.pickedUp).length;
                            const total = items.length;
                            return (
                              <button
                                type="button"
                                onClick={() => setDetailsModalDelivery(delivery)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/60 hover:bg-muted border border-border/60 text-foreground font-medium text-xs transition cursor-pointer"
                                title="Click to view full item list & pickup checklist"
                              >
                                <Boxes className="h-3.5 w-3.5 text-primary" />
                                <span>{total} item{total !== 1 ? 's' : ''}</span>
                                {total > 0 && (
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                                      picked === total
                                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                    }`}
                                  >
                                    {picked}/{total}
                                  </span>
                                )}
                              </button>
                            );
                          })()}
                        </td>
                      )}

                      {/* Cash / Money to Collect from Customer */}
                      {!isDriver && !isSupervisor && (
                        <td className="py-3.5 px-4 align-top">
                          <div className="space-y-1">
                            {Number(delivery.cashCollected || 0) > 0 ? (
                              delivery.cashHandedOver ? (
                                <div>
                                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[0.5rem] bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-bold text-xs" title="Collected from customer and received by office">
                                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    <span>Received {formatINR(delivery.cashCollected)}</span>
                                  </div>
                                  <div className="text-[0.625rem] text-emerald-600 dark:text-emerald-400/80 mt-0.5">
                                    ✓ Settled with Office
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[0.5rem] bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 font-bold text-xs" title="Collected from customer, currently with driver">
                                    <Wallet className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                    <span>{formatINR(delivery.cashCollected)} with Driver</span>
                                  </div>
                                  {!isDriver && (
                                    <div className="text-[0.625rem] text-amber-700 dark:text-amber-300 mt-0.5 font-medium">
                                      Driver: {delivery.driver?.name || 'Driver'}
                                    </div>
                                  )}
                                </div>
                              )
                            ) : delivery.invoice?.status !== 'PAID' &&
                              delivery.invoice?.status !== 'CANCELLED' &&
                              delivery.cashHandedOver !== true &&
                              Number(delivery.amountToCollect || 0) > 0 ? (
                              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-[0.5rem] bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 font-bold text-xs">
                                <CircleDollarSign className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span>Collect {formatINR(delivery.amountToCollect)}</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-[0.5rem] bg-muted text-muted-foreground text-xs font-medium">
                                <span>Prepaid / ₹0</span>
                              </div>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Status Badge & Logistics Cost */}
                      <td className="py-3.5 px-4 align-top">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${
                            isDelivered
                              ? isCustomerPickup
                                ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
                                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                              : isOutForPickup
                              ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30'
                              : isOutForDelivery
                              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20'
                              : isAssignedToDriver
                              ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30'
                              : isPendingPush
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {isDelivered && (
                            isCustomerPickup ? (
                              <CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )
                          )}
                          {isOutForPickup && <Boxes className="h-3 w-3 text-purple-600 dark:text-purple-400" />}
                          {isOutForDelivery && <Truck className="h-3 w-3 text-blue-600 dark:text-blue-400" />}
                          {isAssignedToDriver && <Clock className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />}
                          {isDelivered
                            ? isCustomerPickup
                              ? 'Customer Picked Up'
                              : 'Delivered'
                            : isOutForPickup
                            ? 'Out for Pickup'
                            : isOutForDelivery
                            ? 'Out for Delivery'
                            : isAssignedToDriver
                            ? isDriver
                              ? 'Assigned • Accept Below'
                              : 'Pushed to Driver'
                            : isDriverAssigned
                            ? 'Pending Push'
                            : 'Unassigned'}
                        </span>

                        {delivery.driver && (
                          <div className="flex items-center gap-1 text-[0.6875rem] text-foreground/80 font-medium mt-1">
                            <UserCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="truncate">{delivery.driver.name}</span>
                          </div>
                        )}

                        {!isDriver && !isSupervisor && (
                          <>
                            <div className="text-[0.6875rem] text-muted-foreground font-medium flex items-center gap-1 mt-1.5" title="Internal transport cost (hidden from driver)">
                              <Lock className="h-3 w-3 text-muted-foreground" />
                              <span>Internal Cost: {formatINR(totalTripCost)}</span>
                            </div>

                            {isOwnerOrAdmin && (
                              <button
                                onClick={() => setActiveDeliveryId(delivery.id)}
                                className="text-[0.625rem] text-primary hover:underline inline-flex items-center gap-0.5 mt-0.5 cursor-pointer"
                              >
                                + Log Trip Cost
                              </button>
                            )}
                          </>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-right align-top">
                        {isDriver ? (
                          <div className="flex items-center justify-end gap-2">
                            {delivery.status === 'ASSIGNED' && (
                              <button
                                onClick={async () => {
                                  await handleStatusUpdate(delivery.id, 'OUT_FOR_PICKUP');
                                  router.push('/dashboard');
                                }}
                                className="text-xs font-semibold text-white px-3.5 py-1.5 rounded-[0.625rem] bg-purple-600 hover:bg-purple-500 transition-all inline-flex items-center gap-1.5 shadow-sm active:scale-98"
                                title="Start warehouse pickup"
                              >
                                <Boxes className="h-3.5 w-3.5" />
                                Out for Pickup
                              </button>
                            )}

                            {(delivery.status === 'OUT_FOR_PICKUP' ||
                              delivery.status === 'OUT_FOR_DELIVERY' ||
                              delivery.status === 'PICKED_UP') && (
                              <button
                                onClick={() => router.push('/dashboard')}
                                className="text-xs font-semibold text-primary hover:text-foreground px-3 py-1.5 rounded-[0.625rem] bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-all inline-flex items-center gap-1.5 active:scale-98"
                                title="View active delivery cockpit with warehouse checklist"
                              >
                                Go to Active Dashboard <ArrowRight className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {isDelivered && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1 px-2.5 py-1 rounded-[0.5rem] bg-emerald-500/10 border border-emerald-500/20">
                                  <Check className="h-3.5 w-3.5" /> Delivered
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-x-1.5 inline-flex items-center justify-end">
                            {/* View Details */}
                            <button
                              onClick={() => setDetailsModalDelivery(delivery)}
                              className="p-1.5 text-xs font-semibold text-foreground rounded-lg bg-muted hover:bg-muted/80 border border-border transition-all inline-flex items-center gap-1 shadow-2xs active:scale-98 cursor-pointer"
                              title="View delivery details and items checklist"
                            >
                              <Eye className="h-3.5 w-3.5 text-foreground/80" />
                            </button>

                            {/* Challan PDF Download */}
                            <button
                              onClick={() => handleDownloadChallan(delivery.id, delivery.invoice?.invoiceNo)}
                              disabled={downloadingChallanId === delivery.id}
                              className="p-1.5 text-xs font-semibold text-foreground rounded-lg bg-muted hover:bg-muted/80 border border-border transition-all inline-flex items-center gap-1 shadow-2xs active:scale-98 cursor-pointer"
                              title="Download rate-masked Delivery Challan / Gate Pass"
                            >
                              <FileText className="h-3.5 w-3.5 text-primary" />
                            </button>

                            {/* Dispatch & Cash Actions restricted to OWNER and ADMIN */}
                            {isOwnerOrAdmin ? (
                              <Fragment>
                                {/* Pending: Single Process Button */}
                                {isPendingPush && (
                                  <button
                                    onClick={() => setPushModalDelivery(delivery)}
                                    className="text-xs font-bold text-primary-foreground px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 transition-all inline-flex items-center gap-1.5 shadow-sm active:scale-98 cursor-pointer"
                                    title="Process Delivery or Counter Pickup"
                                  >
                                    <Send className="h-3.5 w-3.5" />
                                    Process
                                  </button>
                                )}

                                {/* Assigned: Edit & Share */}
                                {isAssignedToDriver && (
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      onClick={() => setPushModalDelivery(delivery)}
                                      className="text-xs font-semibold text-foreground px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/80 border border-border transition-all inline-flex items-center gap-1 cursor-pointer"
                                      title="Edit Delivery Run details & assigned items"
                                    >
                                      <Edit2 className="h-3.5 w-3.5 text-primary" />
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleShareWithDriver(delivery)}
                                      className="p-1.5 rounded-lg text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/30 transition-all inline-flex items-center active:scale-95 cursor-pointer"
                                      title="Resend Delivery Assignment to Driver on WhatsApp"
                                    >
                                      <Share2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                )}

                                {/* Out for Pickup or Delivery: Reshare on WhatsApp */}
                                {(isOutForPickup || isOutForDelivery) && (
                                  <button
                                    onClick={() => handleShareWithDriver(delivery)}
                                    className="p-1.5 rounded-lg text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/30 transition-all inline-flex items-center active:scale-95 cursor-pointer"
                                    title="Resend Delivery Assignment to Driver on WhatsApp"
                                  >
                                    <Share2 className="h-3.5 w-3.5" />
                                  </button>
                                )}

                                {/* Collect Cash Handover from Driver */}
                                {Boolean(isDelivered && !delivery.cashHandedOver && Number(delivery.cashCollected || 0) > 0) ? (
                                  <button
                                    onClick={() => handleCollectCashFromDriver(delivery.id)}
                                    disabled={submittingHandover === delivery.id}
                                    className="text-xs font-semibold text-white px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-all inline-flex items-center gap-1 shadow-sm active:scale-98 cursor-pointer"
                                    title="Collect cash from driver and deposit to office"
                                  >
                                    <CircleDollarSign className="h-3.5 w-3.5" />
                                    {submittingHandover === delivery.id ? 'Collecting...' : 'Receive Cash'}
                                  </button>
                                ) : null}
                              </Fragment>
                            ) : null}
                          </div>
                        )}
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
          totalItems={filteredDeliveries.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Delivery Details Modal */}
      <DeliveryDetailsModal
        delivery={detailsModalDelivery}
        onClose={() => setDetailsModalDelivery(null)}
        onDownloadChallan={handleDownloadChallan}
        canEdit={isOwnerOrAdmin && detailsModalDelivery?.status === 'ASSIGNED'}
        onEdit={(d) => {
          setDetailsModalDelivery(null);
          setPushModalDelivery(d);
        }}
      />

      {/* Push / Process / Edit Delivery Modal */}
      <PushDeliveryModal
        delivery={pushModalDelivery}
        drivers={drivers}
        onClose={() => setPushModalDelivery(null)}
        onSuccess={(dialogData?: PushSuccessDialogData) => {
          if (dialogData) {
            setDeliveries((prev) =>
              prev.map((d) =>
                d.id === pushModalDelivery?.id
                  ? { ...d, status: 'ASSIGNED', amountToCollect: dialogData.amountToCollect }
                  : d,
              ),
            );
            setPushSuccessDialog(dialogData);
          }
          setPushModalDelivery(null);
          loadDeliveries(true);
        }}
      />

      {/* Push Delivery Success Modal */}
      <PushSuccessModal
        data={pushSuccessDialog}
        onClose={() => setPushSuccessDialog(null)}
      />

      {/* Add Extra Trip Modal */}
      <AddTripModal
        deliveryId={activeDeliveryId}
        onClose={() => setActiveDeliveryId(null)}
        onSuccess={() => {
          setActiveDeliveryId(null);
          loadDeliveries();
        }}
      />
    </div>
  );
}
