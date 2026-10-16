'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ThemedSelect } from '@/components/ui/themed-select';
import { 
  X, 
  Plus, 
  Trash2, 
  FileText, 
  User, 
  Layers, 
  Loader2 
} from 'lucide-react';
import { Product, Party } from '@/components/invoices/types';

interface QuotationLineItem {
  productId: string;
  qty: number;
  unitPrice: number;
  discount: number;
}

interface CreateQuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  products: Product[];
  parties: Party[];
}

export function CreateQuotationModal({
  isOpen,
  onClose,
  onSuccess,
  products,
  parties,
}: CreateQuotationModalProps) {
  const [customerMode, setCustomerMode] = useState<'EXISTING' | 'CUSTOM'>('CUSTOM');
  const [partyId, setPartyId] = useState(parties[0]?.id || '');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  const [taxRate, setTaxRate] = useState<number | ''>(0);
  const [transportCost, setTransportCost] = useState<number | ''>(0);
  const [transportGstRate, setTransportGstRate] = useState<number>(0);
  const [notes, setNotes] = useState('');

  const [items, setItems] = useState<QuotationLineItem[]>([
    {
      productId: products[0]?.id || '',
      qty: 1,
      unitPrice: 0,
      discount: 0,
    },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        productId: products[0]?.id || '',
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
    field: keyof QuotationLineItem,
    value: QuotationLineItem[keyof QuotationLineItem],
  ) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  // Calculations
  const subtotal = items.reduce((sum, it) => sum + (it.qty * it.unitPrice - (it.discount || 0)), 0);
  const numTaxRate = taxRate === '' ? 0 : Number(taxRate);
  const itemsTax = (subtotal * numTaxRate) / 100;
  const numTransport = transportCost === '' ? 0 : Number(transportCost);
  const transportTax = (numTransport * transportGstRate) / 100;
  const grandTotal = subtotal + itemsTax + numTransport + transportTax;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (items.length === 0) {
      setFormError('Please add at least one line item.');
      return;
    }

    if (customerMode === 'CUSTOM' && !customerName.trim()) {
      setFormError('Please enter customer name.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        taxRate: numTaxRate,
        transportCost: numTransport,
        transportGstRate: transportGstRate,
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          productId: it.productId,
          qty: Number(it.qty),
          unitPrice: Number(it.unitPrice),
          discount: Number(it.discount || 0),
        })),
      };

      if (customerMode === 'EXISTING' && partyId) {
        payload.partyId = partyId;
      } else {
        payload.customerName = customerName.trim();
        payload.customerPhone = customerPhone.trim() || undefined;
        payload.customerAddress = customerAddress.trim() || undefined;
      }

      await apiRequest('/quotations', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setFormError((err as Error).message || 'Failed to create quotation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-hidden animate-in fade-in">
      <div className="w-full max-w-3xl rounded-[1.5rem] border border-border bg-card shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-foreground">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-border p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Create Price Estimate / Quotation</h2>
              <p className="text-xs text-muted-foreground">
                Generate official quotation (EST-xxxx) with 1-click invoice conversion
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Customer Selection */}
          <div className="rounded-[1rem] border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Customer Details
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCustomerMode('CUSTOM')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    customerMode === 'CUSTOM'
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  New Prospect / Lead
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode('EXISTING')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    customerMode === 'EXISTING'
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Existing Party
                </button>
              </div>
            </div>

            {customerMode === 'EXISTING' ? (
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Select Customer Party *
                </label>
                <ThemedSelect
                  value={partyId}
                  onChange={(val) => setPartyId(val)}
                  searchable
                  searchPlaceholder="Search customer name, phone..."
                  options={parties.map((p) => ({
                    value: p.id,
                    label: p.name,
                    subLabel: p.phone,
                    badge: p.category,
                  }))}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Prospect Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Amit Sharma"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="10 digit number"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Site / Address</label>
                  <input
                    type="text"
                    placeholder="e.g. Sector 62, Noida"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
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
                Quotation Products & Price Estimates
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
                        options={products.map((p) => ({
                          value: p.id,
                          label: p.name,
                          subLabel: p.unit ? `Unit: ${p.unit}` : undefined,
                          badge: p.category,
                        }))}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[0.6875rem] font-medium text-muted-foreground mb-1">
                        Qty *
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={it.qty}
                        onChange={(e) => handleItemChange(idx, 'qty', Number(e.target.value))}
                        className="w-full rounded-[0.5rem] border border-input bg-background px-2.5 py-1.5 text-xs text-center font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[0.6875rem] font-medium text-muted-foreground mb-1">
                        Quoted Rate (₹) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={it.unitPrice === 0 ? '' : it.unitPrice}
                        placeholder="0.00"
                        onChange={(e) => handleItemChange(idx, 'unitPrice', Number(e.target.value))}
                        className="w-full rounded-[0.5rem] border border-input bg-background px-2.5 py-1.5 text-xs text-right font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[0.6875rem] font-medium text-muted-foreground mb-1">
                        Discount (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={it.discount === 0 ? '' : it.discount}
                        placeholder="0.00"
                        onChange={(e) => handleItemChange(idx, 'discount', Number(e.target.value))}
                        className="w-full rounded-[0.5rem] border border-input bg-background px-2.5 py-1.5 text-xs text-right font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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

          {/* Taxes, Freight & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Items Tax Rate (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="0"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Estimated Cartage (₹)
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

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Transport GST (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="0"
                value={transportGstRate === 0 ? '' : transportGstRate}
                onChange={(e) =>
                  setTransportGstRate(e.target.value === '' ? 0 : Number(e.target.value))
                }
                className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-foreground mb-1">
                Estimate Terms / Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Valid for 7 days. Unloading charges extra."
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
                <span>Items GST ({numTaxRate}%):</span>
                <span>₹{itemsTax.toFixed(2)}</span>
              </div>
            )}
            {numTransport > 0 && (
              <>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Cartage / Freight:</span>
                  <span>₹{numTransport.toFixed(2)}</span>
                </div>
                {transportGstRate > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Transport GST ({transportGstRate}%):</span>
                    <span>₹{transportTax.toFixed(2)}</span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between text-base font-bold text-foreground border-t border-border pt-2">
              <span>Total Estimated Quote:</span>
              <span className="text-primary">₹{grandTotal.toFixed(2)}</span>
            </div>
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
                <FileText className="h-4 w-4 mr-1.5" />
              )}
              {submitting ? 'Generating Estimate...' : 'Generate Price Estimate (EST)'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
