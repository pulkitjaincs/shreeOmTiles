import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import type { ThemeColors } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/lib/theme-context';
import { Ionicons } from '@expo/vector-icons';
import { mobileApiRequest, cachedMobileApiRequest } from '@/lib/api';
import { formatINR } from '@/lib/formatters';
import { Product, Warehouse } from '@/components/stock/types';
import { Party } from '@/components/parties/types';
import { MultiPaymentSplitSelector, PaymentSplitItem } from '@/components/ui/MultiPaymentSplitSelector';

export interface PurchaseModalItem {
  id: string;
  productId: string;
  warehouseId?: string;
  qty: string;
  unitPrice: string;
  batchNo: string;
  discount: string;
}

export interface CreatePurchaseModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  products?: Product[];
  warehouses?: Warehouse[];
  parties?: Party[];
}

const TAX_RATES = [0, 5, 12, 18, 28];

export function resolveProductCost(prod?: Product): number {
  if (!prod) return 0;
  const attrs = (prod.attributes as Record<string, any>) || {};
  if (attrs.cost !== undefined && attrs.cost !== null && attrs.cost !== '') {
    const val = Number(attrs.cost);
    if (!isNaN(val)) return val;
  }
  if (attrs.purchasePrice !== undefined && attrs.purchasePrice !== null && attrs.purchasePrice !== '') {
    const val = Number(attrs.purchasePrice);
    if (!isNaN(val)) return val;
  }
  if (attrs.price !== undefined && attrs.price !== null && attrs.price !== '') {
    const val = Number(attrs.price);
    if (!isNaN(val)) return val;
  }
  if (prod.price !== undefined && prod.price !== null) {
    const val = Number(prod.price);
    if (!isNaN(val)) return val;
  }
  return 0;
}

