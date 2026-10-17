'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { 
  X, 
  Send, 
  CircleDollarSign, 
  Package, 
  CheckSquare, 
  Square, 
  ArrowRight, 
  Phone, 
  MapPin,
  ShieldCheck,
  Users
} from 'lucide-react';
import { Delivery, DispatchSelectionItem, DispatchedItem, PushSuccessDialogData, SupervisorUser } from './types';
import { cleanPhoneNumber } from '@/lib/formatters';

interface PushDeliveryModalProps {
  delivery: Delivery | null;
  onClose: () => void;
  onSuccess: (data: PushSuccessDialogData) => void;
}

export function PushDeliveryModal({ delivery, onClose, onSuccess }: PushDeliveryModalProps) {
  const [selectedItems, setSelectedItems] = useState<DispatchSelectionItem[]>([]);
  const [amountToCollect, setAmountToCollect] = useState<number | ''>(0);
  const [vehicle, setVehicle] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [availableSupervisors, setAvailableSupervisors] = useState<SupervisorUser[]>([]);
  const [selectedSupervisorIds, setSelectedSupervisorIds] = useState<string[]>([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);

  useEffect(() => {
    async function fetchSupervisors() {
      setLoadingSupervisors(true);
      try {
        const users = await apiRequest<SupervisorUser[]>('/users?role=SUPERVISOR&isActive=true');
        setAvailableSupervisors(Array.isArray(users) ? users : []);
      } catch (err) {
        console.error('Failed to load supervisors:', err);
      } finally {
        setLoadingSupervisors(false);
      }
    }
    fetchSupervisors();
  }, []);

  useEffect(() => {
    if (!delivery) return;

    setAmountToCollect(delivery.amountToCollect ?? 0);
    setVehicle('');
    setNotes('');

    // Pre-populate already assigned supervisors if any
    const existingSupIds = (delivery.supervisors || []).map((s) => s.supervisorId);
    setSelectedSupervisorIds(existingSupIds);

    const sourceItems: DispatchedItem[] =
      delivery.items && delivery.items.length > 0
        ? delivery.items
        : delivery.invoice.items.map((it) => ({
            invoiceItemId: it.id,
            productId: it.productId,
            productName: it.product?.name || 'Product',
            unit: it.product?.unit || 'unit',
            warehouseId: it.warehouseId,
            warehouseName: it.warehouse?.name || 'Warehouse',
            warehouseAddress: it.warehouse?.address || '',
            batchNo: it.batchNo,
            qty: it.qty,
          }));

    setSelectedItems(
      sourceItems.map((it) => ({
        ...it,
        maxQty: it.qty,
        dispatchQty: it.qty,
        selected: true,
      })),
    );
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
      })
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

  const buildDriverDispatchMessage = (
    targetDelivery: Delivery,
    customItems: DispatchedItem[],
    collectAmount: number,
  ) => {
    const inv = targetDelivery.invoice;
    const party = inv.party;
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
*Invoice:* #${inv.invoiceNo}
*Date:* ${dateStr}

${paymentLine}

👤 *RECEIVER DETAILS:*
• *Customer Name:* ${party.name}
• *Phone:* ${party.phone}
• *Delivery Address:* ${party.address || 'Counter Pickup / Direct Delivery'}

📦 *ITEMS TO PICK UP:*
${itemsList}${supervisorSection}

⏰ *Next Steps:*
1. Coordinate with assigned supervisor and pick up items.
2. Supervisor will confirm item pickup in the system.
3. Deliver to customer and collect specified payment.`;
  };

  const handleConfirmPush = async (e: React.FormEvent) => {
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
      alert('Please select at least one product with quantity > 0 to assign to this driver.');
      return;
    }

    const amountCollectNum = Number(amountToCollect) || 0;

    setSubmitting(true);
    try {
      await apiRequest(`/delivery/${delivery.id}/push`, {
        method: 'POST',
        body: JSON.stringify({
          amountToCollect: amountCollectNum,
          supervisorIds: selectedSupervisorIds,
          vehicle: vehicle || undefined,
          notes: notes || undefined,
          items: itemsToDispatch,
        }),
      });

      const msg = buildDriverDispatchMessage(delivery, itemsToDispatch, amountCollectNum);
      const cleanPhone = cleanPhoneNumber(delivery.driver?.phone);
      const waUrl = cleanPhone
        ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;

      const hasRemaining =
        itemsToDispatch.length < selectedItems.length ||
        selectedItems.some((it) => it.selected && it.dispatchQty < it.maxQty);

      onSuccess({
        invoiceNo: delivery.invoice?.invoiceNo || 'N/A',
        driverName: delivery.driver?.name || 'Driver',
        driverPhone: delivery.driver?.phone || '',
        itemsCount: itemsToDispatch.length,
        amountToCollect: amountCollectNum,
        transportCost: 0,
        hasRemaining,
        waUrl,
      });
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to push delivery');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-[1.25rem] border border-border/70 bg-card/95 backdrop-blur-xl p-6 shadow-2xl space-y-5 my-8 max-h-[88dvh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              Push Delivery to Driver (Out for Pickup)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Invoice #{delivery.invoice?.invoiceNo} • Driver:{' '}
              <strong className="text-foreground">{delivery.driver?.name}</strong> (
              {delivery.driver?.phone})
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleConfirmPush} className="space-y-4">

          {/* Cash/Payment Collection from Customer */}
          <div className="p-3.5 rounded-[0.875rem] bg-primary/5 border border-primary/20 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                <CircleDollarSign className="h-4 w-4 text-primary" />
                Cash / Money to Collect from Customer
              </label>
              <span className="text-[0.6875rem] text-muted-foreground font-medium">Visible to Driver</span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                ₹
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00 (Enter amount if driver needs to collect from customer)"
                value={amountToCollect}
                onChange={(e) =>
                  setAmountToCollect(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full rounded-[0.75rem] border border-input bg-background pl-7 pr-3 py-2 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <p className="text-[0.6875rem] text-muted-foreground">
              Leave 0 if order is already paid. If set, this exact amount will be prominently
              displayed on the driver&apos;s app to collect upon delivery.
            </p>
          </div>

          {/* Assigned Supervisor(s) Selection */}
          <div className="p-3.5 rounded-[0.875rem] bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider">
                <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                Assign Dispatch Supervisor(s)
              </label>
              <span className="text-[0.6875rem] text-muted-foreground font-medium">
                {selectedSupervisorIds.length} Selected
              </span>
            </div>
            <p className="text-[0.6875rem] text-muted-foreground">
              Select one or multiple supervisors to oversee item pickup and inspection for this delivery.
            </p>
            {loadingSupervisors ? (
              <div className="text-xs text-muted-foreground py-1">Loading supervisors...</div>
            ) : availableSupervisors.length === 0 ? (
              <div className="text-xs text-muted-foreground italic py-1">
                No active supervisors found. You can add supervisors under Users & Staff.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {availableSupervisors.map((sup) => {
                  const isSelected = selectedSupervisorIds.includes(sup.id);
                  return (
                    <button
                      key={sup.id}
                      type="button"
                      onClick={() => handleToggleSupervisor(sup.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-background hover:bg-muted text-foreground border-border'
                      }`}
                    >
                      <Users className="h-3 w-3" />
                      <span>{sup.name}</span>
                      <span className={`text-[0.6875rem] ${isSelected ? 'text-indigo-200' : 'text-muted-foreground'}`}>
                        ({sup.phone})
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Product Selection & Quantity Specification */}
          <div className="rounded-[0.875rem] border border-border/70 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-primary" />
                  Select Products & Quantities for This Driver
                </span>
                <p className="text-[0.6875rem] text-muted-foreground mt-0.5">
                  Unselected or partial quantities will remain in pending dispatch for another driver.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectAllItems(true)}
                  className="text-[0.6875rem] text-primary hover:underline font-semibold"
                >
                  Select All
                </button>
                <span className="text-border">|</span>
                <button
                  type="button"
                  onClick={() => handleSelectAllItems(false)}
                  className="text-[0.6875rem] text-muted-foreground hover:text-foreground font-semibold"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {selectedItems.map((item, idx) => {
                const isPartial = item.selected && item.dispatchQty < item.maxQty;
                const remainder = item.maxQty - item.dispatchQty;

                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-[0.75rem] border transition-colors ${
                      item.selected
                        ? 'bg-card border-primary/40 shadow-xs'
                        : 'bg-muted/40 border-border/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Checkbox & Item details */}
                      <div className="flex items-start gap-2.5 flex-1">
                        <button
                          type="button"
                          onClick={() => handleToggleItemSelection(idx)}
                          className="mt-0.5 text-primary hover:opacity-80 transition"
                        >
                          {item.selected ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>

                        <div className="space-y-0.5 flex-1">
                          <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                            <span>{item.productName}</span>
                            <span className="text-[0.6875rem] font-normal text-muted-foreground">
                              (Total: {item.maxQty} {item.unit})
                            </span>
                          </div>
                          {item.batchNo && (
                            <div className="text-[0.6875rem] text-muted-foreground font-mono">
                              Lot/Batch: {item.batchNo}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quantity Input for this driver */}
                      {item.selected && (
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1.5">
                            <label className="text-[0.6875rem] text-muted-foreground">Dispatch:</label>
                            <input
                              type="number"
                              min="1"
                              max={item.maxQty}
                              value={item.dispatchQty}
                              onChange={(e) =>
                                handleItemQtyChange(idx, Number(e.target.value))
                              }
                              className="w-16 rounded-[0.5rem] border border-input bg-background px-2 py-1 text-center font-bold text-foreground text-xs focus:ring-1 focus:ring-ring focus:outline-none"
                            />
                            <span className="text-xs text-muted-foreground">{item.unit}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Remainder status indicator */}
                    {item.selected && isPartial && (
                      <div className="mt-2 pt-2 border-t border-border/60 text-[0.6875rem] text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <ArrowRight className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>
                          <strong>{remainder} {item.unit}</strong> will remain for another driver.
                        </span>
                      </div>
                    )}
                    {!item.selected && (
                      <div className="mt-1 text-[0.6875rem] text-muted-foreground">
                        Skipped for this driver • Will remain in pending dispatch
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Vehicle & Trip Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Vehicle / Truck Info (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. DL-1AA-1234 (Tata Ace)"
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Internal Trip Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Driver allowance + toll charges"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Destination Preview */}
          <div className="bg-muted/30 rounded-[0.875rem] p-3 text-xs space-y-1 border border-border/60">
            <div className="text-muted-foreground text-[0.6875rem] font-semibold uppercase">
              Delivery Destination:
            </div>
            <div className="text-foreground font-semibold">
              {delivery.invoice?.party?.name}
            </div>
            <div className="text-muted-foreground flex items-center gap-1 text-[0.6875rem]">
              <Phone className="h-3 w-3 text-muted-foreground" />
              <span>{delivery.invoice?.party?.phone}</span>
            </div>
            <div className="text-muted-foreground flex items-start gap-1 text-[0.6875rem]">
              <MapPin className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
              <span>{delivery.invoice?.party?.address || 'Counter Pickup'}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium inline-flex items-center gap-1.5 active:scale-98"
            >
              <Send className="h-4 w-4" />
              {submitting ? 'Pushing Delivery...' : 'Push Delivery to Driver'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
