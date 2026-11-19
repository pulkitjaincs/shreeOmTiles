import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CalendarModal } from '@/components/ui/CalendarModal';
import type { ThemeColors } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/lib/theme-context';
import { formatINR } from '@/lib/formatters';
import { mobileApiRequest, cachedMobileApiRequest } from '@/lib/api';
import { Product, Warehouse, Party, StockLedger, InvoiceLineItem, UpiAccount, PaymentSplitItem, Invoice } from './types';
import { CustomerSelector } from './CustomerSelector';
import { InvoiceLineItemCard } from './InvoiceLineItemCard';
import { CounterUpiModal } from './CounterUpiModal';
import { MultiPaymentSplitSelector } from '@/components/ui/MultiPaymentSplitSelector';

function formatDateToIST(dateInput: Date | string): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${day}`;
}

function getTodayLocalDate(): string {
  return formatDateToIST(new Date());
}

function getYesterdayLocalDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDateToIST(d);
}

interface CreateInvoiceModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (newInvoice?: any) => void;
  products: Product[];
  warehouses?: Warehouse[];
  parties: Party[];
  stockList: StockLedger[];
  onRefreshStock: () => Promise<StockLedger[]>;
  invoiceToEdit?: Invoice | null;
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
  invoiceToEdit,
}: CreateInvoiceModalProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const wasVisible = useRef(false);
  const [customerMode, setCustomerMode] = useState<'existing' | 'new' | 'cash_sale'>('existing');
  const [invoiceDate, setInvoiceDate] = useState<string>(getTodayLocalDate);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [billAddress, setBillAddress] = useState('');
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
  const [discountAmount, setDiscountAmount] = useState<string>('0');
  const [transportCost, setTransportCost] = useState<string>('0');
  const [transportGstRate, setTransportGstRate] = useState<number>(0);
  const [roundOffEnabled, setRoundOffEnabled] = useState(false);
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplitItem[]>([
    { mode: 'UPI', amount: '' },
  ]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
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

  // Selected party & balance calculation (context display only)
  const selectedParty = useMemo(
    () => parties.find((p) => p.id === selectedPartyId),
    [parties, selectedPartyId],
  );

  const partyBalance = useMemo(() => {
    if (!selectedParty?.creditLedgers) return 0;
    return selectedParty.creditLedgers.reduce((sum: number, cl: any) => {
      if (cl.status === 'SETTLED') return sum;
      if (invoiceToEdit && cl.invoiceId === invoiceToEdit.id) return sum;
      const amt = Number(cl.amountDue || 0);
      return cl.type === 'RECEIVABLE' ? sum + amt : sum - amt;
    }, 0);
  }, [selectedParty, invoiceToEdit]);

  const resetForm = useCallback(() => {
    setCustomerMode('existing');
    setInvoiceDate(getTodayLocalDate());
    setSelectedPartyId('');
    setBillAddress('');
    setNewPartyName('');
    setNewPartyPhone('');
    setNewPartyAddress('');
    setNewPartyGstin('');
    setSaveNewParty(true);
    setItems([
      {
        productId: '',
        qty: 1,
        unitPrice: 0,
        discount: 0,
      },
    ]);
    setTaxRate(18);
    setDiscountAmount('0');
    setTransportCost('0');
    setTransportGstRate(0);
    setRoundOffEnabled(false);
    setPaymentSplits([{ mode: 'UPI', amount: '' }]);
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
    const party = parties.find((p) => p.id === partyId);
    if (party?.address) {
      setBillAddress(party.address);
    }
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
      return;
    }
    if (wasVisible.current) return;
    wasVisible.current = true;

    let isMountedOrOpen = true;

    if (invoiceToEdit) {
      // Edit mode initialization
      const isCash = Boolean(invoiceToEdit.isCashSale);
      setCustomerMode(isCash ? 'cash_sale' : 'existing');
      const rawDate = invoiceToEdit.invoiceDate || invoiceToEdit.createdAt;
      if (rawDate) {
        setInvoiceDate(formatDateToIST(rawDate));
      } else {
        setInvoiceDate(getTodayLocalDate());
      }
      const pId = invoiceToEdit.partyId || invoiceToEdit.party?.id || '';
      setSelectedPartyId(pId);
      setNewPartyName(invoiceToEdit.party?.name || '');
      setNewPartyPhone(invoiceToEdit.party?.phone || '');
      setBillAddress(invoiceToEdit.address || invoiceToEdit.party?.address || '');
      setNewPartyAddress(invoiceToEdit.address || invoiceToEdit.party?.address || '');
      setTaxRate(Number(invoiceToEdit.taxRate ?? (invoiceToEdit.taxBreakup?.rate ?? 18)));
      setDiscountAmount(String((invoiceToEdit as any).discountAmount ?? '0'));
      setTransportCost(String((invoiceToEdit as any).transportCost ?? '0'));
      setTransportGstRate(Number((invoiceToEdit as any).transportGstRate ?? 0));
      setRoundOffEnabled(Boolean((invoiceToEdit as any).roundOffEnabled));
      setNotes(invoiceToEdit.notes || '');

      if (invoiceToEdit.items && invoiceToEdit.items.length > 0) {
        setItems(
          invoiceToEdit.items.map((it: any) => ({
            productId: it.productId,
            qty: Number(it.qty || 1),
            unitPrice: Number(it.unitPrice || 0),
            discount: 0,
          })),
        );
      }

      if (invoiceToEdit.payments && invoiceToEdit.payments.length > 0) {
        setPaymentSplits(
          invoiceToEdit.payments.map((p: any) => ({
            mode: p.mode,
            amount: String(p.amount),
            upiUtr: p.upiUtr,
            referenceNo: p.referenceNo,
          })),
        );
      } else {
        setPaymentSplits([
          {
            mode: (invoiceToEdit.paymentMode as any) || 'CASH',
            amount: String(invoiceToEdit.total || ''),
          },
        ]);
      }
    } else {
      resetForm();
    }

    if (Array.isArray(stockListRef.current)) {
      setCurrentStockList(stockListRef.current);
    }

    // Silently revalidate stock in the background without blocking the UI
    const initializeStock = async () => {
      try {
        if (typeof onRefreshStockRef.current === 'function') {
          const freshStock = await onRefreshStockRef.current();
          if (isMountedOrOpen && Array.isArray(freshStock)) {
            setCurrentStockList(freshStock);
          }
        }
      } catch (err: any) {
        console.warn(
          '[CreateInvoiceModal] Background stock refresh completed with cache fallback:',
          err?.message,
        );
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
    };
  }, [visible, invoiceToEdit, resetForm]);

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
      Alert.alert(
        'Select Product',
        'Please select a product for the empty item before adding another.',
      );
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

  const { itemsSubtotal, discount, subtotal, itemsTax, numTransportCost, transportTax, calculatedTotal, roundOffAmount, grandTotal } = useMemo(() => {
    const rawSub = items.reduce((acc, it) => acc + Math.max(0, (Number(it.qty) || 0) * (Number(it.unitPrice) || 0)), 0);
    const requestedDiscount = Math.max(0, Number(discountAmount) || 0);
    const appliedDiscount = Math.min(rawSub, requestedDiscount);
    const taxableSubtotal = Math.round((rawSub - appliedDiscount) * 100) / 100;
    const tax = Math.round(taxableSubtotal * (taxRate / 100) * 100) / 100;
    const tCost = Math.max(0, Number(transportCost) || 0);
    const tTax = Math.round(tCost * (transportGstRate / 100) * 100) / 100;
    const beforeRound = Math.round((taxableSubtotal + tax + tCost + tTax) * 100) / 100;
    const adjustment = roundOffEnabled ? Math.round(beforeRound) - beforeRound : 0;
    return {
      itemsSubtotal: rawSub,
      discount: appliedDiscount,
      subtotal: taxableSubtotal,
      itemsTax: tax,
      numTransportCost: tCost,
      transportTax: tTax,
      calculatedTotal: beforeRound,
      roundOffAmount: adjustment,
      grandTotal: Math.round((beforeRound + adjustment) * 100) / 100,
    };
  }, [items, taxRate, discountAmount, transportCost, transportGstRate, roundOffEnabled]);

  const validSplits = useMemo(() => {
    return paymentSplits.filter((s) => {
      const parsed = parseFloat(s.amount);
      return !isNaN(parsed) && parsed > 0;
    });
  }, [paymentSplits]);

  const effectivePaidNow = useMemo(() => {
    return validSplits.reduce((sum, s) => sum + parseFloat(s.amount), 0);
  }, [validSplits]);

  const balanceDue = Math.max(0, Number((grandTotal - effectivePaidNow).toFixed(2)));

  const upiSplit = validSplits.find((s) => s.mode === 'UPI');
  const upiSplitAmount = upiSplit ? parseFloat(upiSplit.amount) : 0;

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
    if (submitting) return;
    if (customerMode === 'existing' && !selectedPartyId) {
      Alert.alert('Validation Error', 'Please select a customer');
      return;
    }
    if (customerMode === 'new') {
      if (!newPartyName.trim() || !newPartyPhone.trim()) {
        Alert.alert('Validation Error', 'Customer Name and Mobile Number are required');
        return;
      }
      if (newPartyPhone.replace(/\D/g, '').length !== 10) {
        Alert.alert('Validation Error', 'Customer mobile number must be 10 digits.');
        return;
      }
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

    // Upfront UPI QR checkout flow (only in create mode)
    if (!invoiceToEdit && upiSplitAmount > 0 && !modeOverride && !upiPreviewData) {
      await fetchPreviewQr(upiSplitAmount, selectedUpiAccount);
      return;
    }

    const resolvedMode =
      modeOverride ||
      (validSplits.length > 1
        ? 'SPLIT'
        : validSplits.length === 1
        ? validSplits[0].mode
        : 'CREDIT');

    setSubmitting(true);
    try {
      const payload: any = {
        invoiceDate: new Date(invoiceDate).toISOString(),
        taxRate,
        discountAmount: discount,
        roundOffEnabled,
        roundOffAmount,
        transportCost: numTransportCost,
        transportGstRate,
        paymentMode: resolvedMode,
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          productId: it.productId,
          qty: Number(it.qty),
          unitPrice: Number(it.unitPrice),
          discount: 0,
        })),
        amountPaidNow: effectivePaidNow,
        payments: validSplits.map((s) => ({
          mode: s.mode,
          amount: parseFloat(s.amount),
          upiUtr: s.upiUtr?.trim() || undefined,
          notes: s.notes?.trim() || undefined,
        })),
      };

      if (customerMode === 'cash_sale') {
        payload.isCashSale = true;
        payload.address = (billAddress || newPartyAddress).trim() || undefined;
        payload.newParty = {
          name: newPartyName.trim() || 'Cash Sale',
          phone: newPartyPhone.trim(),
          address: (billAddress || newPartyAddress).trim() || undefined,
          isSaved: false,
        };
      } else if (customerMode === 'existing') {
        payload.partyId = selectedPartyId;
        payload.address = billAddress.trim() || undefined;
        payload.previousBalance =
          invoiceToEdit &&
          (invoiceToEdit.partyId === selectedPartyId ||
            (invoiceToEdit as any).party?.id === selectedPartyId)
            ? Number(invoiceToEdit.previousBalance || 0)
            : partyBalance;
      } else {
        payload.address = newPartyAddress.trim() || undefined;
        payload.newParty = {
          name: newPartyName.trim(),
          phone: newPartyPhone.trim(),
          address: newPartyAddress.trim() || undefined,
          gstin: newPartyGstin.trim() ? newPartyGstin.trim().toUpperCase() : undefined,
          isSaved: saveNewParty,
        };
      }

      const endpoint = invoiceToEdit ? `/invoices/${invoiceToEdit.id}` : '/invoices';
      const method = invoiceToEdit ? 'PUT' : 'POST';

      const res = await mobileApiRequest(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      setUpiPreviewData(null);
      resetForm();
      onClose();
      onSuccess(res);
    } catch (err: any) {
      Alert.alert(
        invoiceToEdit ? 'Update Failed' : 'Creation Failed',
        err.message || 'Could not process invoice',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={invoiceToEdit ? `Edit Invoice #${invoiceToEdit.invoiceNo}` : 'Create New Invoice'}
      subtitle={
        invoiceToEdit
          ? 'Update line items, pricing, address, or payment splits'
          : 'Issue GST bill and deduct stock directly from product inventory'
      }
    >
      <View>
        {/* Invoice Date Selection */}
        <Card style={styles.dateCard}>
          <View style={styles.dateCardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="calendar-outline" size={15} color={colors.primary} />
              <Text style={styles.dateCardLabel}>INVOICE DATE</Text>
            </View>
            <Text style={styles.dateCardSubtitle}>Past & future allowed</Text>
          </View>
          <View style={styles.dateActionRow}>
            <TouchableOpacity
              style={[
                styles.dateChip,
                invoiceDate === getTodayLocalDate() && styles.dateChipActive,
              ]}
              onPress={() => setInvoiceDate(getTodayLocalDate())}
            >
              <Text
                style={[
                  styles.dateChipText,
                  invoiceDate === getTodayLocalDate() && styles.dateChipTextActive,
                ]}
              >
                Today
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.dateChip,
                invoiceDate === getYesterdayLocalDate() && styles.dateChipActive,
              ]}
              onPress={() => setInvoiceDate(getYesterdayLocalDate())}
            >
              <Text
                style={[
                  styles.dateChipText,
                  invoiceDate === getYesterdayLocalDate() && styles.dateChipTextActive,
                ]}
              >
                Yesterday
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.datePickerBtn}
              onPress={() => setCalendarOpen(true)}
            >
              <Ionicons name="calendar" size={14} color={colors.primary} />
              <Text style={styles.datePickerBtnText}>
                {invoiceDate || 'Select Date'}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* 1. Customer Section */}
        <CustomerSelector
          customerMode={customerMode}
          onCustomerModeChange={setCustomerMode}
          parties={parties}
          selectedPartyId={selectedPartyId}
          onSelectedPartyChange={handleSelectedPartyChange}
          billAddress={billAddress}
          onBillAddressChange={setBillAddress}
          partyBalance={partyBalance}
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
          <Text style={styles.modalSectionTitle}>2. Line Items & Products</Text>
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
            onRemove={() => handleRemoveItem(idx)}
          />
        ))}

        {/* Add Product Button Relocated Directly Below Last Product Card */}
        <Button
          title="+ Add Another Product"
          size="sm"
          variant="outline"
          onPress={handleAddItem}
          style={{ marginBottom: 16 }}
        />

        {/* 3. Tax & Transport Controls Directly Above Summary */}
        <Text style={styles.modalSectionTitle}>3. Tax & Transport</Text>
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
          label="Bill Discount Before GST (₹)"
          placeholder="0.00"
          value={discountAmount}
          onChangeText={setDiscountAmount}
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
            <Text style={styles.summaryVal}>{formatINR(itemsSubtotal)}</Text>
          </View>
          {discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Bill Discount</Text>
              <Text style={styles.summaryVal}>−{formatINR(discount)}</Text>
            </View>
          )}
          {discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Taxable Amount</Text>
              <Text style={styles.summaryVal}>{formatINR(subtotal)}</Text>
            </View>
          )}
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
          {roundOffEnabled && (
            <>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Before round-off</Text>
              <Text style={styles.summaryVal}>{formatINR(calculatedTotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Round-off</Text>
              <Text style={styles.summaryVal}>{roundOffAmount >= 0 ? '+' : '−'}{formatINR(Math.abs(roundOffAmount))}</Text>
            </View>
            </>
          )}
          <View style={[styles.summaryRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
            <Text style={styles.grandTotalVal}>{formatINR(grandTotal)}</Text>
          </View>
          <Button
            title={roundOffEnabled ? '✓ Round off enabled' : 'Round off total amount'}
            size="sm"
            variant="outline"
            onPress={() => setRoundOffEnabled((enabled) => !enabled)}
            style={{ marginTop: 8 }}
          />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Amount Paid Upfront</Text>
            <Text style={[styles.summaryVal, { color: colors.statusPaid }]}>
              {formatINR(effectivePaidNow)}
            </Text>
          </View>
          {balanceDue > 0 ? (
            <View style={styles.balanceDueRow}>
              <Text style={styles.balanceDueLabel}>Remaining Due</Text>
              <Text style={styles.balanceDueValue}>{formatINR(balanceDue)}</Text>
            </View>
          ) : null}
        </Card>

        {/* 4. Payment Breakdown (Relocated to the very end below Summary) */}
        <Text style={[styles.modalSectionTitle, { marginTop: 16 }]}>4. Payment Breakdown</Text>
        <MultiPaymentSplitSelector
          totalAmount={grandTotal}
          splits={paymentSplits}
          onChange={setPaymentSplits}
          allowCredit={true}
          onPreviewUpi={(amt) => void fetchPreviewQr(amt, selectedUpiAccount)}
          previewUpiLoading={loadingQr}
        />

        <Button
          title={
            loadingQr
              ? 'Generating UPI QR...'
              : submitting
              ? invoiceToEdit
                ? 'Updating Invoice...'
                : 'Generating Invoice...'
              : invoiceToEdit
              ? `Save & Update Invoice (${formatINR(grandTotal)})`
              : upiSplitAmount > 0
              ? `Proceed to UPI QR (${formatINR(upiSplitAmount)})`
              : `Generate Invoice (${formatINR(grandTotal)})`
          }
          onPress={() => handleCreateInvoice()}
          loading={submitting || loadingQr}
          size="lg"
          style={{ marginTop: 14 }}
        />
      </View>

      {/* Upfront Live UPI QR Verification Modal */}
      <CounterUpiModal
        visible={Boolean(upiPreviewData)}
        onClose={() => setUpiPreviewData(null)}
        amount={upiPreviewData?.amount || upiSplitAmount || effectivePaidNow}
        balanceDue={balanceDue}
        upiPreviewData={upiPreviewData}
        upiAccounts={upiAccounts}
        selectedUpiAccount={selectedUpiAccount}
        onSelectUpiAccount={(acc) => {
          setSelectedUpiAccount(acc);
          if (upiPreviewData?.amount) {
            setUpiPreviewData((current) =>
              current ? { ...current, qrDataUrl: '', vpa: acc.upiId } : current,
            );
            void fetchPreviewQr(upiPreviewData.amount, acc);
          }
        }}
        loadingQr={loadingQr}
        submitting={submitting}
        onConfirmUpi={() => handleCreateInvoice()}
        onPayCashInstead={() => {
          setUpiPreviewData(null);
          setPaymentSplits([{ mode: 'CASH', amount: grandTotal.toFixed(2) }]);
          handleCreateInvoice('CASH');
        }}
      />

      <CalendarModal
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        initialFrom={invoiceDate}
        mode="single"
        title="Select Invoice Date"
        onApply={(selected) => {
          if (selected) {
            setInvoiceDate(selected);
          }
          setCalendarOpen(false);
        }}
      />
    </BottomSheetModal>
  );
}

export function EditInvoiceModal(
  props: Omit<CreateInvoiceModalProps, 'invoiceToEdit'> & { invoice: Invoice | null },
) {
  return <CreateInvoiceModal {...props} invoiceToEdit={props.invoice} />;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    modalSectionTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
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
    summaryBox: {
      padding: 12,
      marginTop: 10,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 3,
    },
    summaryLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    summaryVal: {
      fontSize: 12,
      color: colors.text,
      fontWeight: '700',
    },
    grandTotalRow: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
      marginTop: 6,
      marginBottom: 4,
    },
    grandTotalLabel: {
      fontSize: 14,
      fontWeight: '900',
      color: colors.text,
    },
    grandTotalVal: {
      fontSize: 16,
      fontWeight: '900',
      color: '#10B981',
    },
    balanceDueRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
      marginTop: 4,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: 'rgba(251,191,36,0.2)',
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
    dateCard: {
      padding: 12,
      marginBottom: 10,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dateCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    dateCardLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: 0.5,
    },
    dateCardSubtitle: {
      fontSize: 10,
      color: colors.textSecondary,
    },
    dateActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    dateChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    dateChipActive: {
      borderColor: colors.primary,
      backgroundColor: 'rgba(59, 130, 246, 0.12)',
    },
    dateChipText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    dateChipTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    datePickerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.background,
    },
    datePickerBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
  });
