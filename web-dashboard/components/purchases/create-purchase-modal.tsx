'use client';

import { useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ThemedSelect } from '@/components/ui/themed-select';
import { 
  X, 
  Plus, 
  Trash2, 
  ShoppingCart, 
  Layers, 
  Loader2 
} from 'lucide-react';
import { Product, Warehouse, Party } from '@/components/invoices/types';
import { MultiPaymentSplitSelector, SplitRow } from '@/components/shared/multi-payment-split-selector';

interface PurchaseLineItem {
  productId: string;
  warehouseId?: string;
  batchNo: string;
  qty: number;
  unitPrice: number;
  discount: number;
}

interface CreatePurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  products: Product[];
  warehouses?: Warehouse[];
  parties: Party[];
}

export function CreatePurchaseModal({
  isOpen,
  onClose,
  onSuccess,
  products,
  parties,
}: CreatePurchaseModalProps) {
  const [vendorBillNo, setVendorBillNo] = useState('');
  const [partyId, setPartyId] = useState(parties[0]?.id || '');
  const [isNewSupplier, setIsNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierAddress, setNewSupplierAddress] = useState('');
  const [newSupplierGstin, setNewSupplierGstin] = useState('');

  const [paymentSplits, setPaymentSplits] = useState<SplitRow[]>([]);
  const [taxRate, setTaxRate] = useState<number | ''>(0);
  const [transportCost, setTransportCost] = useState<number | ''>(0);
  const [notes, setNotes] = useState('');

  const [items, setItems] = useState<PurchaseLineItem[]>([
    {
      productId: products[0]?.id || '',
      batchNo: '',
      qty: 1,
      unitPrice: 0,
      discount: 0,
    },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const partyOptions = useMemo(
    () =>
      parties.map((party) => ({
        value: party.id,
        label: party.name,
        subLabel: party.phone,
        badge: party.gstin ? 'GST' : undefined,
      })),
    [parties],
  );
  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        value: product.id,
        label: product.name,
        subLabel: product.unit ? `Unit: ${product.unit}` : undefined,
        badge: product.category,
      })),
    [products],
  );

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        productId: products[0]?.id || '',
        batchNo: '',
        qty: 1,
        unitPrice: 0,
        discount: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (
    index: number,
    field: keyof PurchaseLineItem,
    value: PurchaseLineItem[keyof PurchaseLineItem],
  ) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  // Calculations
  const subtotal = items.reduce((sum, it) => sum + (it.qty * it.unitPrice - (it.discount || 0)), 0);
  const numTaxRate = taxRate === '' ? 0 : Number(taxRate);
  const taxAmount = (subtotal * numTaxRate) / 100;
  const numTransport = transportCost === '' ? 0 : Number(transportCost);
  const grandTotal = subtotal + taxAmount + numTransport;

  const validSplits = paymentSplits.filter((s) => {
    const p = parseFloat(s.amount);
    return !isNaN(p) && p > 0;
  });
  const numPaidNow = validSplits.reduce((acc, s) => acc + parseFloat(s.amount), 0);
  const resolvedPaymentMode =
    validSplits.length > 1
      ? 'SPLIT'
      : validSplits.length === 1
      ? validSplits[0].mode
      : 'CREDIT';
  const balanceDue = Math.max(0, grandTotal - numPaidNow);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (items.length === 0) {
      setFormError('Please add at least one line item.');
      return;
    }

    if (isNewSupplier) {
      if (!newSupplierName.trim()) {
        setFormError('Please enter supplier name.');
        return;
      }
      if (!newSupplierPhone.trim()) {
        setFormError('Please enter supplier phone number.');
        return;
      }
    } else if (!partyId) {
      setFormError('Please select a supplier party.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.productId) {
        setFormError(`Item #${i + 1} has no product selected.`);
        return;
      }
      if (it.qty <= 0) {
        setFormError(`Item #${i + 1} quantity must be greater than 0.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        vendorBillNo: vendorBillNo.trim() || undefined,
        paymentMode: resolvedPaymentMode,
        amountPaidNow: numPaidNow,
        payments: validSplits.map((s) => ({
          mode: s.mode,
          amount: parseFloat(s.amount),
          upiUtr: s.upiUtr?.trim() || undefined,
          notes: s.notes?.trim() || undefined,
        })),
        taxRate: numTaxRate,
        transportCost: numTransport,
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          productId: it.productId,
          warehouseId: it.warehouseId || undefined,
          batchNo: it.batchNo.trim() || undefined,
          qty: Number(it.qty),
          unitPrice: Number(it.unitPrice),
          discount: Number(it.discount || 0),
        })),
      };

      if (isNewSupplier) {
        payload.newParty = {
          name: newSupplierName.trim(),
          phone: newSupplierPhone.trim(),
          address: newSupplierAddress.trim() || undefined,
          gstin: newSupplierGstin.trim() || undefined,
          isSaved: true,
        };
      } else {
        payload.partyId = partyId;
      }

      await apiRequest('/purchases', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setFormError((err as Error).message || 'Failed to record purchase');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden animate-in fade-in">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs -z-10" />
      <div className="w-full max-w-4xl rounded-[1.5rem] border border-border bg-background shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-foreground">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-border p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Inward Purchase Bill</h2>
              <p className="text-xs text-muted-foreground">
                Increment showroom & godown inventory with row-locked stock ledger tracking
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-6 [scrollbar-gutter:stable] [contain:paint]"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Supplier Info */}
          <div className="rounded-[1rem] border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Supplier Information
              </span>
              <button
                type="button"
                onClick={() => setIsNewSupplier(!isNewSupplier)}
                className="text-xs text-primary hover:underline font-medium"
              >
                {isNewSupplier ? 'Select Existing Supplier' : '+ New Supplier'}
              </button>
            </div>

            {!isNewSupplier ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Select Supplier *
                  </label>
                  <ThemedSelect
                    value={partyId}
                    onChange={(val) => setPartyId(val)}
                    searchable
                    searchPlaceholder="Search supplier name, phone..."
                    options={partyOptions}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Vendor Bill / Invoice #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-904"
                    value={vendorBillNo}
                    onChange={(e) => setVendorBillNo(e.target.value)}
                    className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kajaria Ceramics"
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Phone *</label>
                  <input
                    type="text"
                    required
                    placeholder="10 digit number"
                    value={newSupplierPhone}
                    onChange={(e) => setNewSupplierPhone(e.target.value)}
                    className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">GSTIN</label>
                  <input
                    type="text"
                    placeholder="15-digit GSTIN"
                    value={newSupplierGstin}
                    onChange={(e) => setNewSupplierGstin(e.target.value)}
                    className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Address</label>
                  <input
                    type="text"
                    placeholder="City / State"
                    value={newSupplierAddress}
                    onChange={(e) => setNewSupplierAddress(e.target.value)}
                    className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-primary" />
                Purchased Products & Stock Inward
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="rounded-[1rem] border border-border bg-card p-4 space-y-3 shadow-2xs"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-5">
                      <label className="block text-[0.6875rem] font-medium text-muted-foreground mb-1">
                        Product *
                      </label>
                      <ThemedSelect
                        value={it.productId}
                        onChange={(v) => handleItemChange(idx, 'productId', v)}
                        searchable
                        searchPlaceholder="Search product or tile..."
                        options={productOptions}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[0.6875rem] font-medium text-muted-foreground mb-1">
                        Batch / Lot No
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. LOT-A"
                        value={it.batchNo}
                        onChange={(e) => handleItemChange(idx, 'batchNo', e.target.value)}
                        className="w-full rounded-[0.5rem] border border-input bg-background px-2.5 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[0.6875rem] font-medium text-muted-foreground mb-1">
                        Qty *
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        required
                        value={it.qty}
                        onChange={(e) => handleItemChange(idx, 'qty', Number(e.target.value))}
                        className="w-full rounded-[0.5rem] border border-input bg-background px-2 py-1.5 text-xs text-center font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[0.6875rem] font-medium text-muted-foreground mb-1">
                        Rate (₹) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={it.unitPrice === 0 ? '' : it.unitPrice}
                        placeholder="0.00"
                        onChange={(e) => handleItemChange(idx, 'unitPrice', Number(e.target.value))}
                        className="w-full rounded-[0.5rem] border border-input bg-background px-2 py-1.5 text-xs text-right font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div className="sm:col-span-1 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        disabled={items.length === 1}
                        className="p-2 text-muted-foreground hover:text-rose-600 disabled:opacity-20 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Breakdown */}
          <div className="space-y-1">
            <MultiPaymentSplitSelector
              totalAmount={grandTotal}
              splits={paymentSplits}
              onChange={setPaymentSplits}
              allowCredit={true}
              creditLabel="Balance Due to Vendor (Payable Credit)"
            />
          </div>

          {/* Additional Costs & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-foreground">
                  Purchase GST / Tax (%)
                </label>
                <span className="text-[0.625rem] text-primary font-mono font-bold">
                  {numTaxRate}%
                </span>
              </div>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="0 (e.g. 18, 12, 5)"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Freight / Transport (₹)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={transportCost}
                onChange={(e) =>
                  setTransportCost(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-foreground mb-1">Notes</label>
              <input
                type="text"
                placeholder="e.g. Delivery received at central depot via VRL Logistics"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Financial Summary */}
          <div className="bg-muted/40 p-4 rounded-[1rem] space-y-2 border border-border text-foreground">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Items Subtotal:</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            {numTaxRate > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Purchase GST ({numTaxRate}%):</span>
                <span>₹{taxAmount.toFixed(2)}</span>
              </div>
            )}
            {numTransport > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Freight / Transport:</span>
                <span>₹{numTransport.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-foreground border-t border-border pt-2">
              <span>Grand Total:</span>
              <span className="text-primary">₹{grandTotal.toFixed(2)}</span>
            </div>
            {numPaidNow > 0 && (
              <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <span>Amount Paid Now ({resolvedPaymentMode}):</span>
                <span>₹{numPaidNow.toFixed(2)}</span>
              </div>
            )}
            {balanceDue > 0 && (
              <div className="flex justify-between text-xs text-amber-600 dark:text-amber-400 font-medium">
                <span>Balance Payable / Supplier Credit:</span>
                <span>₹{balanceDue.toFixed(2)}</span>
              </div>
            )}
          </div>

          {formError && (
            <div className="rounded-[0.75rem] bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-600 dark:text-rose-400">
              {formError}
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs active:scale-98"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <ShoppingCart className="h-4 w-4 mr-1.5" />
              )}
              {submitting ? 'Recording Inward...' : 'Confirm Inward Purchase & Restock'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
