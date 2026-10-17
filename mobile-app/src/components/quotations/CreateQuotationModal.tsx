import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { Select } from '@/components/ui/Select';
import { Colors } from '@/constants/theme';
import { formatINR } from '@/lib/formatters';
import { mobileApiRequest, cachedMobileApiRequest } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import { Party, Product } from '@/components/invoices/types';

export interface CreateQuotationModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (newQuotation?: any) => void;
  initialParties?: Party[];
  initialProducts?: Product[];
}

interface QuotationLineItem {
  productId: string;
  qty: string;
  unitPrice: string;
  discount: string;
}

const GST_PRESETS = [0, 5, 12, 18, 28];

export function CreateQuotationModal({
  visible,
  onClose,
  onSuccess,
  initialParties,
  initialProducts,
}: CreateQuotationModalProps) {
  // Parties & Products state
  const [parties, setParties] = useState<Party[]>(initialParties || []);
  const [products, setProducts] = useState<Product[]>(initialProducts || []);
  const [loadingInitialData, setLoadingInitialData] = useState(false);

  // Customer mode state: saved party vs walk-in
  const [customerMode, setCustomerMode] = useState<'saved' | 'walkin'>('saved');
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');

  // Walk-in customer fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  // Line items state
  const [items, setItems] = useState<QuotationLineItem[]>([
    { productId: '', qty: '1', unitPrice: '', discount: '0' },
  ]);

  // Tax and Transport state
  const [taxRate, setTaxRate] = useState<string>('18');
  const [transportCost, setTransportCost] = useState<string>('0');
  const [transportGstRate, setTransportGstRate] = useState<string>('0');
  const [notes, setNotes] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);

  const wasVisible = useRef(false);

  // Reset or initialize modal on visible
  useEffect(() => {
    if (!visible) {
      wasVisible.current = false;
      return;
    }
    if (wasVisible.current) return;
    wasVisible.current = true;

    // Fresh reset on modal open
    setCustomerMode('saved');
    setSelectedPartyId('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setItems([{ productId: '', qty: '1', unitPrice: '', discount: '0' }]);
    setTaxRate('18');
    setTransportCost('0');
    setTransportGstRate('0');
    setNotes('');

    let isMounted = true;
    const shouldFetchParties = !initialParties || initialParties.length === 0;
    const shouldFetchProducts = !initialProducts || initialProducts.length === 0;

    if (shouldFetchParties || shouldFetchProducts) {
      setLoadingInitialData(true);
      Promise.all([
        shouldFetchParties
          ? cachedMobileApiRequest<Party[]>('/parties').catch(() => [])
          : Promise.resolve(initialParties || []),
        shouldFetchProducts
          ? cachedMobileApiRequest<Product[]>('/products').catch(() => [])
          : Promise.resolve(initialProducts || []),
      ])
        .then(([pList, prList]) => {
          if (isMounted) {
            if (shouldFetchParties) setParties(pList || []);
            if (shouldFetchProducts) setProducts(prList || []);
          }
        })
        .finally(() => {
          if (isMounted) setLoadingInitialData(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [visible, initialParties, initialProducts]);

  // Price resolution helper (wholesale vs standard)
  const resolveProductPrice = useCallback(
    (prod: Product | undefined, partyId?: string, mode?: 'saved' | 'walkin') => {
      if (!prod?.attributes || typeof prod.attributes !== 'object') return 0;
      const attrs = prod.attributes as Record<string, any>;
      const currentMode = mode !== undefined ? mode : customerMode;

      // Walk-in customers are retail by definition; do not apply wholesale tier
      if (currentMode === 'walkin') {
        return attrs.price !== undefined ? Number(attrs.price) : 0;
      }

      const targetPartyId = partyId !== undefined ? partyId : selectedPartyId;
      const targetParty = parties.find((p) => p.id === targetPartyId);
      const isWholesale =
        targetParty?.category === 'WHOLESALER' || targetParty?.category === 'CONTRACTOR';
      if (isWholesale && attrs.wholesalePrice !== undefined && Number(attrs.wholesalePrice) > 0) {
        return Number(attrs.wholesalePrice);
      }
      return attrs.price !== undefined ? Number(attrs.price) : 0;
    },
    [parties, selectedPartyId, customerMode],
  );

  // Update product prices if selected party changes
  const handlePartyChange = (newPartyId: string) => {
    setSelectedPartyId(newPartyId);
    setItems((currItems) =>
      currItems.map((item) => {
        if (!item.productId) return item;
        const prod = products.find((p) => p.id === item.productId);
        const resolved = resolveProductPrice(prod, newPartyId, 'saved');
        return resolved > 0 ? { ...item, unitPrice: String(resolved) } : item;
      }),
    );
  };

  // Switch customer mode and update pricing accordingly
  const handleCustomerModeChange = (newMode: 'saved' | 'walkin') => {
    setCustomerMode(newMode);
    setItems((currItems) =>
      currItems.map((item) => {
        if (!item.productId) return item;
        const prod = products.find((p) => p.id === item.productId);
        const resolved = resolveProductPrice(prod, selectedPartyId, newMode);
        return resolved > 0 ? { ...item, unitPrice: String(resolved) } : item;
      }),
    );
  };

  // Product line item handlers
  const handleProductChange = (index: number, newProductId: string) => {
    if (!newProductId) {
      setItems((prev) =>
        prev.map((item, i) =>
          i === index
            ? { productId: '', qty: '1', unitPrice: '', discount: '0' }
            : item,
        ),
      );
      return;
    }

    if (items.some((item, i) => i !== index && item.productId === newProductId)) {
      Alert.alert('Duplicate Product', 'This product is already added in the quotation.');
      return;
    }

    const prod = products.find((p) => p.id === newProductId);
    const resolvedPrice = resolveProductPrice(prod, selectedPartyId, customerMode);

    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              productId: newProductId,
              unitPrice: resolvedPrice > 0 ? String(resolvedPrice) : '',
              qty: item.qty && Number(item.qty) > 0 ? item.qty : '1',
            }
          : item,
      ),
    );
  };

  const handleAddItem = () => {
    const hasEmptyItem = items.some((item) => !item.productId);
    if (hasEmptyItem) {
      Alert.alert('Select Product', 'Please select a product for the empty row before adding another.');
      return;
    }
    setItems((prev) => [
      ...prev,
      { productId: '', qty: '1', unitPrice: '', discount: '0' },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemFieldChange = (
    index: number,
    field: 'qty' | 'unitPrice' | 'discount',
    value: string,
  ) => {
    let sanitized = value;
    if (field === 'qty') {
      sanitized = value.replace(/\D/g, '');
    } else {
      const clean = value.replace(/[^0-9.]/g, '');
      const parts = clean.split('.');
      sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : clean;
    }
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: sanitized } : item)),
    );
  };

  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) {
      setCustomerPhone(digits.slice(2));
    } else if (digits.startsWith('0') && digits.length === 11) {
      setCustomerPhone(digits.slice(1));
    } else if (digits.length > 10) {
      setCustomerPhone(digits.slice(-10));
    } else {
      setCustomerPhone(digits);
    }
  };

  const handleTaxRateChange = (val: string) => {
    const clean = val.replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    const formatted = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : clean;
    if (formatted === '' || formatted === '.' || Number(formatted) <= 100) {
      setTaxRate(formatted);
    }
  };

  const handleTransportCostChange = (val: string) => {
    const clean = val.replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    const formatted = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : clean;
    setTransportCost(formatted);
  };

  const handleTransportGstRateChange = (val: string) => {
    const clean = val.replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    const formatted = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : clean;
    if (formatted === '' || formatted === '.' || Number(formatted) <= 100) {
      setTransportGstRate(formatted);
    }
  };

  // Tax calculations
  const parsedTaxRate = Math.min(100, Math.max(0, Number(taxRate) || 0));
  const parsedTransportCost = Math.max(0, Number(transportCost) || 0);
  const parsedTransportGstRate = Math.min(100, Math.max(0, Number(transportGstRate) || 0));

  const { subtotal, itemsTax, transportTax, totalTax, grandTotal } = useMemo(() => {
    const rawSub = items.reduce((acc, it) => {
      const q = Math.max(0, Number(it.qty) || 0);
      const p = Math.max(0, Number(it.unitPrice) || 0);
      const d = Math.max(0, Number(it.discount) || 0);
      return acc + Math.max(0, q * p - d);
    }, 0);

    const iTax = Math.round(((rawSub * parsedTaxRate) / 100) * 100) / 100;
    const tTax = Math.round(((parsedTransportCost * parsedTransportGstRate) / 100) * 100) / 100;
    const taxSum = Math.round((iTax + tTax) * 100) / 100;
    const total = Math.round((rawSub + taxSum + parsedTransportCost) * 100) / 100;

    return {
      subtotal: rawSub,
      itemsTax: iTax,
      transportTax: tTax,
      totalTax: taxSum,
      grandTotal: total,
    };
  }, [items, parsedTaxRate, parsedTransportCost, parsedTransportGstRate]);

  // Form reset
  const resetForm = () => {
    setCustomerMode('saved');
    setSelectedPartyId('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setItems([{ productId: '', qty: '1', unitPrice: '', discount: '0' }]);
    setTaxRate('18');
    setTransportCost('0');
    setTransportGstRate('0');
    setNotes('');
  };

  // Submit Handler
  const handleSubmit = async () => {
    // 1. Customer validation
    const cleanPhone = customerPhone.replace(/\D/g, '').slice(-10);
    if (customerMode === 'saved') {
      if (!selectedPartyId) {
        Alert.alert('Validation Error', 'Please select a saved customer.');
        return;
      }
    } else {
      if (!customerName.trim()) {
        Alert.alert('Validation Error', 'Customer Name is required for walk-in customer.');
        return;
      }
      if (cleanPhone.length !== 10) {
        Alert.alert(
          'Invalid Phone Number',
          'Walk-in customer mobile number must be exactly 10 digits.',
        );
        return;
      }
    }

    // 2. Line items validation
    if (items.length === 0) {
      Alert.alert('Validation Error', 'Please add at least one line item.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.productId) {
        Alert.alert('Validation Error', `Please select a product for Item #${i + 1}.`);
        return;
      }

      const q = Number(it.qty);
      if (!q || q < 1 || !Number.isInteger(q)) {
        Alert.alert(
          'Validation Error',
          `Quantity for Item #${i + 1} must be a whole number of at least 1.`,
        );
        return;
      }

      const price = Number(it.unitPrice);
      if (isNaN(price) || price < 0) {
        Alert.alert(
          'Validation Error',
          `Rate / Unit Price for Item #${i + 1} must be zero or positive.`,
        );
        return;
      }

      const disc = Number(it.discount || 0);
      if (isNaN(disc) || disc < 0) {
        Alert.alert('Validation Error', `Discount for Item #${i + 1} cannot be negative.`);
        return;
      }

      if (disc > q * price) {
        Alert.alert(
          'Validation Error',
          `Discount for Item #${i + 1} (₹${disc}) cannot exceed line total (₹${q * price}).`,
        );
        return;
      }
    }

    // 3. GST Rate validations
    if (parsedTaxRate < 0 || parsedTaxRate > 100) {
      Alert.alert('Validation Error', 'Product GST rate must be between 0% and 100%.');
      return;
    }
    if (parsedTransportGstRate < 0 || parsedTransportGstRate > 100) {
      Alert.alert('Validation Error', 'Transport GST rate must be between 0% and 100%.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        partyId: customerMode === 'saved' ? selectedPartyId : undefined,
        customerName: customerMode === 'walkin' ? customerName.trim() : undefined,
        customerPhone: customerMode === 'walkin' ? cleanPhone : undefined,
        customerAddress:
          customerMode === 'walkin' && customerAddress.trim()
            ? customerAddress.trim()
            : undefined,
        taxRate: parsedTaxRate,
        transportCost: parsedTransportCost,
        transportGstRate: parsedTransportGstRate,
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          productId: it.productId,
          qty: Math.floor(Number(it.qty)),
          unitPrice: Number(Number(it.unitPrice).toFixed(2)),
          discount: Number(Number(it.discount || 0).toFixed(2)),
        })),
      };

      const res = await mobileApiRequest<any>('/quotations', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      Alert.alert(
        'Price Estimate Created',
        `Estimate #${res.quotationNo || res.estimateNo} has been generated successfully!`,
      );

      resetForm();
      onSuccess(res);
      onClose();
    } catch (err: any) {
      Alert.alert('Failed to Create Estimate', err.message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const isPhoneInvalid =
    customerMode === 'walkin' &&
    customerPhone.length > 0 &&
    customerPhone.replace(/\D/g, '').slice(-10).length !== 10;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="New Price Estimate"
      subtitle="Create quotation & share official PDF"
      maxHeightPercent={0.93}
    >
      {loadingInitialData && parties.length === 0 && products.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading catalogue & customer accounts...</Text>
        </View>
      ) : null}

      {/* 1. Customer Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Customer Details</Text>

        {/* Tab Toggle */}
        <View style={styles.tabToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, customerMode === 'saved' && styles.toggleBtnActive]}
            onPress={() => handleCustomerModeChange('saved')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="people-outline"
              size={14}
              color={customerMode === 'saved' ? '#09090B' : Colors.dark.textSecondary}
            />
            <Text
              style={[styles.toggleText, customerMode === 'saved' && styles.toggleTextActive]}
            >
              Saved Party
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleBtn, customerMode === 'walkin' && styles.toggleBtnActive]}
            onPress={() => handleCustomerModeChange('walkin')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="person-add-outline"
              size={14}
              color={customerMode === 'walkin' ? '#09090B' : Colors.dark.textSecondary}
            />
            <Text
              style={[styles.toggleText, customerMode === 'walkin' && styles.toggleTextActive]}
            >
              Walk-in Customer
            </Text>
          </TouchableOpacity>
        </View>

        {customerMode === 'saved' ? (
          <Select
            label="Select Customer / Party *"
            placeholder="Choose saved customer..."
            value={selectedPartyId}
            onChange={handlePartyChange}
            searchable
            searchPlaceholder="Search customer name or phone..."
            icon="person-outline"
            options={parties.map((p) => ({
              value: p.id,
              label: p.name,
              subLabel: `${p.phone}${p.address ? ' • ' + p.address : ''}`,
              badge: p.category || (p.gstin ? 'GST' : undefined),
            }))}
          />
        ) : (
          <View>
            <Input
              label="Customer / Firm Name *"
              placeholder="e.g. Rahul Sharma or Ramesh Tiles"
              value={customerName}
              onChangeText={setCustomerName}
              icon="person-outline"
            />
            <Input
              label="Mobile Number (10 digits) *"
              placeholder="e.g. 9876543210"
              value={customerPhone}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
              maxLength={15}
              icon="call-outline"
              error={
                isPhoneInvalid
                  ? `Must be exactly 10 digits (${customerPhone.length}/10)`
                  : undefined
              }
            />
            <Input
              label="Delivery / Site Address (Optional)"
              placeholder="e.g. Shop 4, Civil Lines, Kota"
              value={customerAddress}
              onChangeText={setCustomerAddress}
              icon="location-outline"
            />
          </View>
        )}
      </View>

      {/* 2. Line Items Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>2. Quotation Line Items ({items.length})</Text>
          <TouchableOpacity onPress={handleAddItem} style={styles.addItemHeaderBtn}>
            <Ionicons name="add-circle" size={16} color="#38BDF8" />
            <Text style={styles.addItemHeaderText}>Add Item</Text>
          </TouchableOpacity>
        </View>

        {items.map((item, index) => {
          const selectedProd = products.find((p) => p.id === item.productId);
          const q = Number(item.qty) || 0;
          const p = Number(item.unitPrice) || 0;
          const d = Number(item.discount) || 0;
          const lineTotal = Math.max(0, q * p - d);

          return (
            <Card key={`item-${index}`} style={styles.itemCard}>
              <View style={styles.itemCardHeader}>
                <Text style={styles.itemIndexTitle}>Item #{index + 1}</Text>
                {items.length > 1 ? (
                  <TouchableOpacity
                    onPress={() => handleRemoveItem(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Product Select */}
              <Select
                label="Product *"
                placeholder="Choose product / tile..."
                value={item.productId}
                onChange={(prodId) => handleProductChange(index, prodId)}
                searchable
                searchPlaceholder="Search product by name or category..."
                icon="cube-outline"
                options={products.map((pr) => ({
                  value: pr.id,
                  label: pr.name,
                  subLabel: `${pr.category || 'Standard'} • Unit: ${pr.unit}`,
                }))}
              />

              {/* Quantity, Rate & Discount Row */}
              <View style={styles.itemRowInputs}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Qty *"
                    placeholder="1"
                    value={item.qty}
                    onChangeText={(val) =>
                      handleItemFieldChange(index, 'qty', val.replace(/\D/g, ''))
                    }
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 1.2 }}>
                  <Input
                    label="Rate (₹) *"
                    placeholder="0"
                    value={item.unitPrice}
                    onChangeText={(val) =>
                      handleItemFieldChange(index, 'unitPrice', val.replace(/[^0-9.]/g, ''))
                    }
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Discount (₹)"
                    placeholder="0"
                    value={item.discount}
                    onChangeText={(val) =>
                      handleItemFieldChange(index, 'discount', val.replace(/[^0-9.]/g, ''))
                    }
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {/* Line Total Footer */}
              <View style={styles.lineTotalRow}>
                <Text style={styles.lineTotalLabel}>
                  {selectedProd ? `${selectedProd.name} (${selectedProd.unit})` : 'Line Total'}
                </Text>
                <Text style={styles.lineTotalValue}>{formatINR(lineTotal)}</Text>
              </View>
            </Card>
          );
        })}

        <Button
          title="+ Add Another Product"
          icon="add-outline"
          variant="outline"
          size="sm"
          onPress={handleAddItem}
          style={{ marginTop: 4 }}
        />
      </View>

      {/* 3. GST Rate & Transport Charges Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Taxes & Freight</Text>

        {/* Product GST Rate (0-100%) */}
        <Text style={styles.subFieldLabel}>Product GST Rate (%)</Text>
        <View style={styles.chipRow}>
          {GST_PRESETS.map((rate) => {
            const isSelected = parsedTaxRate === rate && taxRate === String(rate);
            return (
              <TouchableOpacity
                key={`tax-${rate}`}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => setTaxRate(String(rate))}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {rate}%
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Input
          placeholder="Custom GST rate (0 - 100%)"
          value={taxRate}
          onChangeText={handleTaxRateChange}
          keyboardType="decimal-pad"
          maxLength={6}
          containerStyle={{ marginTop: 4, marginBottom: 12 }}
        />

        {/* Transport Charges */}
        <Input
          label="Transport / Freight Charges (₹)"
          placeholder="0"
          value={transportCost}
          onChangeText={handleTransportCostChange}
          keyboardType="decimal-pad"
          icon="car-outline"
        />

        {/* GST on Transport (0-100%) */}
        <Text style={styles.subFieldLabel}>GST on Transport (%)</Text>
        <View style={styles.chipRow}>
          {GST_PRESETS.map((rate) => {
            const isSelected =
              parsedTransportGstRate === rate && transportGstRate === String(rate);
            return (
              <TouchableOpacity
                key={`trans-tax-${rate}`}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => setTransportGstRate(String(rate))}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {rate}%
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Input
          placeholder="Custom Transport GST (0 - 100%)"
          value={transportGstRate}
          onChangeText={handleTransportGstRateChange}
          keyboardType="decimal-pad"
          maxLength={6}
          containerStyle={{ marginTop: 4, marginBottom: 8 }}
        />
      </View>

      {/* 4. Notes Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Notes & Terms</Text>
        <Input
          label="Quotation Terms / Remarks (Optional)"
          placeholder="e.g. Validity 15 days. Loading included, unloading extra."
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          icon="document-text-outline"
          containerStyle={{ marginBottom: 4 }}
        />
      </View>

      {/* 5. Financial Summary Card */}
      <Card elevated style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Estimate Summary</Text>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Items Subtotal</Text>
          <Text style={styles.summaryValue}>{formatINR(subtotal)}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Product GST ({parsedTaxRate}%)</Text>
          <Text style={styles.summaryValue}>{formatINR(itemsTax)}</Text>
        </View>

        {parsedTransportCost > 0 ? (
          <>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Transport Charges</Text>
              <Text style={styles.summaryValue}>{formatINR(parsedTransportCost)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Transport GST ({parsedTransportGstRate}%)
              </Text>
              <Text style={styles.summaryValue}>{formatINR(transportTax)}</Text>
            </View>
          </>
        ) : null}

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total GST</Text>
          <Text style={styles.summaryValue}>{formatINR(totalTax)}</Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryGrandRow}>
          <View>
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
            <Text style={styles.grandTotalSub}>Inclusive of taxes & freight</Text>
          </View>
          <Text style={styles.grandTotalValue}>{formatINR(grandTotal)}</Text>
        </View>
      </Card>

      {/* Action Buttons */}
      <View style={styles.actionButtonsRow}>
        <Button
          title="Cancel"
          variant="outline"
          size="md"
          onPress={onClose}
          style={{ flex: 1 }}
          disabled={submitting}
        />
        <Button
          title="Generate Estimate"
          icon="document-text-outline"
          variant="primary"
          size="md"
          onPress={handleSubmit}
          loading={submitting}
          style={{ flex: 1.5 }}
        />
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  loadingText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addItemHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addItemHeaderText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.card,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 3,
    marginBottom: 10,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  toggleTextActive: {
    color: '#09090B',
    fontWeight: '800',
  },
  itemCard: {
    padding: 12,
    marginBottom: 10,
    backgroundColor: Colors.dark.card,
    borderColor: Colors.dark.border,
  },
  itemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemIndexTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#38BDF8',
    textTransform: 'uppercase',
  },
  itemRowInputs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  lineTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  lineTotalLabel: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
  },
  lineTotalValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  subFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  chipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  chipTextActive: {
    color: '#09090B',
    fontWeight: '800',
  },
  summaryCard: {
    padding: 14,
    backgroundColor: Colors.dark.cardElevated,
    borderColor: Colors.dark.borderMedium,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  summaryValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.dark.borderMedium,
    marginVertical: 10,
  },
  summaryGrandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  grandTotalSub: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#10B981',
    fontFamily: 'monospace',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 16,
  },
});