export function CreatePurchaseModal({
  visible,
  onClose,
  onSuccess,
  products: initialProducts,
  warehouses: initialWarehouses,
  parties: initialParties,
}: CreatePurchaseModalProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  // Dependencies state
  const [parties, setParties] = useState<Party[]>(initialParties || []);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses || []);
  const [products, setProducts] = useState<Product[]>(initialProducts || []);
  const [loadingPrereqs, setLoadingPrereqs] = useState(false);

  // Vendor selection state
  const [vendorMode, setVendorMode] = useState<'existing' | 'new'>('existing');
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyPhone, setNewPartyPhone] = useState('');
  const [newPartyAddress, setNewPartyAddress] = useState('');
  const [newPartyGstin, setNewPartyGstin] = useState('');

  // Purchase details state
  const [vendorBillNo, setVendorBillNo] = useState('');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
  const [taxRate, setTaxRate] = useState<number>(0);
  const [transportCost, setTransportCost] = useState('0');
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplitItem[]>([
    { mode: 'BANK_TRANSFER', amount: '0' },
  ]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Line items state
  const [items, setItems] = useState<PurchaseModalItem[]>([]);

  const defaultBatch = useMemo(() => {
    const now = new Date();
    const yr = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    return `LOT-${yr}-${mo}`;
  }, []);

  // Fetch missing dependencies when modal opens
  const loadPrerequisites = useCallback(async () => {
    setLoadingPrereqs(true);
    try {
      const [pData, wData, prData] = await Promise.all([
        initialParties && initialParties.length > 0
          ? Promise.resolve(initialParties)
          : cachedMobileApiRequest<Party[]>('/parties').catch(() => []),
        initialWarehouses && initialWarehouses.length > 0
          ? Promise.resolve(initialWarehouses)
          : cachedMobileApiRequest<Warehouse[]>('/warehouses').catch(() => []),
        initialProducts && initialProducts.length > 0
          ? Promise.resolve(initialProducts)
          : cachedMobileApiRequest<Product[]>('/products').catch(() => []),
      ]);

      const partiesList = Array.isArray(pData) ? pData : (pData as any)?.data || [];
      const whList = Array.isArray(wData) ? wData : (wData as any)?.data || [];
      const prodList = Array.isArray(prData) ? prData : (prData as any)?.data || [];

      setParties(partiesList);
      setWarehouses(whList);
      setProducts(prodList);

      if (whList.length > 0) {
        const firstWhId = whList[0].id;
        setDestinationWarehouseId((prev) => prev || firstWhId);
        setItems((prev) =>
          prev.map((it) => ({
            ...it,
            warehouseId: it.warehouseId || firstWhId,
          })),
        );
      }

    } catch (err: any) {
      console.warn('Failed to load purchase modal dependencies:', err.message);
    } finally {
      setLoadingPrereqs(false);
    }
  }, [initialParties, initialWarehouses, initialProducts]);

  const wasVisible = useRef(false);

  // Reset or initialize modal on visible
  useEffect(() => {
    if (!visible) {
      wasVisible.current = false;
      return;
    }
    if (wasVisible.current) return;
    wasVisible.current = true;

    loadPrerequisites();
    setVendorBillNo('');
    setNotes('');
    setPaymentSplits([{ mode: 'BANK_TRANSFER', amount: '0' }]);
    setTaxRate(0);
    setTransportCost('0');
    setNewPartyName('');
    setNewPartyPhone('');
    setNewPartyAddress('');
    setNewPartyGstin('');
    setVendorMode('existing');

    const initialWh = initialWarehouses?.[0]?.id || warehouses[0]?.id || destinationWarehouseId || '';
    setDestinationWarehouseId(initialWh);
    setSelectedPartyId('');

    setItems([
      {
        id: `item-${Date.now()}-1`,
        productId: '',
        warehouseId: initialWh,
        qty: '1',
        unitPrice: '0',
        batchNo: defaultBatch,
        discount: '0',
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Keep destination warehouse in sync when warehouses load
  useEffect(() => {
    if (warehouses.length > 0) {
      setDestinationWarehouseId((prev) => prev || warehouses[0].id);
      setItems((prev) =>
        prev.map((it) => ({
          ...it,
          warehouseId: it.warehouseId || warehouses[0].id,
        })),
      );
    }
  }, [warehouses]);



  // Destination Warehouse selection handler (propagates as default for line items)
  const handleDestinationWarehouseChange = (whId: string) => {
    setDestinationWarehouseId(whId);
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        warehouseId: whId,
      })),
    );
  };

  // Add line item
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length + 1}`,
        productId: '',
        warehouseId: destinationWarehouseId || warehouses[0]?.id || '',
        qty: '1',
        unitPrice: '0',
        batchNo: defaultBatch,
        discount: '0',
      },
    ]);
  };

  // Remove line item
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Update item field
  const handleItemFieldChange = (
    index: number,
    field: keyof PurchaseModalItem,
    value: string,
  ) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Product change handler for a line item
  const handleProductChange = (index: number, prodId: string) => {
    const prod = products.find((p) => p.id === prodId);
    const cost = resolveProductCost(prod);
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        productId: prodId,
        unitPrice: cost > 0 ? String(cost) : next[index].unitPrice,
      };
      return next;
    });
  };

  // Calculations
  const subtotal = useMemo(() => {
    return items.reduce((sum, it) => {
      const q = parseInt(it.qty, 10) || 0;
      const p = parseFloat(it.unitPrice) || 0;
      const d = parseFloat(it.discount) || 0;
      return sum + Math.max(0, q * p - d);
    }, 0);
  }, [items]);

  const taxAmount = useMemo(() => {
    return Math.round(((subtotal * taxRate) / 100) * 100) / 100;
  }, [subtotal, taxRate]);

  const transportCostNum = parseFloat(transportCost) || 0;
  const totalAmount = Math.round((subtotal + taxAmount + transportCostNum) * 100) / 100;

  const validSplits = useMemo(() => {
    return paymentSplits.filter(
      (s) => s.amount !== '' && !isNaN(parseFloat(s.amount)) && parseFloat(s.amount) > 0,
    );
  }, [paymentSplits]);

  const totalPaid = useMemo(() => {
    return validSplits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  }, [validSplits]);

  const balanceDue = Math.max(0, Math.round((totalAmount - totalPaid) * 100) / 100);

  // Submit Handler with validations
  const handleSubmit = async () => {
    // 1. Vendor validation
    if (vendorMode === 'existing') {
      if (!selectedPartyId) {
        Alert.alert('Vendor Required', 'Please choose an existing vendor party.');
        return;
      }
    } else {
      if (!newPartyName.trim()) {
        Alert.alert('Vendor Name Required', 'Please enter vendor/firm name.');
        return;
      }
      const cleanPhone = newPartyPhone.trim();
      if (!/^\d{10}$/.test(cleanPhone)) {
        Alert.alert(
          'Invalid Phone Number',
          'Vendor phone number must be strictly 10 digits (e.g. 9876543210).',
        );
        return;
      }
    }

    // 2. Line items validation
    if (items.length === 0) {
      Alert.alert('Items Required', 'Please add at least one line item.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.productId) {
        Alert.alert('Product Missing', `Please select a product for line item #${i + 1}.`);
        return;
      }
      const q = parseFloat(it.qty);
      if (isNaN(q) || q <= 0) {
        Alert.alert('Invalid Quantity', `Quantity for item #${i + 1} must be greater than 0.`);
        return;
      }
      const c = parseFloat(it.unitPrice);
      if (isNaN(c) || c < 0) {
        Alert.alert('Invalid Cost', `Unit cost for item #${i + 1} must be 0 or greater.`);
        return;
      }
    }

    // 3. Paid amount validation
    if (isNaN(totalPaid) || totalPaid < 0) {
      Alert.alert('Invalid Paid Amount', 'Upfront paid amount cannot be negative.');
      return;
    }
    if (totalPaid > totalAmount + 0.05) {
      Alert.alert(
        'Excessive Payment',
        `Upfront paid amount (${formatINR(totalPaid)}) cannot exceed total purchase amount (${formatINR(totalAmount)}).`,
      );
      return;
    }

    // 4. Submit to API
    setSubmitting(true);
    try {
      const resolvedMode =
        validSplits.length === 0
          ? 'CREDIT'
          : validSplits.length === 1
          ? validSplits[0].mode
          : 'SPLIT';

      const payload: any = {
        vendorBillNo: vendorBillNo.trim() || undefined,
        paymentMode: resolvedMode,
        amountPaidNow: totalPaid,
        payments: validSplits.map((s) => ({
          mode: s.mode,
          amount: parseFloat(s.amount) || 0,
          referenceNo: s.referenceNo?.trim() || undefined,
        })),
        taxRate,
        transportCost: transportCostNum,
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          productId: it.productId,
          warehouseId: it.warehouseId || undefined,
          batchNo: it.batchNo.trim() || undefined,
          qty: parseFloat(it.qty),
          unitPrice: parseFloat(it.unitPrice) || 0,
          discount: parseFloat(it.discount) || 0,
        })),
      };

      if (vendorMode === 'new') {
        payload.newParty = {
          name: newPartyName.trim(),
          phone: newPartyPhone.trim(),
          address: newPartyAddress.trim() || undefined,
          gstin: newPartyGstin.trim() || undefined,
          isSaved: true,
        };
      } else {
        payload.partyId = selectedPartyId;
      }

      const res = await mobileApiRequest<any>('/purchases', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      Alert.alert(
        'Purchase Recorded',
        `Purchase #${res?.purchaseNo || 'PO'} recorded successfully! Stock has been inwarded.`,
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Could Not Record Purchase', err.message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedVendor = parties.find((p) => p.id === selectedPartyId);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Record Inward Purchase"
      subtitle="Procure vendor stock, generate PO & credit payable"
      maxHeightPercent={0.92}
    >
      <View style={styles.formContent}>
        {loadingPrereqs && (
          <View style={styles.loadingBanner}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.loadingText}>Loading products & warehouses...</Text>
          </View>
        )}

        {/* ---------------------------------------------------- */}
        {/* SECTION 1: VENDOR / SUPPLIER                         */}
        {/* ---------------------------------------------------- */}
        <Text style={styles.sectionHeader}>1. Vendor / Supplier Details</Text>

        <View style={styles.tabToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, vendorMode === 'existing' && styles.toggleBtnActive]}
            onPress={() => setVendorMode('existing')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="people-outline"
              size={14}
              color={vendorMode === 'existing' ? colors.primaryForeground : colors.textSecondary}
            />
            <Text style={[styles.toggleText, vendorMode === 'existing' && styles.toggleTextActive]}>
              Select Existing Vendor
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, vendorMode === 'new' && styles.toggleBtnActive]}
            onPress={() => setVendorMode('new')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="person-add-outline"
              size={14}
              color={vendorMode === 'new' ? colors.primaryForeground : colors.textSecondary}
            />
            <Text style={[styles.toggleText, vendorMode === 'new' && styles.toggleTextActive]}>
              + Quick Add Vendor
            </Text>
          </TouchableOpacity>
        </View>

        {vendorMode === 'existing' ? (
          <View>
            <Select
              label="Select Vendor Party *"
              placeholder="Search or choose vendor party..."
              value={selectedPartyId}
              onChange={setSelectedPartyId}
              searchable
              searchPlaceholder="Search vendor by name or phone..."
              icon="business-outline"
              options={parties.map((p) => ({
                value: p.id,
                label: p.name,
                subLabel: `${p.phone}${p.address ? ' • ' + p.address : ''}${p.category ? ' • ' + p.category : ''}`,
                badge: p.category || (p.gstin ? 'GST' : undefined),
              }))}
            />
            {selectedVendor ? (
              <Card style={styles.vendorInfoCard}>
                <View style={styles.vendorInfoRow}>
                  <Text style={styles.vendorInfoName}>{selectedVendor.name}</Text>
                  {selectedVendor.category ? (
                    <Text style={styles.vendorInfoBadge}>{selectedVendor.category}</Text>
                  ) : null}
                </View>
                <Text style={styles.vendorInfoSub}>Phone: {selectedVendor.phone}</Text>
                {selectedVendor.gstin ? (
                  <Text style={styles.vendorInfoSub}>GSTIN: {selectedVendor.gstin}</Text>
                ) : null}
                {selectedVendor.address ? (
                  <Text style={styles.vendorInfoSub}>Address: {selectedVendor.address}</Text>
                ) : null}
              </Card>
            ) : null}
          </View>
        ) : (
          <View>
            <Input
              label="Vendor / Firm Name *"
              placeholder="e.g. Kajaria Ceramics Ltd"
              value={newPartyName}
              onChangeText={setNewPartyName}
              icon="business-outline"
            />
            <Input
              label="Contact Number (Strictly 10 digits) *"
              placeholder="e.g. 9876543210"
              value={newPartyPhone}
              onChangeText={(text) => {
                const digits = text.replace(/\D/g, '').slice(0, 10);
                setNewPartyPhone(digits);
              }}
              keyboardType="phone-pad"
              maxLength={10}
              icon="call-outline"
              error={
                newPartyPhone.length > 0 && newPartyPhone.length < 10
                  ? 'Phone number must be strictly 10 digits'
                  : undefined
              }
            />
            <Input
              label="GSTIN (Optional)"
              placeholder="e.g. 07AAAAA0000A1Z5"
              value={newPartyGstin}
              onChangeText={(text) => setNewPartyGstin(text.toUpperCase())}
              autoCapitalize="characters"
              maxLength={15}
              icon="document-text-outline"
            />
            <Input
              label="Supplier Factory / Billing Address (Optional)"
              placeholder="e.g. Plot 12, Industrial Area, Morbi"
              value={newPartyAddress}
              onChangeText={setNewPartyAddress}
              icon="location-outline"
            />
          </View>
        )}

        {/* ---------------------------------------------------- */}
        {/* SECTION 2: BILL NO & INVOICE DETAILS                 */}
        {/* ---------------------------------------------------- */}
        <Text style={styles.sectionHeader}>2. Purchase Invoice Details</Text>

        <Input
          label="Vendor Bill / Invoice No."
          placeholder="e.g. INV-9042"
          value={vendorBillNo}
          onChangeText={setVendorBillNo}
          icon="receipt-outline"
        />

        <Select
          label="Receiving Warehouse *"
          placeholder="Select receiving warehouse"
          value={destinationWarehouseId}
          onChange={handleDestinationWarehouseChange}
          searchPlaceholder="Search warehouse..."
          icon="business-outline"
          options={warehouses.map((w) => ({
            value: w.id,
            label: w.name,
            subLabel: w.type ? `${w.type} Warehouse` : undefined,
          }))}
        />

        {/* ---------------------------------------------------- */}
        {/* SECTION 3: LINE ITEMS                                */}
        {/* ---------------------------------------------------- */}
        <View style={styles.lineItemsHeaderRow}>
          <Text style={styles.sectionHeader}>3. Line Items ({items.length})</Text>
          <TouchableOpacity
            style={styles.addItemBtn}
            onPress={handleAddItem}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.addItemBtnText}>Add Item</Text>
          </TouchableOpacity>
        </View>

        {items.map((item, index) => {
          const selectedProd = products.find((p) => p.id === item.productId);
          const itemQty = parseInt(item.qty, 10) || 0;
          const itemCost = parseFloat(item.unitPrice) || 0;
          const itemDisc = parseFloat(item.discount) || 0;
          const lineTotal = Math.max(0, itemQty * itemCost - itemDisc);

          return (
            <Card key={item.id} style={styles.itemCard}>
              <View style={styles.itemCardHeader}>
                <View style={styles.itemNumberTag}>
                  <Text style={styles.itemNumberText}>Item #{index + 1}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={styles.itemTotalTag}>{formatINR(lineTotal)}</Text>
                  {items.length > 1 ? (
                    <TouchableOpacity
                      onPress={() => handleRemoveItem(index)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.deleteItemBtn}
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              {/* Product Selector */}
              <Select
                label="Product / Item *"
                placeholder="Select product..."
                value={item.productId}
                onChange={(pId) => handleProductChange(index, pId)}
                searchable
                searchPlaceholder="Search product by name or category..."
                icon="cube-outline"
                options={products.map((p) => {
                  const cost = resolveProductCost(p);
                  return {
                    value: p.id,
                    label: p.name,
                    subLabel: `${p.category || 'General'} • Unit: ${p.unit}${cost > 0 ? ` • Cost: ₹${cost}` : ''}`,
                  };
                })}
              />

              {/* Qty & Unit Cost in 2 columns */}
              <View style={styles.rowTwoCols}>
                <View style={{ flex: 1 }}>
                  <Input
                    label={`Quantity (${selectedProd?.unit || 'units'}) *`}
                    placeholder="e.g. 1"
                    value={item.qty}
                    onChangeText={(t) => handleItemFieldChange(index, 'qty', t.replace(/\D/g, ''))}
                    keyboardType="numeric"
                    icon="layers-outline"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Unit Cost (₹) *"
                    placeholder="e.g. 450"
                    value={item.unitPrice}
                    onChangeText={(t) =>
                      handleItemFieldChange(index, 'unitPrice', t.replace(/[^0-9.]/g, ''))
                    }
                    keyboardType="decimal-pad"
                    icon="pricetag-outline"
                  />
                </View>
              </View>

              {/* Batch No & Line Discount */}
              <View style={styles.rowTwoCols}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Batch / Lot No."
                    placeholder="e.g. LOT-2026-10"
                    value={item.batchNo}
                    onChangeText={(t) => handleItemFieldChange(index, 'batchNo', t)}
                    icon="barcode-outline"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Discount (₹)"
                    placeholder="0"
                    value={item.discount}
                    onChangeText={(t) =>
                      handleItemFieldChange(index, 'discount', t.replace(/[^0-9.]/g, ''))
                    }
                    keyboardType="decimal-pad"
                    icon="gift-outline"
                  />
                </View>
              </View>
            </Card>
          );
        })}

        {/* ---------------------------------------------------- */}
        {/* SECTION 4: TAX & TRANSPORTATION                      */}
        {/* ---------------------------------------------------- */}
        <Text style={styles.sectionHeader}>4. Tax & Transportation</Text>

        <Text style={styles.fieldLabel}>GST Rate (%):</Text>
        <View style={styles.taxPillRow}>
          {TAX_RATES.map((rate) => (
            <TouchableOpacity
              key={rate}
              style={[styles.taxPill, taxRate === rate && styles.taxPillActive]}
              onPress={() => setTaxRate(rate)}
              activeOpacity={0.7}
            >
              <Text style={[styles.taxPillText, taxRate === rate && styles.taxPillTextActive]}>
                {rate}%
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Input
          label="Freight / Transport Cost (₹)"
          placeholder="0"
          value={transportCost}
          onChangeText={(t) => setTransportCost(t.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
          icon="car-outline"
        />

        {/* ---------------------------------------------------- */}
        {/* SECTION 5: PAYMENT MODE & UPFRONT PAID AMOUNT        */}
        {/* ---------------------------------------------------- */}
        <Text style={styles.sectionHeader}>5. Payment & Settlement</Text>

        <MultiPaymentSplitSelector
          totalAmount={totalAmount}
          splits={paymentSplits}
          onChange={setPaymentSplits}
          balanceLabel="Credit Payable"
          allowZero={true}
        />

        {/* Notes */}
        <Input
          label="Purchase Notes / Remarks (Optional)"
          placeholder="e.g. Transporter LR #9822, 10 days payment term"
          value={notes}
          onChangeText={setNotes}
          icon="chatbox-outline"
        />

        {/* ---------------------------------------------------- */}
        {/* SUMMARY CARD                                         */}
        {/* ---------------------------------------------------- */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal ({items.length} items):</Text>
            <Text style={styles.summaryValue}>{formatINR(subtotal)}</Text>
          </View>
          {taxRate > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>GST ({taxRate}%):</Text>
              <Text style={styles.summaryValue}>+{formatINR(taxAmount)}</Text>
            </View>
          ) : null}
          {transportCostNum > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Transport / Freight:</Text>
              <Text style={styles.summaryValue}>+{formatINR(transportCostNum)}</Text>
            </View>
          ) : null}
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryGrandTotalLabel}>Total Purchase Value:</Text>
            <Text style={styles.summaryGrandTotalValue}>{formatINR(totalAmount)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Paid Upfront Now:</Text>
            <Text style={[styles.summaryValue, { color: '#10B981' }]}>
              {formatINR(totalPaid)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Payable Balance (Vendor Due):</Text>
            <Text
              style={[
                styles.summaryValue,
                { color: balanceDue > 0 ? '#EF4444' : '#10B981', fontWeight: '800' },
              ]}
            >
              {formatINR(balanceDue)}
            </Text>
          </View>
        </Card>

        {/* ---------------------------------------------------- */}
        {/* SUBMIT BUTTON                                        */}
        {/* ---------------------------------------------------- */}
        <View style={styles.actionRow}>
          <Button
            title="Record Purchase"
            icon="checkmark-circle-outline"
            variant="primary"
            size="lg"
            loading={submitting}
            disabled={submitting}
            onPress={handleSubmit}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </BottomSheetModal>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    formContent: {
      paddingBottom: 24,
    },
    loadingBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.cardElevated,
      padding: 10,
      borderRadius: 8,
      marginBottom: 12,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    sectionHeader: {
      fontSize: 13.5,
      fontWeight: '800',
      color: colors.text,
      marginTop: 14,
      marginBottom: 10,
      letterSpacing: 0.2,
    },
    tabToggle: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 3,
      marginBottom: 10,
    },
    toggleBtn: {
      flex: 1,
      flexDirection: 'row',
      gap: 6,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
    },
    toggleBtnActive: {
      backgroundColor: isDark ? '#FFFFFF' : '#09090B',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    toggleText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    toggleTextActive: {
      color: isDark ? '#09090B' : '#FFFFFF',
      fontWeight: '800',
    },
    vendorInfoCard: {
      padding: 10,
      marginTop: -4,
      marginBottom: 12,
      backgroundColor: colors.cardElevated,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    vendorInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    vendorInfoName: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.text,
    },
    vendorInfoBadge: {
      fontSize: 10,
      fontWeight: '700',
      color: '#10B981',
      backgroundColor: 'rgba(16, 185, 129, 0.12)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    vendorInfoSub: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    rowTwoCols: {
      flexDirection: 'row',
      gap: 10,
    },
    lineItemsHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10,
      marginBottom: 6,
    },
    addItemBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.cardElevated,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addItemBtnText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '700',
    },
    itemCard: {
      padding: 12,
      marginBottom: 10,
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    itemCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    itemNumberTag: {
      backgroundColor: colors.cardElevated,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    itemNumberText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#F59E0B',
    },
    itemTotalTag: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.text,
      fontFamily: 'monospace',
    },
    deleteItemBtn: {
      padding: 4,
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderRadius: 6,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      marginBottom: 6,
    },
    taxPillRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    taxPill: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    taxPillActive: {
      backgroundColor: colors.text,
      borderColor: colors.text,
    },
    taxPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    taxPillTextActive: {
      color: colors.background,
      fontWeight: '800',
    },
    paymentModeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    paymentModeCard: {
      flex: 1,
      minWidth: '47%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    paymentModeCardActive: {
      backgroundColor: colors.text,
      borderColor: colors.text,
    },
    paymentModeText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    paymentModeTextActive: {
      color: colors.background,
      fontWeight: '800',
    },
    quickChipsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: -6,
      marginBottom: 14,
    },
    chipBtn: {
      backgroundColor: colors.cardElevated,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipBtnText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text,
    },
    summaryCard: {
      padding: 14,
      backgroundColor: colors.cardElevated,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      marginVertical: 12,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginVertical: 3,
    },
    summaryLabel: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    summaryValue: {
      fontSize: 12.5,
      fontWeight: '700',
      color: colors.text,
      fontFamily: 'monospace',
    },
    summaryDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 8,
    },
    summaryGrandTotalLabel: {
      fontSize: 13.5,
      fontWeight: '800',
      color: colors.text,
    },
    summaryGrandTotalValue: {
      fontSize: 15,
      fontWeight: '900',
      color: '#F59E0B',
      fontFamily: 'monospace',
    },
    actionRow: {
      marginTop: 8,
      marginBottom: 20,
    },
  });
