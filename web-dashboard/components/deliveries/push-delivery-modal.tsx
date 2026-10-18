'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { 
  X, 
  Send, 
  CircleDollarSign, 
  CheckSquare, 
  Square, 
  ShieldCheck,
  User,
  Truck,
  ShoppingBag,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Delivery, DispatchSelectionItem, DispatchedItem, DriverUser, PushSuccessDialogData, SupervisorUser } from './types';
import { cleanPhoneNumber } from '@/lib/formatters';

interface PushDeliveryModalProps {
  delivery: Delivery | null;
  drivers?: DriverUser[];
  onClose: () => void;
  onSuccess: (data?: PushSuccessDialogData) => void;
}

export function PushDeliveryModal({ delivery, drivers = [], onClose, onSuccess }: PushDeliveryModalProps) {
  const isEditing = delivery?.status === 'ASSIGNED';
  const [activeTab, setActiveTab] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');

  const [fetchedDrivers, setFetchedDrivers] = useState<DriverUser[]>([]);
  const availableDrivers = drivers.length > 0 ? drivers : fetchedDrivers;
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [availableSupervisors, setAvailableSupervisors] = useState<SupervisorUser[]>([]);
  const [selectedSupervisorIds, setSelectedSupervisorIds] = useState<string[]>([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);

  const [amountToCollect, setAmountToCollect] = useState<number | ''>(0);
  const [vehicle, setVehicle] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedItems, setSelectedItems] = useState<DispatchSelectionItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Fetch drivers if none provided
  useEffect(() => {
    let active = true;
    if (drivers.length === 0) {
      apiRequest<DriverUser[]>('/users?role=DRIVER&isActive=true')
        .then((data) => {
          if (active) setFetchedDrivers(Array.isArray(data) ? data : []);
        })
        .catch((err) => console.error('Failed to load drivers:', err));
    }
    return () => {
      active = false;
    };
  }, [drivers.length]);

  // Fetch supervisors
  useEffect(() => {
    let active = true;
    apiRequest<SupervisorUser[]>('/users?role=SUPERVISOR&isActive=true')
      .then((users) => {
        if (active) setAvailableSupervisors(Array.isArray(users) ? users : []);
      })
      .catch((err) => console.error('Failed to load supervisors:', err))
      .finally(() => {
        if (active) setLoadingSupervisors(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Pre-populate fields when delivery changes
  useEffect(() => {
    if (!delivery) return;

    const timer = setTimeout(() => {
      setActiveTab('DELIVERY');
      setSelectedDriverId(delivery.driverId || delivery.driver?.id || '');
      setAmountToCollect(delivery.amountToCollect ?? 0);
      setVehicle(delivery.trips?.[0]?.vehicle || '');
      setNotes(delivery.notes || '');

      // Pre-populate already assigned supervisors if any
      const existingSupIds = (delivery.supervisors || []).map((s) => s.supervisorId);
      setSelectedSupervisorIds(existingSupIds);

      const sourceItems: DispatchedItem[] =
        delivery.items && delivery.items.length > 0
          ? delivery.items
          : delivery.invoice?.items?.map((it) => ({
              invoiceItemId: it.id,
              productId: it.productId,
              productName: it.product?.name || 'Product',
              unit: it.product?.unit || 'unit',
              warehouseId: it.warehouseId,
              warehouseName: it.warehouse?.name || 'Warehouse',
              warehouseAddress: it.warehouse?.address || '',
              batchNo: it.batchNo,
              qty: Number(it.qty),
            })) || [];

      setSelectedItems(
        sourceItems.map((it) => ({
          ...it,
          maxQty: it.qty,
          dispatchQty: it.qty,
          selected: true,
        })),
      );
    }, 0);

    return () => clearTimeout(timer);
  }, [delivery]);

  if (!delivery) return null;

  const handleToggleItemSelection = (index: number) => {
    setSelectedItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item)),
    );
  };

  const handleItemQtyChange = (index: number, val: number) => {
    setSelectedItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const clamped = Math.max(1, Math.min(item.maxQty, val || 1));
        return { ...item, dispatchQty: clamped };
      }),
    );
  };

  const handleToggleSupervisor = (supervisorId: string) => {
    setSelectedSupervisorIds((prev) =>
      prev.includes(supervisorId)
        ? prev.filter((id) => id !== supervisorId)
        : [...prev, supervisorId],
    );
  };

  const handleSelectAllItems = (select: boolean) => {
    setSelectedItems((prev) => prev.map((item) => ({ ...item, selected: select })));
  };

  const selectedCount = selectedItems.filter((it) => it.selected && it.dispatchQty > 0).length;
  const isPartialDispatch =
    selectedCount < selectedItems.length ||
    selectedItems.some((it) => it.selected && it.dispatchQty < it.maxQty);

  const buildDriverDispatchMessage = (
    targetDelivery: Delivery,
    customItems: DispatchedItem[],
    collectAmount: number,
  ) => {
    const inv = targetDelivery.invoice;
    const party = inv?.party;
    const dateStr = new Date(targetDelivery.createdAt || Date.now()).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const itemsList = customItems
      .map((item, idx) => {
        const batch = item.batchNo ? ` [Lot/Batch: ${item.batchNo}]` : '';
        return `${idx + 1}. *${item.productName || 'Item'}* — *${item.qty} ${item.unit || 'units'}*${batch}`;
      })
      .join('\n');

    const supervisorDetails = availableSupervisors
      .filter((s) => selectedSupervisorIds.includes(s.id))
      .map((s) => `• ${s.name} (${s.phone})`)
      .join('\n');

    const supervisorSection = supervisorDetails
      ? `\n\n🛡️ *ASSIGNED SUPERVISOR(S):*\n${supervisorDetails}\n(Coordinate item pickup with the supervisor)`
      : '';

    const paymentLine =
      collectAmount > 0
        ? `💵 *AMOUNT TO COLLECT FROM CUSTOMER:* *₹${collectAmount.toFixed(2)}* (Please collect from customer before delivering)`
        : `💵 *PAYMENT:* Already Settled / Collect ₹0`;

    return `📦 *DELIVERY ASSIGNMENT — OUT FOR PICKUP*
*Invoice:* #${inv?.invoiceNo}
*Date:* ${dateStr}

${paymentLine}

👤 *RECEIVER DETAILS:*
• *Customer Name:* ${party?.name}
• *Phone:* ${party?.phone}
• *Delivery Address:* ${party?.address || 'Counter Pickup / Direct Delivery'}

📦 *ITEMS TO PICK UP:*
${itemsList}${supervisorSection}

⏰ *Next Steps:*
1. Coordinate with assigned supervisor and pick up items.
2. Supervisor will confirm item pickup in the system.
3. Deliver to customer and collect specified payment.`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const itemsToDispatch: DispatchedItem[] = selectedItems
      .filter((it) => it.selected && it.dispatchQty > 0)
      .map((it) => ({
        invoiceItemId: it.invoiceItemId,
        productId: it.productId,
        productName: it.productName,
        unit: it.unit,
        warehouseId: it.warehouseId,
        warehouseName: it.warehouseName,
        warehouseAddress: it.warehouseAddress,
        batchNo: it.batchNo,
        qty: it.dispatchQty,
      }));

    if (itemsToDispatch.length === 0) {
      alert('Please select at least one product with quantity > 0 to process.');
      return;
    }

    if (activeTab === 'DELIVERY' && !selectedDriverId) {
      alert('Please select an assigned driver for this delivery.');
      return;
    }

    const amountCollectNum = activeTab === 'DELIVERY' ? Number(amountToCollect) || 0 : 0;
    const isPickup = activeTab === 'PICKUP';

    setSubmitting(true);
    try {
      await apiRequest(`/delivery/${delivery.id}/push`, {
        method: 'POST',
        body: JSON.stringify({
          driverId: isPickup ? null : selectedDriverId,
          isCustomerPickup: isPickup,
          amountToCollect: amountCollectNum,
          supervisorIds: isPickup ? [] : selectedSupervisorIds,
          vehicle: isPickup ? undefined : vehicle || undefined,
          notes: notes || (isPickup ? 'Customer self-pickup completed from showroom/counter' : undefined),
          items: itemsToDispatch,
        }),
      });

      if (isPickup) {
        onSuccess();
        onClose();
        return;
      }

      // If driver delivery, construct WhatsApp message and prompt share
      const driverObj = availableDrivers.find((d) => d.id === selectedDriverId) || delivery.driver;
      const msg = buildDriverDispatchMessage(delivery, itemsToDispatch, amountCollectNum);
      const cleanPhone = cleanPhoneNumber(driverObj?.phone);
      const waUrl = cleanPhone
        ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;

      onSuccess({
        invoiceNo: delivery.invoice?.invoiceNo || 'N/A',
        driverName: driverObj?.name || 'Driver',
        driverPhone: driverObj?.phone || '',
        itemsCount: itemsToDispatch.length,
        amountToCollect: amountCollectNum,
        transportCost: 0,
        hasRemaining: isPartialDispatch,
        waUrl,
      });
      onClose();
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to process delivery');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl p-6 shadow-2xl space-y-5 my-8 max-h-[90dvh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3 shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              {isEditing ? 'Edit Delivery Run' : 'Process Delivery Order'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Invoice #{delivery.invoice?.invoiceNo} • {delivery.invoice?.party?.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Process Mode Tabs */}
        {!isEditing && (
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted/60 rounded-xl border border-border/60 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('DELIVERY')}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === 'DELIVERY'
                  ? 'bg-card text-foreground shadow-xs border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Truck className="h-4 w-4 text-primary" />
              Delivery (Driver Dispatch)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('PICKUP')}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === 'PICKUP'
                  ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-xs border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ShoppingBag className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Picked up by Customer (Counter Pickup)
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Tab 1: Driver Dispatch Configuration */}
          {activeTab === 'DELIVERY' ? (
            <div className="space-y-3.5 p-4 rounded-xl border border-border/60 bg-muted/15">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Driver Select */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-primary" />
                    Assign Driver <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    required
                    className="w-full text-xs rounded-xl border border-input bg-background text-foreground py-2 px-3 focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">-- Choose Driver --</option>
                    {availableDrivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.phone})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount to Collect */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                    <CircleDollarSign className="h-3.5 w-3.5 text-primary" />
                    Amount to Collect (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountToCollect}
                    onChange={(e) => setAmountToCollect(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="w-full text-xs rounded-xl border border-input bg-background text-foreground py-2 px-3 focus:outline-none focus:ring-1 focus:ring-ring font-mono font-bold"
                  />
                </div>
              </div>

              {/* Vehicle & Supervisors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                    Vehicle Plate / Mode (Optional)
                  </label>
                  <input
                    type="text"
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value)}
                    placeholder="e.g. DL 1A AB 1234, Tempo, E-Rickshaw"
                    className="w-full text-xs rounded-xl border border-input bg-background text-foreground py-2 px-3 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    Warehouse Supervisors (Optional)
                  </label>
                  {loadingSupervisors ? (
                    <div className="text-xs text-muted-foreground italic py-2">Loading supervisors...</div>
                  ) : availableSupervisors.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic py-2">No supervisors registered</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {availableSupervisors.map((s) => {
                        const isSelected = selectedSupervisorIds.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => handleToggleSupervisor(s.id)}
                            className={`px-2 py-1 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center gap-1 ${
                              isSelected
                                ? 'bg-primary/10 border-primary text-primary font-bold'
                                : 'bg-background border-border text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <span>{s.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Tab 2: Customer Pickup Notice */
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                <CheckCircle className="h-4 w-4" />
                Customer Direct Counter Pickup
              </div>
              <p className="text-xs text-emerald-900/80 dark:text-emerald-200/80 leading-relaxed">
                The chosen items will be immediately marked as <strong>Delivered</strong> at the showroom/counter. No driver will be dispatched.
              </p>
            </div>
          )}

          {/* Shared Interactive Item Picker */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-foreground uppercase tracking-wider block">
                  Select Items for this {activeTab === 'PICKUP' ? 'Pickup' : 'Delivery'}
                </label>
                <span className="text-[11px] text-muted-foreground">
                  Unselected items will remain pending for future dispatch.
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleSelectAllItems(true)}
                  className="text-primary hover:underline font-semibold cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-muted-foreground">•</span>
                <button
                  type="button"
                  onClick={() => handleSelectAllItems(false)}
                  className="text-muted-foreground hover:underline cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Items Table */}
            <div className="rounded-xl border border-border/70 overflow-hidden divide-y divide-border/50">
              {selectedItems.map((item, idx) => (
                <div
                  key={item.invoiceItemId || idx}
                  className={`p-3 flex items-center justify-between gap-3 transition-colors ${
                    item.selected ? 'bg-card' : 'bg-muted/30 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleItemSelection(idx)}
                      className="cursor-pointer text-primary shrink-0"
                    >
                      {item.selected ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <div className="truncate">
                      <div className="text-xs font-semibold text-foreground truncate">
                        {item.productName || 'Product'}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                        <span>Showroom / Warehouse: {item.warehouseName || 'Main'}</span>
                        {item.batchNo && (
                          <span className="font-mono text-[10px] px-1.5 py-0.2 bg-muted rounded">
                            Lot: {item.batchNo}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quantity Dispatch Field */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">Qty:</span>
                    <input
                      type="number"
                      min="1"
                      max={item.maxQty}
                      value={item.dispatchQty}
                      disabled={!item.selected}
                      onChange={(e) => handleItemQtyChange(idx, Number(e.target.value))}
                      className="w-16 text-center text-xs font-bold rounded-lg border border-input bg-background py-1 px-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                    />
                    <span className="text-xs text-muted-foreground">
                      / {item.maxQty} {item.unit || 'units'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Partial Dispatch Reminder Alert */}
            {isPartialDispatch && (
              <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  <strong>Partial Dispatch:</strong> Only selected quantities will be processed now. The remaining items will stay queued in an active pending delivery run for this bill.
                </p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Dispatch Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Call customer 30 mins before arrival, delicate handling"
              className="w-full text-xs rounded-xl border border-input bg-background text-foreground py-2 px-3 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/60 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="text-xs font-semibold text-foreground px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 border border-border transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || selectedCount === 0}
              className="text-xs font-bold text-primary-foreground px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 transition-all inline-flex items-center gap-1.5 shadow-sm active:scale-98 cursor-pointer disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {submitting
                ? 'Processing...'
                : isEditing
                ? 'Update Delivery'
                : activeTab === 'PICKUP'
                ? 'Confirm Customer Pickup'
                : 'Confirm & Dispatch Driver'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
