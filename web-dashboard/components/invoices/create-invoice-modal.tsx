'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { 
  X, 
  Trash2, 
  Search, 
  Layers, 
  UserCheck, 
  UserPlus, 
  UserX, 
  Loader2, 
  QrCode, 
  Check,
  Banknote
} from 'lucide-react';
import { ThemedSelect } from '@/components/ui/themed-select';
import {
  Product,
  Party,
  StockLedgerRecord,
  FormLineItem,
  Invoice,
  PreviewUpiData,
  UpiAccount,
  CustomerMode
} from './types';
import { MultiPaymentSplitSelector, SplitRow } from '@/components/shared/multi-payment-split-selector';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (invoice: Invoice) => void;
  products: Product[];
  parties: Party[];
  allStock: StockLedgerRecord[];
  onRefreshStock: () => Promise<StockLedgerRecord[]>;
}

export function CreateInvoiceModal({
  isOpen,
  onClose,
  onSuccess,
  products,
  parties,
  allStock,
  onRefreshStock,
}: CreateInvoiceModalProps) {
  const [customerMode, setCustomerMode] = useState<CustomerMode>('EXISTING');
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [partyId, setPartyId] = useState('');
  const [newParty, setNewParty] = useState({ name: '', phone: '', address: '' });
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [paymentSplits, setPaymentSplits] = useState<SplitRow[]>([
    { mode: 'UPI', amount: '' },
  ]);
  const [taxRate, setTaxRate] = useState<number | ''>(18);
  const [transportCost, setTransportCost] = useState<number | ''>('');
  const [transportGstRate, setTransportGstRate] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<FormLineItem[]>([]);
  const [openProductDropdownIdx, setOpenProductDropdownIdx] = useState<number | null>(null);
  const [productSearchTerms, setProductSearchTerms] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Live UPI Checkout Modal (Counter Screen)
  const [showUpiCheckoutModal, setShowUpiCheckoutModal] = useState(false);
  const [previewUpiData, setPreviewUpiData] = useState<PreviewUpiData | null>(null);
  const [previewUpiLoading, setPreviewUpiLoading] = useState(false);
  const [upiAccounts, setUpiAccounts] = useState<UpiAccount[]>([]);
  const [selectedUpiAccount, setSelectedUpiAccount] = useState<UpiAccount | null>(null);

  const getProductAvailableStock = useCallback(
    (prodId: string, currentStock: StockLedgerRecord[]): number => {
      if (!prodId) return 0;
      const forProd = currentStock.filter((s) => s.productId === prodId);
      if (forProd.length > 0) {
        return forProd.reduce(
          (sum, s) =>
            sum + Number(s.quantity ?? 0),
          0,
        );
      }
      const prod = products.find((p) => p.id === prodId);
      return prod?.availableQuantity ?? prod?.totalStock ?? 0;
    },
    [products],
  );

  const resolveProductPrice = useCallback(
    (prod: Product | undefined, currentPartyId?: string) => {
      if (!prod?.attributes || typeof prod.attributes !== 'object') return 0;
      const attrs = prod.attributes as Record<string, unknown>;
      const targetPartyId = currentPartyId || partyId;
      const party = parties.find((p) => p.id === targetPartyId);
      const isWholesale = party?.category === 'WHOLESALER' || party?.category === 'CONTRACTOR';
      if (isWholesale && attrs.wholesalePrice !== undefined && Number(attrs.wholesalePrice) > 0) {
        return Number(attrs.wholesalePrice);
      }
      return attrs.price !== undefined ? Number(attrs.price) : 0;
    },
    [parties, partyId],
  );

  // Initialize or reset form whenever modal opens
  useEffect(() => {
    if (!isOpen) return;

    const initItems = async () => {
      await onRefreshStock().catch(() => allStock);

      setItems([
        {
          productId: '',
          qty: 1,
          unitPrice: 0,
          discount: 0,
        },
      ]);
      setFormError('');
      setPartyId('');
      setPaymentSplits([{ mode: 'CASH', amount: '' }]);
      setCustomerMode('EXISTING');
      setCustomerSearch('');
      setIsCustomerDropdownOpen(false);
      setOpenProductDropdownIdx(null);
      setNewParty({ name: '', phone: '', address: '' });
      setNotes('');
      setProductSearchTerms({});
      setShowUpiCheckoutModal(false);
      setPreviewUpiData(null);
    };

    const fetchUpiAccounts = async () => {
      try {
        const res = await apiRequest<{ upiAccounts?: UpiAccount[] }>('/settings');
        const accounts = res.upiAccounts || [];
        setUpiAccounts(accounts);
        const primary = accounts.find((a) => a.isPrimary) || accounts[0] || null;
        setSelectedUpiAccount(primary);
      } catch (e) {
        console.error('Failed to load UPI accounts:', e);
      }
    };

    void initItems();
    void fetchUpiAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleAddItem = () => {
    setFormError('');
    const usedProductIds = new Set(items.map((it) => it.productId).filter(Boolean));
    if (products.length > 0 && usedProductIds.size >= products.length) {
      setFormError('All available products in your catalog are already added to this invoice.');
      return;
    }
    const hasEmptyItem = items.some((it) => !it.productId);
    if (hasEmptyItem) {
      setFormError('Please select a product for the empty item before adding another.');
      return;
    }

    setItems([
      ...items,
      {
        productId: '',
        qty: 1,
        unitPrice: 0,
        discount: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
    setProductSearchTerms((prev) => {
      const next: Record<number, string> = {};
      let nextIdx = 0;
      for (let i = 0; i < items.length; i++) {
        if (i === index) continue;
        if (prev[i] !== undefined) {
          next[nextIdx] = prev[i];
        }
        nextIdx++;
      }
      return next;
    });
  };

  const handleProductChange = (index: number, newProdId: string) => {
    setFormError('');
    if (!newProdId) {
      const newItems = [...items];
      newItems[index] = {
        ...newItems[index],
        productId: '',
        qty: 1,
        unitPrice: 0,
        discount: 0,
      };
      setItems(newItems);
      return;
    }
    if (items.some((it, i) => i !== index && it.productId === newProdId)) {
      const existingProd = products.find((p) => p.id === newProdId);
      setFormError(`"${existingProd?.name || 'This product'}" is already added. Each product can only appear once.`);
      return;
    }
    const newItems = [...items];
    const selectedProd = products.find((p) => p.id === newProdId);
    const defaultPrice = resolveProductPrice(selectedProd, partyId);

    newItems[index] = {
      ...newItems[index],
      productId: newProdId,
      qty: newItems[index].qty > 0 ? newItems[index].qty : 1,
      unitPrice: defaultPrice > 0 ? defaultPrice : 0,
      discount: newItems[index].discount || 0,
    };
    setItems(newItems);
  };

  const handleQtyChange = (index: number, valStr: string) => {
    const parsed = parseFloat(valStr);
    const qty = isNaN(parsed) ? 0 : parsed;
    const newItems = [...items];
    newItems[index] = { ...newItems[index], qty: Math.max(0, qty) };
    setItems(newItems);
  };

  const handleUnitPriceChange = (index: number, val: number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], unitPrice: Math.max(0, val) };
    setItems(newItems);
  };

  const handleDiscountChange = (index: number, val: number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], discount: Math.max(0, val) };
    setItems(newItems);
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => {
    return sum + (item.qty * item.unitPrice - (item.discount || 0));
  }, 0);
  const activeTaxRate = taxRate === '' ? 0 : Number(taxRate);
  const itemsTax = (subtotal * activeTaxRate) / 100;
  const numTransportCost = transportCost === '' ? 0 : Number(transportCost);
  const transportTax = (numTransportCost * transportGstRate) / 100;
  const grandTotal = subtotal + itemsTax + numTransportCost + transportTax;

  // Upfront Payment & Credit Calculations
  const calculatedGrandTotal = Math.max(0, Number(grandTotal.toFixed(2)));

  const totalSplitsAmount = useMemo(() => {
    return paymentSplits.reduce((sum, s) => {
      const parsed = parseFloat(s.amount);
      return sum + (isNaN(parsed) || parsed < 0 ? 0 : parsed);
    }, 0);
  }, [paymentSplits]);

  const effectivePaidNow = useMemo(() => {
    if (paymentSplits.length === 0) return 0;
    return Math.min(totalSplitsAmount, calculatedGrandTotal);
  }, [totalSplitsAmount, calculatedGrandTotal, paymentSplits.length]);

  const balanceCredit = Math.max(0, Number((calculatedGrandTotal - effectivePaidNow).toFixed(2)));

  const upiSplit = useMemo(() => {
    return paymentSplits.find((s) => s.mode === 'UPI' && parseFloat(s.amount) > 0);
  }, [paymentSplits]);
  const upiSplitAmount = upiSplit ? parseFloat(upiSplit.amount) : 0;

  const validateAndBuildPayload = () => {
    if (customerMode === 'EXISTING' && !partyId) {
      throw new Error('Please select a customer from the list');
    }
    let cleanPhone = '';
    if (customerMode !== 'EXISTING') {
      if (!newParty.name.trim() || !newParty.phone.trim()) {
        throw new Error('Please provide both Customer Name and Mobile Number');
      }
      cleanPhone = newParty.phone.replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        throw new Error('Customer mobile number must be strictly 10 digits');
      }
    }

    const uniqueProductIds = new Set(items.map((it) => it.productId));
    if (uniqueProductIds.size !== items.length) {
      throw new Error('Duplicate products detected. Each product can only be added once.');
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const prod = products.find((p) => p.id === item.productId);
      const prodName = prod?.name || `Item #${i + 1}`;

      if (!item.productId) {
        throw new Error(`Please select a valid product for Line #${i + 1}`);
      }
      if (item.unitPrice <= 0) {
        throw new Error(`Please provide a positive unit price for "${prodName}"`);
      }
      if (item.qty <= 0) {
        throw new Error(`Please specify quantity for "${prodName}".`);
      }
    }

    const invoicePayloadItems = items.map((item) => ({
      productId: item.productId,
      qty: Number(item.qty),
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discount || 0),
    }));

    const validPayments = paymentSplits
      .filter((s) => {
        const val = parseFloat(s.amount);
        return !isNaN(val) && val > 0;
      })
      .map((s) => ({
        mode: s.mode,
        amount: Math.round(parseFloat(s.amount) * 100) / 100,
        upiUtr: s.upiUtr,
        notes: s.notes,
      }));

    const primaryMode =
      validPayments.length === 0
        ? 'CREDIT'
        : validPayments.length === 1
        ? validPayments[0].mode
        : 'SPLIT';

    return {
      partyId: customerMode === 'EXISTING' ? partyId : undefined,
      newParty:
        customerMode !== 'EXISTING'
          ? {
              name: newParty.name.trim(),
              phone: cleanPhone,
              address: newParty.address.trim() || undefined,
              isSaved: customerMode === 'NEW_SAVED',
            }
          : undefined,
      paymentMode: primaryMode,
      amountPaidNow: effectivePaidNow,
      payments: validPayments,
      taxRate: activeTaxRate,
      transportCost: numTransportCost,
      transportGstRate: transportGstRate,
      notes: notes || undefined,
      items: invoicePayloadItems,
    };
  };

  const executeCreateInvoice = async (modeOverride?: string) => {
    setSubmitting(true);
    setFormError('');
    try {
      const payload = validateAndBuildPayload();
      if (modeOverride) payload.paymentMode = modeOverride;

      const createdInvoice = await apiRequest<Invoice>('/invoices', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      onSuccess(createdInvoice);
    } catch (err: unknown) {
      setFormError((err as Error).message || 'Failed to create invoice');
      setShowUpiCheckoutModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  const fetchPreviewQr = useCallback(
    async (account?: UpiAccount | null) => {
      const target = account !== undefined ? account : selectedUpiAccount;
      const targetAmount = upiSplitAmount > 0 ? upiSplitAmount : effectivePaidNow;
      setPreviewUpiLoading(true);
      try {
        const data = await apiRequest<PreviewUpiData>('/invoices/preview-upi-qr', {
          method: 'POST',
          body: JSON.stringify({
            amount: targetAmount,
            vpa: target?.upiId,
            merchantName: target?.merchantName,
          }),
        });
        setPreviewUpiData(data);
      } catch (err) {
        console.error('Failed to generate preview UPI QR', err);
        setFormError('Failed to generate UPI QR code. Please check your network.');
        setShowUpiCheckoutModal(false);
      } finally {
        setPreviewUpiLoading(false);
      }
    },
    [upiSplitAmount, effectivePaidNow, selectedUpiAccount],
  );

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    try {
      validateAndBuildPayload();
    } catch (err) {
      setFormError((err as Error).message);
      return;
    }

    if (upiSplitAmount > 0) {
      setShowUpiCheckoutModal(true);
      void fetchPreviewQr(selectedUpiAccount);
    } else {
      executeCreateInvoice();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 overflow-hidden animate-in fade-in">
        <div className="w-full max-w-4xl rounded-[1.5rem] border border-border bg-card shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-foreground">
          <div className="shrink-0 flex items-center justify-between border-b border-border p-6">
            <div>
              <h2 className="text-[1.25rem] font-bold text-foreground">Create Tax Invoice</h2>
              <p className="text-[0.75rem] text-muted-foreground mt-0.5">
                Add products with unified live stock availability for instant billing
              </p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Customer Selection */}
            <div className="rounded-[1rem] border border-border bg-muted/30 p-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[0.6875rem] font-semibold text-foreground uppercase tracking-wider">
                    Customer Type & Selection *
                  </label>
                  <span className="text-[0.6875rem] text-muted-foreground">Choose who this invoice is for</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerMode('EXISTING');
                      setFormError('');
                    }}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-[0.75rem] border text-[0.75rem] font-medium transition ${
                      customerMode === 'EXISTING'
                        ? 'border-primary bg-primary/10 text-primary font-semibold shadow-2xs'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <UserCheck className="h-4 w-4" />
                    <span>Saved Customer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCustomerMode('NEW_SAVED');
                      setFormError('');
                    }}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-[0.75rem] border text-[0.75rem] font-medium transition ${
                      customerMode === 'NEW_SAVED'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold shadow-2xs'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>+ New (Save to List)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCustomerMode('UNREGISTERED');
                      setFormError('');
                    }}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-[0.75rem] border text-[0.75rem] font-medium transition ${
                      customerMode === 'UNREGISTERED'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold shadow-2xs'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <UserX className="h-4 w-4" />
                    <span>Walk-in (Do NOT Save)</span>
                  </button>
                </div>
              </div>

              {customerMode === 'EXISTING' && (
                <div className="relative pt-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[0.75rem] font-medium text-foreground">
                      Search & Select Customer *
                    </label>
                    <span className="text-[0.625rem] text-muted-foreground">
                      Click to browse all or type to filter
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Click to browse all saved customers or type name/phone..."
                      value={customerSearch}
                      onFocus={() => setIsCustomerDropdownOpen(true)}
                      onClick={() => setIsCustomerDropdownOpen(true)}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setIsCustomerDropdownOpen(true);
                      }}
                      className="w-full pl-9 pr-8 py-2 text-[0.75rem] rounded-[0.75rem] border border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    {customerSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setPartyId('');
                          setCustomerSearch('');
                          setIsCustomerDropdownOpen(true);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                        title="Clear customer search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Customer Dropdown Popover */}
                  {isCustomerDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setIsCustomerDropdownOpen(false)}
                      />
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-40 max-h-56 overflow-y-auto rounded-xl border border-border bg-card/98 backdrop-blur-2xl shadow-2xl divide-y divide-border/60">
                      {parties.filter((p) => {
                        if (!customerSearch.trim()) return true;
                        const q = customerSearch.toLowerCase();
                        return (
                          p.name.toLowerCase().includes(q) ||
                          p.phone.includes(q) ||
                          (p.address && p.address.toLowerCase().includes(q))
                        );
                      }).length === 0 ? (
                        <div className="p-3 text-center text-xs text-muted-foreground">
                          No saved customers matched &quot;{customerSearch}&quot;
                        </div>
                      ) : (
                        parties
                          .filter((p) => {
                            if (!customerSearch.trim()) return true;
                            const q = customerSearch.toLowerCase();
                            return (
                              p.name.toLowerCase().includes(q) ||
                              p.phone.includes(q) ||
                              (p.address && p.address.toLowerCase().includes(q))
                            );
                          })
                          .map((p) => {
                            const isSelected = p.id === partyId;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setPartyId(p.id);
                                  setCustomerSearch(`${p.name} (${p.phone})`);
                                  setIsCustomerDropdownOpen(false);
                                  setItems((current) =>
                                    current.map((item) => {
                                      const prod = products.find((pr) => pr.id === item.productId);
                                      const effective = resolveProductPrice(prod, p.id);
                                      return effective > 0 ? { ...item, unitPrice: effective } : item;
                                    }),
                                  );
                                }}
                                className={`w-full text-left p-2.5 hover:bg-muted/70 transition flex items-center justify-between text-xs ${
                                  isSelected ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground'
                                }`}
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold">{p.name}</span>
                                    <span className="font-mono text-[11px] text-muted-foreground">({p.phone})</span>
                                  </div>
                                  {p.address && (
                                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{p.address}</p>
                                  )}
                                </div>
                                {isSelected && (
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                )}
                              </button>
                            );
                          })
                      )}
                    </div>
                    </>
                  )}
                </div>
              )}

              {customerMode !== 'EXISTING' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[0.75rem] font-medium text-foreground mb-1">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={newParty.name}
                      onChange={(e) => setNewParty({ ...newParty, name: e.target.value })}
                      className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-[0.75rem] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[0.75rem] font-medium text-foreground mb-1">
                      Mobile Number (10 digits) *
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="e.g. 9876543210"
                      value={newParty.phone}
                      onChange={(e) =>
                        setNewParty({
                          ...newParty,
                          phone: e.target.value.replace(/\D/g, '').slice(0, 10),
                        })
                      }
                      className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-[0.75rem] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[0.75rem] font-medium text-foreground mb-1">
                      Address / Site Location
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Plot 42, Civil Lines"
                      value={newParty.address}
                      onChange={(e) => setNewParty({ ...newParty, address: e.target.value })}
                      className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-[0.75rem] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Multi-Payment Split Selector */}
            <MultiPaymentSplitSelector
              totalAmount={calculatedGrandTotal}
              splits={paymentSplits}
              onChange={setPaymentSplits}
              allowCredit={true}
              onPreviewUpi={() => {
                setShowUpiCheckoutModal(true);
                void fetchPreviewQr(selectedUpiAccount);
              }}
              previewUpiLoading={previewUpiLoading}
            />

            {/* Tax & Transport Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-muted/30 p-4 rounded-[1rem] border border-border">

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[0.75rem] font-medium text-foreground">Items GST (%)</label>
                  <span className="text-[0.625rem] text-muted-foreground">{activeTaxRate}%</span>
                </div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="18"
                  value={taxRate === '' ? '' : taxRate}
                  onChange={(e) => setTaxRate(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                  className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-[0.8125rem] text-foreground font-mono focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[0.75rem] font-medium text-foreground mb-1">Cartage / Transport (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={transportCost === '' ? '' : transportCost}
                  onChange={(e) => setTransportCost(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-[0.8125rem] text-foreground font-mono focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[0.75rem] font-medium text-foreground mb-1">Transport GST (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="0"
                  value={transportGstRate === 0 ? '' : transportGstRate}
                  onChange={(e) => setTransportGstRate(e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0))}
                  className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-[0.8125rem] text-foreground font-mono focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[0.75rem] font-medium text-foreground mb-1">Invoice Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Counter delivery"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-[0.8125rem] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Items & Stock Allocation */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <span className="text-[0.6875rem] font-semibold text-muted-foreground uppercase tracking-wider">
                    Product Items & Stock Allocation
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-[0.75rem] text-primary hover:text-primary/80 font-medium transition"
                >
                  + Add Another Product
                </button>
              </div>

              <div className="space-y-4">
                {items.map((item, idx) => {
                  const selectedProd = products.find((p) => p.id === item.productId);
                  const availableStock = getProductAvailableStock(item.productId, allStock);
                  const lineSubtotal = item.qty * item.unitPrice - (item.discount || 0);

                  return (
                    <div key={idx} className="p-4 rounded-[1rem] border border-border bg-muted/20 space-y-3">
                      <div className="grid grid-cols-12 gap-3 items-end">
                        <div className="col-span-12 sm:col-span-4 space-y-1 relative">
                          <div className="flex items-center justify-between">
                            <label className="text-[0.6875rem] font-medium text-foreground">
                              Product / Tile #{idx + 1} *
                            </label>
                            {item.productId && (
                              <span
                                className={`text-[0.625rem] font-semibold px-2 py-0.5 rounded-full ${
                                  availableStock > 0
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                }`}
                              >
                                Stock: {availableStock} {selectedProd?.unit || 'units'}
                              </span>
                            )}
                          </div>

                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <input
                              type="text"
                              placeholder="Click to browse all or search product name..."
                              value={
                                productSearchTerms[idx] !== undefined
                                  ? productSearchTerms[idx]
                                  : selectedProd
                                  ? `${selectedProd.name} (${selectedProd.unit})`
                                  : ''
                              }
                              onFocus={() => {
                                setOpenProductDropdownIdx(idx);
                                if (productSearchTerms[idx] === undefined && selectedProd) {
                                  setProductSearchTerms((prev) => ({ ...prev, [idx]: '' }));
                                }
                              }}
                              onClick={() => {
                                setOpenProductDropdownIdx(idx);
                                if (productSearchTerms[idx] === undefined && selectedProd) {
                                  setProductSearchTerms((prev) => ({ ...prev, [idx]: '' }));
                                }
                              }}
                              onChange={(e) => {
                                setProductSearchTerms((prev) => ({ ...prev, [idx]: e.target.value }));
                                setOpenProductDropdownIdx(idx);
                              }}
                              className="w-full pl-8 pr-7 py-2 text-[0.75rem] bg-background border border-input rounded-[0.5rem] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            />
                            {item.productId && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleProductChange(idx, '');
                                  setProductSearchTerms((prev) => ({ ...prev, [idx]: '' }));
                                  setOpenProductDropdownIdx(idx);
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                                title="Clear product selection"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>

                          {/* Product Dropdown Popover */}
                          {openProductDropdownIdx === idx && (
                            <>
                              <div
                                className="fixed inset-0 z-20"
                                onClick={() => {
                                  setOpenProductDropdownIdx(null);
                                  setProductSearchTerms((prev) => {
                                    const next = { ...prev };
                                    delete next[idx];
                                    return next;
                                  });
                                }}
                              />
                              <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-52 overflow-y-auto rounded-xl border border-border bg-card/98 backdrop-blur-2xl shadow-xl divide-y divide-border/60">
                                {products.filter((p) => {
                                  const term = (productSearchTerms[idx] || '').toLowerCase().trim();
                                  if (!term) return true;
                                  return (
                                    p.name.toLowerCase().includes(term) ||
                                    (p.category || '').toLowerCase().includes(term)
                                  );
                                }).length === 0 ? (
                                  <div className="p-3 text-center text-xs text-muted-foreground">
                                    No products matched your search.
                                  </div>
                                ) : (
                                  products
                                    .filter((p) => {
                                      const term = (productSearchTerms[idx] || '').toLowerCase().trim();
                                      if (!term) return true;
                                      return (
                                        p.name.toLowerCase().includes(term) ||
                                        (p.category || '').toLowerCase().includes(term)
                                      );
                                    })
                                    .map((p) => {
                                      const isAlreadyAdded = items.some((it, i) => i !== idx && it.productId === p.id);
                                      const isSelected = item.productId === p.id;
                                      return (
                                        <button
                                          key={p.id}
                                          type="button"
                                          disabled={isAlreadyAdded}
                                          onClick={() => {
                                            handleProductChange(idx, p.id);
                                            setProductSearchTerms((prev) => ({ ...prev, [idx]: `${p.name} (${p.unit})` }));
                                            setOpenProductDropdownIdx(null);
                                          }}
                                          className={`w-full text-left p-2.5 hover:bg-muted/70 transition flex items-center justify-between text-xs ${
                                            isAlreadyAdded
                                              ? 'opacity-40 cursor-not-allowed bg-muted/20'
                                              : isSelected
                                              ? 'bg-primary/10 text-primary font-semibold'
                                              : 'text-foreground'
                                          }`}
                                        >
                                          <div className="truncate pr-2">
                                            <span className="font-semibold">{p.name}</span>
                                            <span className="text-[10px] text-muted-foreground ml-1.5 font-mono">
                                              [{p.unit}] {p.category ? `• ${p.category}` : ''}
                                            </span>
                                          </div>
                                          {isAlreadyAdded && (
                                            <span className="text-[10px] text-muted-foreground shrink-0 font-medium">
                                              [Already added]
                                            </span>
                                          )}
                                          {isSelected && (
                                            <Check className="h-4 w-4 text-primary shrink-0" />
                                          )}
                                        </button>
                                      );
                                    })
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        <div className="col-span-6 sm:col-span-2">
                          <label className="text-[0.6875rem] font-medium text-foreground block mb-1">
                            Quantity ({selectedProd?.unit || 'units'}) *
                          </label>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            required
                            value={item.qty === 0 ? '' : item.qty}
                            placeholder="1"
                            onChange={(e) => handleQtyChange(idx, e.target.value)}
                            className="w-full rounded-[0.5rem] border border-input bg-background px-3 py-2 text-[0.75rem] font-bold text-foreground focus:border-primary focus:outline-none"
                          />
                        </div>

                        <div className="col-span-6 sm:col-span-2">
                          <label className="text-[0.6875rem] font-medium text-foreground block mb-1">
                            Unit Price (Rs.) *
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value={item.unitPrice === 0 ? '' : item.unitPrice}
                            placeholder="0.00"
                            onChange={(e) => handleUnitPriceChange(idx, Number(e.target.value))}
                            className="w-full rounded-[0.5rem] border border-input bg-background px-3 py-2 text-[0.75rem] text-foreground focus:border-primary focus:outline-none"
                          />
                        </div>

                        <div className="col-span-6 sm:col-span-2">
                          <label className="text-[0.6875rem] font-medium text-foreground block mb-1">
                            Discount (Rs.)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.discount === 0 ? '' : item.discount}
                            placeholder="0.00"
                            onChange={(e) => handleDiscountChange(idx, Number(e.target.value))}
                            className="w-full rounded-[0.5rem] border border-input bg-background px-3 py-2 text-[0.75rem] text-foreground focus:border-primary focus:outline-none"
                          />
                        </div>

                        <div className="col-span-4 sm:col-span-1 text-right">
                          <span className="text-[0.625rem] text-muted-foreground block mb-0.5">Line Total</span>
                          <span className="text-[0.875rem] font-bold text-foreground">
                            ₹{Math.max(0, lineSubtotal).toFixed(2)}
                          </span>
                        </div>

                        <div className="col-span-2 sm:col-span-1 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            disabled={items.length === 1}
                            className="p-2 text-muted-foreground hover:text-rose-500 disabled:opacity-20 transition"
                            title="Remove Product"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Total Summary */}
            <div className="bg-muted/40 p-4 rounded-[1rem] space-y-2 border border-border text-foreground">
              <div className="flex justify-between text-[0.75rem] text-muted-foreground">
                <span>Items Subtotal:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {activeTaxRate > 0 && (
                <div className="flex justify-between text-[0.75rem] text-muted-foreground">
                  <span>Items GST ({activeTaxRate}%):</span>
                  <span>₹{itemsTax.toFixed(2)}</span>
                </div>
              )}
              {numTransportCost > 0 && (
                <>
                  <div className="flex justify-between text-[0.75rem] text-muted-foreground">
                    <span>Cartage / Transport:</span>
                    <span>₹{numTransportCost.toFixed(2)}</span>
                  </div>
                  {transportGstRate > 0 && (
                    <div className="flex justify-between text-[0.75rem] text-muted-foreground">
                      <span>Transport GST ({transportGstRate}%):</span>
                      <span>₹{transportTax.toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between text-[1rem] font-bold text-foreground border-t border-border pt-2">
                <span>Grand Total:</span>
                <span className="text-primary">₹{grandTotal.toFixed(2)}</span>
              </div>
              {effectivePaidNow > 0 && (
                <div className="flex justify-between text-[0.75rem] text-emerald-600 dark:text-emerald-400 font-medium">
                  <span>Amount Paid Now ({paymentMode}):</span>
                  <span>₹{effectivePaidNow.toFixed(2)}</span>
                </div>
              )}
              {balanceCredit > 0 && (
                <div className="flex justify-between text-[0.75rem] text-amber-600 dark:text-amber-400 font-medium">
                  <span>Balance Credit / Due:</span>
                  <span>₹{balanceCredit.toFixed(2)}</span>
                </div>
              )}
            </div>

            {formError && (
              <div className="rounded-[0.75rem] bg-rose-500/10 border border-rose-500/30 p-3 text-[0.75rem] text-rose-600 dark:text-rose-400">
                {formError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                onClick={onClose}
                className="bg-card hover:bg-muted text-foreground border border-border text-[0.75rem]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-[0.75rem] shadow-xs active:scale-98"
              >
                {upiSplitAmount > 0 ? (
                  <>
                    <QrCode className="h-4 w-4 mr-2" />
                    Collect ₹{upiSplitAmount.toFixed(2)} via UPI QR
                  </>
                ) : effectivePaidNow > 0 ? (
                  `Collect ₹${effectivePaidNow.toFixed(2)} & Issue Invoice`
                ) : (
                  'Issue Credit Invoice'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* COUNTER SCREEN: LIVE UPI QR PAYMENT COLLECTION MODAL */}
      {showUpiCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-[1.5rem] border border-border bg-card p-[clamp(1.25rem,2vw,1.75rem)] shadow-2xl space-y-6 text-center text-foreground">
            <div className="flex items-center justify-between border-b border-border pb-3 text-left">
              <div>
                <h3 className="text-[1rem] font-bold text-foreground flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-primary" />
                  Counter UPI Payment
                </h3>
                <p className="text-[0.75rem] text-muted-foreground mt-0.5">Customer scans with GPay, PhonePe, or Paytm</p>
              </div>
              <button
                onClick={() => setShowUpiCheckoutModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-[1rem] bg-primary/10 border border-primary/20 p-4">
                <span className="text-[0.6875rem] text-primary uppercase font-semibold tracking-wider block">
                  Amount Pre-filled for Customer
                </span>
                <span className="text-[1.875rem] font-extrabold text-foreground tracking-tight mt-1 block">
                  ₹{effectivePaidNow.toFixed(2)}
                </span>
                {balanceCredit > 0 && (
                  <span className="text-[0.75rem] text-amber-700 dark:text-amber-300 font-medium mt-1 block">
                    Leftover Credit / Driver Collection: ₹{balanceCredit.toFixed(2)}
                  </span>
                )}
                <span className="text-[0.6875rem] text-muted-foreground mt-1 block">
                  Merchant VPA:{' '}
                  <strong className="text-foreground font-mono">
                    {previewUpiData?.vpa || selectedUpiAccount?.upiId || 'Configured Store UPI'}
                  </strong>
                </span>
              </div>

              {/* ON-THE-SPOT UPI ACCOUNT SELECTION DROPDOWN */}
              {upiAccounts.length > 0 && (
                <div className="space-y-1.5 text-left">
                  <div className="flex items-center justify-between">
                    <label className="text-[0.6875rem] font-semibold text-foreground uppercase tracking-wider">
                      Receive Payment Into UPI:
                    </label>
                    <span className="text-[0.625rem] text-primary font-medium">
                      Select UPI Account
                    </span>
                  </div>
                  <ThemedSelect
                    value={selectedUpiAccount?.id || (upiAccounts.find((a) => a.isPrimary)?.id || upiAccounts[0]?.id || '')}
                    onChange={(val) => {
                      const acc = upiAccounts.find((a) => a.id === val) || null;
                      setSelectedUpiAccount(acc);
                      void fetchPreviewQr(acc);
                    }}
                    options={upiAccounts.map((acc) => ({
                      value: acc.id,
                      label: acc.upiId,
                      subLabel: acc.merchantName ? acc.merchantName : undefined,
                      badge: acc.isPrimary ? 'Default' : undefined,
                    }))}
                  />
                </div>
              )}

              {upiAccounts.length === 0 && (
                <div className="p-3 rounded-[0.75rem] border border-amber-500/20 bg-amber-500/10 text-[0.75rem] text-amber-700 dark:text-amber-300 text-left">
                  No store UPI IDs configured by director yet. Please add a UPI ID in Director Settings.
                </div>
              )}

              {previewUpiLoading ? (
                <div className="h-48 flex flex-col items-center justify-center gap-2 text-[0.75rem] text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span>Generating dynamic UPI QR code...</span>
                </div>
              ) : previewUpiData?.qrDataUrl ? (
                <div className="inline-block p-4 bg-white rounded-[1rem] shadow-md border border-border/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUpiData.qrDataUrl}
                    alt="NPCI UPI QR Code"
                    className="h-48 w-48 mx-auto"
                  />
                  <span className="text-[0.625rem] text-slate-500 font-medium block mt-2">
                    Exact Amount Embedded • Direct Settlement
                  </span>
                </div>
              ) : (
                <div className="p-4 bg-muted rounded-[0.75rem] text-[0.75rem] text-muted-foreground">
                  Unable to load QR image
                </div>
              )}

              <p className="text-[0.75rem] text-muted-foreground px-4">
                Verify the payment received on the customer&apos;s phone screen or your bank alert before issuing the bill.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <Button
                onClick={() => executeCreateInvoice('UPI')}
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-[0.75rem] shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-98 text-[0.75rem] cursor-pointer"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Payment Received & Generate Invoice
              </Button>

              <button
                type="button"
                onClick={() => {
                  setShowUpiCheckoutModal(false);
                  setPaymentMode('CASH');
                  executeCreateInvoice('CASH');
                }}
                disabled={submitting}
                className="w-full py-2 px-3 rounded-[0.75rem] border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold text-[0.75rem] flex items-center justify-center gap-1.5 transition active:scale-98 cursor-pointer"
              >
                <Banknote className="h-4 w-4" />
                Customer Paying Cash Instead (Instant Issue)
              </button>

              <button
                type="button"
                onClick={() => setShowUpiCheckoutModal(false)}
                className="text-[0.75rem] text-muted-foreground hover:text-foreground pt-1 transition-colors block mx-auto cursor-pointer"
              >
                Back to Edit Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

