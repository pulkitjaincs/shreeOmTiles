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
  warehouses?: Warehouse[];
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
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyPhone, setNewPartyPhone] = useState('');
  const [newPartyAddress, setNewPartyAddress] = useState('');
  const [newPartyGstin, setNewPartyGstin] = useState('');
  const [saveNewParty, setSaveNewParty] = useState(true);

  const [items, setItems] = useState<InvoiceLineItem[]>([
    {
      productId: '',
      qty: 1,
      unitPrice: 0,
      discount: 0,
    },
  ]);

  const [taxRate, setTaxRate] = useState<number>(18);
  const [transportCost, setTransportCost] = useState<string>('0');
  const [transportGstRate, setTransportGstRate] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'UPI' | 'CASH' | 'CREDIT' | 'BANK_TRANSFER'>('UPI');
  const [amountPaidNow, setAmountPaidNow] = useState<string>('');
  const [isAmountCustom, setIsAmountCustom] = useState(false);
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

  const onRefreshStockRef = useRef(onRefreshStock);
  useEffect(() => {
    onRefreshStockRef.current = onRefreshStock;
  }, [onRefreshStock]);

  const stockListRef = useRef(stockList);
  useEffect(() => {
    stockListRef.current = stockList;
  }, [stockList]);

  const resetForm = useCallback(() => {
    setCustomerMode('existing');
    setSelectedPartyId('');
    setNewPartyName('');
    setNewPartyPhone('');
    setNewPartyAddress('');
    setNewPartyGstin('');
    setSaveNewParty(true);
    setItems([{
      productId: '',
      qty: 1,
      unitPrice: 0,
      discount: 0,
    }]);
    setTaxRate(18);
    setTransportCost('0');
    setTransportGstRate(0);
    setPaymentMode('UPI');
    setAmountPaidNow('');
    setIsAmountCustom(false);
    setNotes('');
    setUpiPreviewData(null);
  }, []);

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

  // Reset or initialize modal lifecycle when opened
  useEffect(() => {
    if (!visible) {
      wasVisible.current = false;
      setRefreshingStock(false);
      return;
    }
    if (wasVisible.current) return;
    wasVisible.current = true;

    let isMountedOrOpen = true;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    // Immediately reset the form state so old inputs do not persist
    resetForm();
    setRefreshingStock(true);

    const initializeStock = async () => {
      try {
        const STOCK_CHECK_TIMEOUT_MS = 4000;
        const timeoutPromise = new Promise<StockLedger[]>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('STOCK_TIMEOUT'));
          }, STOCK_CHECK_TIMEOUT_MS);
        });

        const rawStockResult = typeof onRefreshStockRef.current === 'function'
          ? onRefreshStockRef.current()
          : (stockListRef.current || []);
        const stockPromise = Promise.resolve(rawStockResult);
        // Prevent unhandled promise rejection if timeout fires first and stockPromise fails later
        stockPromise.catch(() => {});

        const freshStock = await Promise.race([stockPromise, timeoutPromise]);
        if (!isMountedOrOpen) return;
        if (Array.isArray(freshStock)) {
          setCurrentStockList(freshStock);
        }
      } catch (err: any) {
        if (err?.message !== 'STOCK_TIMEOUT') {
          console.warn('[CreateInvoiceModal] Stock verification failed, using cached stock:', err?.message);
        } else {
          console.warn('[CreateInvoiceModal] Stock verification timed out after 4s, using cached stock');
        }
        if (!isMountedOrOpen) return;
        if (Array.isArray(stockListRef.current)) {
          setCurrentStockList(stockListRef.current);
        }
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (isMountedOrOpen) {
          setRefreshingStock(false);
        }
      }
    };

    void initializeStock();

    // Load UPI Accounts from Settings
    cachedMobileApiRequest<{ upiAccounts?: UpiAccount[] }>('/settings')
      .then((res) => {
        if (!isMountedOrOpen) return;
        const accounts = res?.upiAccounts || [];
        setUpiAccounts(accounts);
        const primary = accounts.find((a) => a.isPrimary) || accounts[0] || null;
        setSelectedUpiAccount(primary);
      })
      .catch((err) => {
        console.warn('Failed to load UPI accounts:', err?.message);
      });

    return () => {
      isMountedOrOpen = false;
      wasVisible.current = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setRefreshingStock(false);
    };
  }, [visible, resetForm]);

  useEffect(() => {
    if (Array.isArray(stockList)) {
      setCurrentStockList(stockList);
    }
  }, [stockList]);


  const handleProductChange = (index: number, newProductId: string) => {
    if (!newProductId) {
      setItems((prev) =>
        prev.map((item, i) =>
          i === index
            ? {
                ...item,
                productId: '',
                qty: 1,
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
    const selectedProd = products.find((p) => p.id === newProductId);
    const defaultPrice = resolveProductPrice(selectedProd, selectedPartyId);

    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              productId: newProductId,
              qty: item.qty > 0 ? item.qty : 1,
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
        qty: 1,
        unitPrice: 0,
        discount: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleQtyChange = (index: number, qty: number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, qty: Math.max(0, qty) } : item)),
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

  const effectivePaidNow = useMemo(() => {
    if (paymentMode === 'CREDIT') return 0;
    if (!isAmountCustom) return grandTotal;
    const parsed = parseFloat(amountPaidNow);
    if (isNaN(parsed) || parsed < 0) return 0;
    return Math.min(parsed, grandTotal);
  }, [paymentMode, isAmountCustom, grandTotal, amountPaidNow]);
  const balanceDue = Math.max(0, Number((grandTotal - effectivePaidNow).toFixed(2)));


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
        Alert.alert('Validation Error', 'Please enter a valid quantity for all line items.');
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
        items: items.map((it) => ({
          productId: it.productId,
          qty: Number(it.qty),
          unitPrice: Number(it.unitPrice),
          discount: Number(it.discount || 0),
        })),
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
            stockList={currentStockList}
            canRemove={items.length > 1}
            onProductChange={(newProductId) => handleProductChange(idx, newProductId)}
            onQtyChange={(qty) => handleQtyChange(idx, qty)}
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
                  if (mode === 'CREDIT') {
                    setIsAmountCustom(true);
                    setAmountPaidNow('0');
                  } else if (paymentMode === 'CREDIT') {
                    setIsAmountCustom(false);
                    setAmountPaidNow('');
                  }
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
              placeholder={grandTotal > 0 ? grandTotal.toFixed(2) : '0.00'}
              value={
                isAmountCustom
                  ? amountPaidNow
                  : grandTotal > 0
                  ? grandTotal.toFixed(2)
                  : ''
              }
              onChangeText={(val) => {
                setIsAmountCustom(true);
                setAmountPaidNow(val);
              }}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              onPress={() => {
                setIsAmountCustom(false);
                setAmountPaidNow(grandTotal.toFixed(2));
              }}
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
