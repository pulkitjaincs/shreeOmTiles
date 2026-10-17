import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/theme';
import { formatINR } from '@/lib/formatters';
import { mobileApiRequest, cachedMobileApiRequest } from '@/lib/api';
import { Product, Warehouse, Party, StockLedger, InvoiceLineItem, UpiAccount } from './types';
import { CustomerSelector } from './CustomerSelector';
import { InvoiceLineItemCard } from './InvoiceLineItemCard';
import { CounterUpiModal } from './CounterUpiModal';

interface CreateInvoiceModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (newInvoice?: any) => void;
  products: Product[];
  warehouses: Warehouse[];
  parties: Party[];
  stockList: StockLedger[];
  onRefreshStock: () => Promise<StockLedger[]>;
}

export function CreateInvoiceModal({
  visible,
  onClose,
  onSuccess,
  products,
  warehouses,
  parties,
  stockList,
  onRefreshStock,
}: CreateInvoiceModalProps) {
  const wasVisible = useRef(false);
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
  const [selectedPartyId, setSelectedPartyId] = useState(parties[0]?.id || '');
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyPhone, setNewPartyPhone] = useState('');
  const [newPartyAddress, setNewPartyAddress] = useState('');
  const [newPartyGstin, setNewPartyGstin] = useState('');
  const [saveNewParty, setSaveNewParty] = useState(true);

  const [items, setItems] = useState<InvoiceLineItem[]>([
    {
      productId: '',
      warehouseId: '',
      allocations: [],
      qty: 0,
      unitPrice: 0,
      discount: 0,
    },
  ]);

  const [taxRate, setTaxRate] = useState<number>(18);
  const [transportCost, setTransportCost] = useState<string>('0');
  const [transportGstRate, setTransportGstRate] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'UPI' | 'CASH' | 'CREDIT' | 'BANK_TRANSFER'>('UPI');
  const [amountPaidNow, setAmountPaidNow] = useState<string>('0');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshingStock, setRefreshingStock] = useState(false);
  const [currentStockList, setCurrentStockList] = useState(stockList);

  // Dynamic UPI accounts & live preview QR
  const [upiAccounts, setUpiAccounts] = useState<UpiAccount[]>([]);
  const [selectedUpiAccount, setSelectedUpiAccount] = useState<UpiAccount | null>(null);
  const [upiPreviewData, setUpiPreviewData] = useState<{
    qrDataUrl: string;
    vpa: string;
    amount: number;
  } | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);

  // Only return warehouses where quantity > 0 for this specific product
  const getAvailableWarehouses = useCallback(
    (productId: string, sourceStock = currentStockList) => {
      if (!productId) return [];
      return warehouses
        .map((wh) => {
          const qty = sourceStock
            .filter((s) => s.productId === productId && s.warehouseId === wh.id)
            .reduce((sum, s) => sum + Number(s.quantity || 0), 0);
          return { ...wh, availableQty: qty };
        })
        .filter((wh) => wh.availableQty > 0);
    },
    [warehouses, currentStockList],
  );

  const getStockAllocations = useCallback((productId: string, initialQty = 0, sourceStock = currentStockList) => {
    if (!productId) return [];
    const rows = sourceStock.filter((stock) => stock.productId === productId);
    if (rows.length > 0) {
      return rows.map((stock, index) => ({
        warehouseId: stock.warehouseId,
        batchNo: stock.batchNo,
        availableQty: Number(stock.quantity),
        qty: index === 0 ? initialQty : 0,
      }));
    }
    return [
      {
        warehouseId: undefined,
        batchNo: 'MASTER-IMPORT',
        availableQty: 0,
        qty: initialQty,
      },
    ];
  }, [currentStockList]);

  const resolveProductPrice = useCallback(
    (prod: Product | undefined, currentPartyId?: string) => {
      if (!prod?.attributes || typeof prod.attributes !== 'object') return 0;
      const attrs = prod.attributes as Record<string, any>;
      const targetPartyId = currentPartyId || selectedPartyId;
      const party = parties.find((p) => p.id === targetPartyId);
      const isWholesale = party?.category === 'WHOLESALER' || party?.category === 'CONTRACTOR';
      if (isWholesale && attrs.wholesalePrice !== undefined && Number(attrs.wholesalePrice) > 0) {
        return Number(attrs.wholesalePrice);
      }
      return attrs.price !== undefined ? Number(attrs.price) : 0;
    },
    [parties, selectedPartyId],
  );

  const handleSelectedPartyChange = (partyId: string) => {
    setSelectedPartyId(partyId);
    setItems((current) =>
      current.map((item) => {
        if (!item.productId) return item;
        const prod = products.find((pr) => pr.id === item.productId);
        const effective = resolveProductPrice(prod, partyId);
        return effective > 0 ? { ...item, unitPrice: effective } : item;
      }),
    );
  };

  // Reset or initialize modal
  useEffect(() => {
    if (!visible) {
      wasVisible.current = false;
      return;
    }
    if (wasVisible.current) return;
    wasVisible.current = true;
    let cancelled = false;
    setRefreshingStock(true);
    const initializeForm = async () => {
      let freshStock = stockList;
      try {
        freshStock = await onRefreshStock();
      } catch {
        // Existing cached stock still lets the customer continue if refresh is offline.
      }
      if (cancelled) return;
      setCurrentStockList(freshStock);
      const initialPartyId = '';
      setItems([{
        productId: '',
        warehouseId: '',
        allocations: [],
        qty: 0,
        unitPrice: 0,
        discount: 0,
      }]);
      setSelectedPartyId(initialPartyId);
      setCustomerMode('existing');
      setNewPartyName('');
      setNewPartyPhone('');
      setNewPartyAddress('');
      setNewPartyGstin('');
      setSaveNewParty(true);
      setTaxRate(18);
      setTransportCost('0');
      setTransportGstRate(0);
      setPaymentMode('UPI');
      setAmountPaidNow('0');
      setNotes('');
      setUpiPreviewData(null);
      setRefreshingStock(false);
    };

    void initializeForm();

    // Load UPI Accounts from Settings
    cachedMobileApiRequest<{ upiAccounts?: UpiAccount[] }>('/settings')
      .then((res) => {
        const accounts = res?.upiAccounts || [];
        setUpiAccounts(accounts);
        const primary = accounts.find((a) => a.isPrimary) || accounts[0] || null;
        setSelectedUpiAccount(primary);
      })
      .catch((err) => {
        console.warn('Failed to load UPI accounts:', err.message);
      });
    return () => { cancelled = true; };
  }, [visible, products, parties, stockList, onRefreshStock, getAvailableWarehouses, getStockAllocations, resolveProductPrice]);

  useEffect(() => setCurrentStockList(stockList), [stockList]);

  useEffect(() => {
    if (!visible) return;
    if (customerMode === 'existing' && !selectedPartyId && parties[0]) {
      setSelectedPartyId(parties[0].id);
    }
  }, [visible, parties, customerMode, selectedPartyId]);

  const handleProductChange = (index: number, newProductId: string) => {
    if (!newProductId) {
      setItems((prev) =>
        prev.map((item, i) =>
          i === index
            ? {
                ...item,
                productId: '',
                warehouseId: '',
                allocations: [],
                batchNo: undefined,
                qty: 0,
                unitPrice: 0,
                discount: 0,
              }
            : item,
        ),
      );
      return;
    }
    if (items.some((item, itemIndex) => itemIndex !== index && item.productId === newProductId)) {
      Alert.alert('Duplicate Product', 'Each product can be added only once to an invoice.');
      return;
    }
    const availWh = getAvailableWarehouses(newProductId);
    const allocations = getStockAllocations(newProductId, 0);
    const selectedProd = products.find((p) => p.id === newProductId);
    const defaultPrice = resolveProductPrice(selectedProd, selectedPartyId);

    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              productId: newProductId,
              warehouseId: availWh[0]?.id || '',
              allocations,
              qty: allocations.reduce((sum, allocation) => sum + allocation.qty, 0),
              batchNo: (() => {
                const batches = stockList.filter(
                  (s) => s.productId === newProductId && s.warehouseId === availWh[0]?.id && Number(s.quantity) > 0,
                );
                return batches.length === 1 ? batches[0].batchNo : undefined;
              })(),
              unitPrice: defaultPrice > 0 ? defaultPrice : 0,
            }
          : item,
      ),
    );
  };

  const handleAddItem = () => {
    const used = new Set(items.map((item) => item.productId).filter(Boolean));
    if (products.length > 0 && used.size >= products.length) {
      Alert.alert('All Products Added', 'All available products in your catalog are already added.');
      return;
    }
    const hasEmptyItem = items.some((item) => !item.productId);
    if (hasEmptyItem) {
      Alert.alert('Select Product', 'Please select a product for the empty item before adding another.');
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        productId: '',
        warehouseId: '',
        allocations: [],
        qty: 0,
        unitPrice: 0,
        discount: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAllocationQty = (itemIndex: number, allocationIndex: number, text: string) => {
    const qty = Math.max(0, Number.parseFloat(text) || 0);
    setItems((prev) =>
      prev.map((item, index) => {
        if (index !== itemIndex) return item;
        const allocations = (item.allocations || []).map((allocation, allocationIdx) =>
          allocationIdx === allocationIndex
            ? { ...allocation, qty }
            : allocation,
        );
        return {
          ...item,
          allocations,
          qty: allocations.reduce((sum, allocation) => sum + allocation.qty, 0),
        };
      }),
    );
  };

  const handleUpdateItem = (index: number, field: keyof InvoiceLineItem, value: any) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const { subtotal, itemsTax, numTransportCost, transportTax, grandTotal } = useMemo(() => {
    const rawSub = items.reduce((acc, it) => {
      const lineTotal = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0) - (Number(it.discount) || 0);
      return acc + Math.max(0, lineTotal);
    }, 0);
    const tax = Math.round((rawSub * (taxRate / 100)) * 100) / 100;
    const tCost = Math.max(0, Number(transportCost) || 0);
    const tTax = Math.round((tCost * (transportGstRate / 100)) * 100) / 100;
    return {
      subtotal: rawSub,
      itemsTax: tax,
      numTransportCost: tCost,
      transportTax: tTax,
      grandTotal: rawSub + tax + tCost + tTax,
    };
  }, [items, taxRate, transportCost, transportGstRate]);

  const parsedPaid = amountPaidNow === '' ? 0 : Number(amountPaidNow);
  const effectivePaidNow = paymentMode !== 'CREDIT' && Number.isFinite(parsedPaid)
    ? Math.max(0, Math.min(parsedPaid, grandTotal))
    : 0;
  const balanceDue = Math.max(0, Number((grandTotal - effectivePaidNow).toFixed(2)));

  const resetForm = () => {
    setCustomerMode('existing');
    setSelectedPartyId('');
    setNewPartyName('');
    setNewPartyPhone('');
    setNewPartyAddress('');
    setNewPartyGstin('');
    setItems([{
      productId: '',
      warehouseId: '',
      allocations: [],
      qty: 0,
      unitPrice: 0,
      discount: 0,
    }]);
    setTaxRate(18);
    setPaymentMode('UPI');
    setAmountPaidNow('0');
    setNotes('');
  };

  const fetchPreviewQr = async (amt: number, targetAcc?: UpiAccount | null) => {
    const acc = targetAcc !== undefined ? targetAcc : selectedUpiAccount;
    setLoadingQr(true);
    try {
      const preview = await mobileApiRequest<any>('/invoices/preview-upi-qr', {
        method: 'POST',
        body: JSON.stringify({
          amount: amt,
          vpa: acc?.upiId,
          merchantName: acc?.merchantName,
        }),
      });
      setUpiPreviewData({
        qrDataUrl: preview.qrDataUrl,
        vpa: preview.vpa || acc?.upiId || '',
        amount: amt,
      });
    } catch (err: any) {
      setUpiPreviewData(null);
      Alert.alert('UPI Generation Failed', err.message || 'Could not generate live UPI QR');
    } finally {
      setLoadingQr(false);
    }
  };

  const handleCreateInvoice = async (modeOverride?: 'UPI' | 'CASH') => {
    if (customerMode === 'existing' && !selectedPartyId) {
      Alert.alert('Validation Error', 'Please select a customer');
      return;
    }
    if (customerMode === 'new' && (!newPartyName.trim() || !newPartyPhone.trim())) {
      Alert.alert('Validation Error', 'Customer Name and Mobile Number are required');
      return;
    }
    if (customerMode === 'new' && newPartyPhone.replace(/\D/g, '').length !== 10) {
      Alert.alert('Validation Error', 'Customer mobile number must be 10 digits.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Validation Error', 'Please add at least one line item');
      return;
    }

    for (const it of items) {
      if (!it.productId) {
        Alert.alert('Validation Error', 'Please select a product for all line items');
        return;
      }
      if (Number(it.qty) <= 0) {
        Alert.alert('Validation Error', 'Allocate at least one unit of stock for every line item.');
        return;
      }
      if (!(it.allocations || []).some((allocation) => allocation.qty > 0)) {
        Alert.alert('Out of Stock', 'Please allocate quantity for every item from available stock.');
        return;
      }
      if (!(it.unitPrice > 0)) {
        Alert.alert('Validation Error', 'Unit price must be greater than zero.');
        return;
      }
      if (Number(it.discount) < 0) {
        Alert.alert('Validation Error', 'Discount cannot be negative.');
        return;
      }
    }

    const finalMode = modeOverride || paymentMode;
    const finalPaid = finalMode !== 'CREDIT' ? effectivePaidNow : 0;

    // Upfront UPI QR checkout flow: show dynamic exact QR before creating DB invoice
    if (finalMode === 'UPI' && !modeOverride && finalPaid > 0) {
      await fetchPreviewQr(finalPaid, selectedUpiAccount);
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        taxRate,
        transportCost: numTransportCost,
        transportGstRate,
        paymentMode: finalMode,
        notes: notes.trim() || undefined,
        items: items.flatMap((it) => {
          const allocations = (it.allocations || []).filter((allocation) => allocation.qty > 0);
          const totalAllocated = allocations.reduce((sum, allocation) => sum + allocation.qty, 0);
          return allocations.map((allocation) => ({
            productId: it.productId,
            warehouseId: allocation.warehouseId || undefined,
            batchNo: allocation.batchNo?.trim() || undefined,
            qty: Number(allocation.qty),
            unitPrice: Number(it.unitPrice),
            discount: totalAllocated > 0 ? Number(((Number(it.discount || 0) * allocation.qty) / totalAllocated).toFixed(2)) : 0,
          }));
        }),
        amountPaidNow: finalPaid,
      };

      if (customerMode === 'existing') {
        payload.partyId = selectedPartyId;
      } else {
        payload.newParty = {
          name: newPartyName.trim(),
          phone: newPartyPhone.trim(),
          address: newPartyAddress.trim() || undefined,
          gstin: newPartyGstin.trim() ? newPartyGstin.trim().toUpperCase() : undefined,
          isSaved: saveNewParty,
        };
      }

      const res = await mobileApiRequest('/invoices', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setUpiPreviewData(null);
      resetForm();
      onClose();
      onSuccess(res);
    } catch (err: any) {
      Alert.alert('Creation Failed', err.message || 'Could not generate invoice');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Create New Tax Invoice"
      subtitle="Issue GST bill and deduct stock directly from product inventory"
    >
      {refreshingStock ? (
        <View style={styles.stockRefreshNotice}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.stockRefreshText}>Checking the latest stock before billing…</Text>
        </View>
      ) : null}

      <View pointerEvents={refreshingStock ? 'none' : 'auto'} style={{ opacity: refreshingStock ? 0.5 : 1 }}>
        {/* 1. Customer Section */}
        <CustomerSelector
          customerMode={customerMode}
          onCustomerModeChange={setCustomerMode}
          parties={parties}
          selectedPartyId={selectedPartyId}
          onSelectedPartyChange={handleSelectedPartyChange}
          newPartyName={newPartyName}
          onNewPartyNameChange={setNewPartyName}
          newPartyPhone={newPartyPhone}
          onNewPartyPhoneChange={setNewPartyPhone}
          newPartyGstin={newPartyGstin}
          onNewPartyGstinChange={setNewPartyGstin}
          newPartyAddress={newPartyAddress}
          onNewPartyAddressChange={setNewPartyAddress}
          saveNewParty={saveNewParty}
          onSaveNewPartyChange={setSaveNewParty}
        />

        {/* 2. Line Items Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.modalSectionTitle}>2. Line Items</Text>
          <Button title="+ Add Item" size="sm" variant="outline" onPress={handleAddItem} />
        </View>

        {items.map((item, idx) => (
          <InvoiceLineItemCard
            key={idx}
            index={idx}
            item={item}
            products={products}
            warehouses={warehouses}
            canRemove={items.length > 1}
            onProductChange={(newProductId) => handleProductChange(idx, newProductId)}
            onAllocationQtyChange={(allocationIndex, text) => handleAllocationQty(idx, allocationIndex, text)}
            onUnitPriceChange={(price) => handleUpdateItem(idx, 'unitPrice', price)}
            onDiscountChange={(discount) => handleUpdateItem(idx, 'discount', discount)}
            onRemove={() => handleRemoveItem(idx)}
          />
        ))}

        {/* 3. Tax & Payment Settlement */}
        <Text style={styles.modalSectionTitle}>3. Tax & Settlement</Text>
        <Input
          label="Items GST Rate (%)"
          placeholder="e.g. 18 or 0"
          value={String(taxRate)}
          onChangeText={(value) => {
            const num = Number.parseFloat(value);
            setTaxRate(isNaN(num) ? 0 : Math.min(100, Math.max(0, num)));
          }}
          keyboardType="decimal-pad"
        />

        <Input
          label="Cartage / Transport Cost (₹)"
          placeholder="0.00"
          value={transportCost}
          onChangeText={setTransportCost}
          keyboardType="decimal-pad"
        />

        <Input
          label="Transport GST Rate (%)"
          placeholder="e.g. 5 or 0"
          value={String(transportGstRate)}
          onChangeText={(value) => {
            const num = Number.parseFloat(value);
            setTransportGstRate(isNaN(num) ? 0 : Math.min(100, Math.max(0, num)));
          }}
          keyboardType="decimal-pad"
        />

        <Text style={styles.fieldLabel}>Payment Mode</Text>
        <View style={styles.tabToggle}>
          {(['UPI', 'CASH', 'BANK_TRANSFER', 'CREDIT'] as const).map((mode) => {
            const isSelected = paymentMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                onPress={() => {
                  setPaymentMode(mode);
                  if (mode === 'CREDIT') setAmountPaidNow('0');
                  else if (paymentMode === 'CREDIT' && amountPaidNow === '0') setAmountPaidNow('');
                }}
                style={[styles.toggleBtn, isSelected && styles.toggleBtnActive]}
              >
                <Text style={[styles.toggleText, isSelected && styles.toggleTextActive]}>
                  {mode}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {paymentMode !== 'CREDIT' ? (
          <>
            <Input
              label="Amount Paid Now (₹)"
              placeholder={String(Math.round(grandTotal * 100) / 100)}
              value={amountPaidNow}
              onChangeText={setAmountPaidNow}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              onPress={() => setAmountPaidNow(grandTotal.toFixed(2))}
              style={styles.fullPayBtn}
            >
              <Text style={styles.fullPayText}>Full Pay ({formatINR(grandTotal)})</Text>
            </TouchableOpacity>
          </>
        ) : null}

        <Input
          label="Internal Billing Notes"
          placeholder="e.g. Counter sale, self-pickup or special rate"
          value={notes}
          onChangeText={setNotes}
        />

        {/* Calculation Summary Box */}
        <Card elevated style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Items Subtotal</Text>
            <Text style={styles.summaryVal}>{formatINR(subtotal)}</Text>
          </View>
          {taxRate > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Items GST ({taxRate}%)</Text>
              <Text style={styles.summaryVal}>{formatINR(itemsTax)}</Text>
            </View>
          )}
          {numTransportCost > 0 && (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Cartage / Transport</Text>
                <Text style={styles.summaryVal}>{formatINR(numTransportCost)}</Text>
              </View>
              {transportGstRate > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Transport GST ({transportGstRate}%)</Text>
                  <Text style={styles.summaryVal}>{formatINR(transportTax)}</Text>
                </View>
              )}
            </>
          )}
          <View style={[styles.summaryRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
            <Text style={styles.grandTotalVal}>{formatINR(grandTotal)}</Text>
          </View>
          {balanceDue > 0 && paymentMode !== 'CREDIT' ? (
            <View style={styles.balanceDueRow}>
              <Text style={styles.balanceDueLabel}>Remaining Due</Text>
              <Text style={styles.balanceDueValue}>{formatINR(balanceDue)}</Text>
            </View>
          ) : null}
        </Card>

        <Button
          title={
            loadingQr
              ? 'Generating UPI QR...'
              : submitting
              ? 'Generating Invoice...'
              : paymentMode === 'UPI' && effectivePaidNow > 0
              ? `Proceed to UPI QR (${formatINR(effectivePaidNow)})`
              : `Generate Invoice (${formatINR(grandTotal)})`
          }
          onPress={() => handleCreateInvoice()}
          loading={submitting || loadingQr || refreshingStock}
          size="lg"
          style={{ marginTop: 14 }}
        />
      </View>

      {/* Upfront Live UPI QR Verification Modal */}
      <CounterUpiModal
        visible={Boolean(upiPreviewData)}
        onClose={() => setUpiPreviewData(null)}
        amount={upiPreviewData?.amount || effectivePaidNow}
        balanceDue={balanceDue}
        upiPreviewData={upiPreviewData}
        upiAccounts={upiAccounts}
        selectedUpiAccount={selectedUpiAccount}
        onSelectUpiAccount={(acc) => {
          setSelectedUpiAccount(acc);
          if (upiPreviewData?.amount) {
            setUpiPreviewData((current) => current ? { ...current, qrDataUrl: '', vpa: acc.upiId } : current);
            void fetchPreviewQr(upiPreviewData.amount, acc);
          }
        }}
        loadingQr={loadingQr}
        submitting={submitting}
        onConfirmUpi={() => handleCreateInvoice('UPI')}
        onPayCashInstead={() => {
          setUpiPreviewData(null);
          setPaymentMode('CASH');
          handleCreateInvoice('CASH');
        }}
      />
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  stockRefreshNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 10,
    marginBottom: 6,
    borderRadius: 10,
    backgroundColor: Colors.dark.card,
  },
  stockRefreshText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 14,
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 2,
    marginBottom: 10,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  toggleTextActive: {
    color: '#09090B',
    fontWeight: '800',
  },
  taxRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  taxChip: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  taxChipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  taxChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  taxChipTextActive: {
    color: '#09090B',
    fontWeight: '800',
  },
  fullPayBtn: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 10,
  },
  fullPayText: {
    color: Colors.dark.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  summaryBox: {
    padding: 14,
    marginVertical: 10,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  summaryVal: {
    fontSize: 13,
    color: Colors.dark.text,
    fontWeight: '600',
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    paddingTop: 8,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  grandTotalVal: {
    fontSize: 17,
    fontWeight: '900',
    color: '#10B981',
  },
  balanceDueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  balanceDueLabel: {
    fontSize: 12,
    color: '#FBBF24',
    fontWeight: '700',
  },
  balanceDueValue: {
    fontSize: 13,
    color: '#FBBF24',
    fontWeight: '800',
  },
});
