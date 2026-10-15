import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/theme';
import { formatINR } from '@/lib/formatters';
import { mobileApiRequest } from '@/lib/api';
import { Product, Warehouse, Party, StockLedger, InvoiceLineItem } from './types';

interface CreateInvoiceModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (newInvoice?: any) => void;
  products: Product[];
  warehouses: Warehouse[];
  parties: Party[];
  stockList: StockLedger[];
  isSalesman?: boolean;
}

export function CreateInvoiceModal({
  visible,
  onClose,
  onSuccess,
  products,
  warehouses,
  parties,
  stockList,
  isSalesman,
}: CreateInvoiceModalProps) {
  const [partyType, setPartyType] = useState<'existing' | 'new'>('existing');
  const [selectedPartyId, setSelectedPartyId] = useState(parties[0]?.id || '');
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyPhone, setNewPartyPhone] = useState('');
  const [newPartyAddress, setNewPartyAddress] = useState('');

  const [items, setItems] = useState<InvoiceLineItem[]>([
    {
      productId: products[0]?.id || '',
      warehouseId: warehouses[0]?.id || '',
      qty: 1,
      unitPrice: 0,
      discount: 0,
    },
  ]);

  const [taxRate, setTaxRate] = useState<number>(18);
  const [paymentMode, setPaymentMode] = useState<'UPI' | 'CASH' | 'CREDIT'>('UPI');
  const [amountPaidNow, setAmountPaidNow] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [upiPreviewData, setUpiPreviewData] = useState<{
    qrDataUrl: string;
    vpa: string;
    amount: number;
  } | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);

  const getLiveStock = (productId: string, warehouseId: string) => {
    return stockList
      .filter((s) => s.productId === productId && (!warehouseId || s.warehouseId === warehouseId))
      .reduce((sum, s) => sum + Number(s.quantity || 0), 0);
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        productId: products[0]?.id || '',
        warehouseId: warehouses[0]?.id || '',
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

  const handleUpdateItem = (index: number, field: keyof InvoiceLineItem, value: any) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const { subtotal, taxAmount, grandTotal } = useMemo(() => {
    const rawSub = items.reduce((acc, it) => {
      const lineTotal = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0) - (Number(it.discount) || 0);
      return acc + Math.max(0, lineTotal);
    }, 0);
    const tax = Math.round((rawSub * (taxRate / 100)) * 100) / 100;
    return {
      subtotal: rawSub,
      taxAmount: tax,
      grandTotal: rawSub + tax,
    };
  }, [items, taxRate]);

  const resetForm = () => {
    setPartyType('existing');
    setSelectedPartyId(parties[0]?.id || '');
    setNewPartyName('');
    setNewPartyPhone('');
    setNewPartyAddress('');
    setItems([
      {
        productId: products[0]?.id || '',
        warehouseId: warehouses[0]?.id || '',
        qty: 1,
        unitPrice: 0,
        discount: 0,
      },
    ]);
    setTaxRate(18);
    setPaymentMode('UPI');
    setAmountPaidNow('');
    setNotes('');
  };

  const handleCreateInvoice = async (modeOverride?: 'UPI' | 'CASH') => {
    if (partyType === 'existing' && !selectedPartyId) {
      Alert.alert('Validation Error', 'Please select a customer');
      return;
    }
    if (partyType === 'new' && (!newPartyName.trim() || !newPartyPhone.trim())) {
      Alert.alert('Validation Error', 'Customer Name and Mobile Number are required');
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
        Alert.alert('Validation Error', 'Quantity must be at least 1 for all items');
        return;
      }
      if (Number(it.unitPrice) < 0) {
        Alert.alert('Validation Error', 'Unit price cannot be negative');
        return;
      }
    }

    const finalMode = modeOverride || paymentMode;
    const finalPaid = finalMode !== 'CREDIT' ? (amountPaidNow ? Number(amountPaidNow) : grandTotal) : 0;

    // Upfront UPI QR checkout flow: show dynamic exact QR before creating DB invoice
    if (finalMode === 'UPI' && !modeOverride && finalPaid > 0) {
      setLoadingQr(true);
      try {
        const preview = await mobileApiRequest<any>('/invoices/preview-upi-qr', {
          method: 'POST',
          body: JSON.stringify({ amount: finalPaid }),
        });
        setUpiPreviewData({
          qrDataUrl: preview.qrDataUrl,
          vpa: preview.vpa,
          amount: finalPaid,
        });
      } catch (err: any) {
        Alert.alert('UPI Generation Failed', err.message || 'Could not generate live UPI QR');
      } finally {
        setLoadingQr(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        taxRate,
        paymentMode: finalMode,
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          productId: it.productId,
          warehouseId: it.warehouseId || undefined,
          batchNo: it.batchNo?.trim() || undefined,
          qty: Number(it.qty),
          unitPrice: Number(it.unitPrice),
          discount: Number(it.discount || 0),
        })),
        amountPaidNow: finalPaid,
      };

      if (partyType === 'existing') {
        payload.partyId = selectedPartyId;
      } else {
        payload.newParty = {
          name: newPartyName.trim(),
          phone: newPartyPhone.trim(),
          address: newPartyAddress.trim() || undefined,
          isSaved: true,
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
      subtitle="Issue GST bill and deduct stock from selected warehouse"
    >
      {/* Customer Section */}
      <Text style={styles.modalSectionTitle}>1. Customer Information</Text>
      <View style={styles.tabToggle}>
        <TouchableOpacity
          style={[styles.toggleBtn, partyType === 'existing' && styles.toggleBtnActive]}
          onPress={() => setPartyType('existing')}
        >
          <Text style={[styles.toggleText, partyType === 'existing' && styles.toggleTextActive]}>
            Select Existing
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, partyType === 'new' && styles.toggleBtnActive]}
          onPress={() => setPartyType('new')}
        >
          <Text style={[styles.toggleText, partyType === 'new' && styles.toggleTextActive]}>
            + Quick Add Party
          </Text>
        </TouchableOpacity>
      </View>

      {partyType === 'existing' ? (
        <View style={{ marginBottom: 14 }}>
          <Text style={styles.fieldLabel}>Select Customer</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
            {parties.map((p) => {
              const isSelected = selectedPartyId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setSelectedPartyId(p.id)}
                  style={[styles.partyChip, isSelected && styles.partyChipActive]}
                >
                  <Text style={[styles.partyChipTitle, isSelected && styles.partyChipTitleActive]}>
                    {p.name}
                  </Text>
                  <Text style={styles.partyChipPhone}>{p.phone}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        <View>
          <Input
            label="Customer / Firm Name"
            placeholder="e.g. Ramesh Tiles Depot"
            value={newPartyName}
            onChangeText={setNewPartyName}
          />
          <Input
            label="Mobile Number (10 digits)"
            placeholder="e.g. 9876543210"
            value={newPartyPhone}
            onChangeText={(t) => setNewPartyPhone(t.replace(/\D/g, '').slice(0, 10))}
            keyboardType="phone-pad"
            maxLength={10}
          />
          <Input
            label="Delivery Address (Optional)"
            placeholder="e.g. Shop 4, Market Road"
            value={newPartyAddress}
            onChangeText={setNewPartyAddress}
          />
        </View>
      )}

      {/* Line Items Section */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.modalSectionTitle}>2. Line Items</Text>
        <Button title="+ Add Item" size="sm" variant="outline" onPress={handleAddItem} />
      </View>

      {items.map((item, idx) => {
        const liveStock = getLiveStock(item.productId, item.warehouseId);
        return (
          <Card key={idx} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemIndexTitle}>Item #{idx + 1}</Text>
              {items.length > 1 ? (
                <TouchableOpacity onPress={() => handleRemoveItem(idx)}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Product selector chips */}
            <Text style={styles.fieldLabel}>Select Product</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
              {products.map((p) => {
                const isSelected = item.productId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => handleUpdateItem(idx, 'productId', p.id)}
                    style={[styles.smallChip, isSelected && styles.smallChipActive]}
                  >
                    <Text style={[styles.smallChipText, isSelected && styles.smallChipTextActive]}>
                      {p.name} ({p.unit})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Warehouse selector chips */}
            <Text style={styles.fieldLabel}>Warehouse Location</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
              {warehouses.map((wh) => {
                const isSelected = item.warehouseId === wh.id;
                return (
                  <TouchableOpacity
                    key={wh.id}
                    onPress={() => handleUpdateItem(idx, 'warehouseId', wh.id)}
                    style={[styles.smallChip, isSelected && styles.smallChipActive]}
                  >
                    <Text style={[styles.smallChipText, isSelected && styles.smallChipTextActive]}>
                      {wh.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Stock Indicator */}
            <View style={styles.stockNotice}>
              <Ionicons name="cube-outline" size={14} color="#A1A1AA" />
              <Text style={styles.stockNoticeText}>
                Available in Selected Warehouse:{' '}
                <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{liveStock}</Text> units
              </Text>
            </View>

            {/* Qty, Unit Price & Discount */}
            <View style={styles.numFieldsRow}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Quantity"
                  placeholder="1"
                  value={String(item.qty || '')}
                  onChangeText={(t) => handleUpdateItem(idx, 'qty', parseInt(t, 10) || 0)}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1.2 }}>
                <Input
                  label="Unit Price (₹)"
                  placeholder="0"
                  value={String(item.unitPrice || '')}
                  onChangeText={(t) => handleUpdateItem(idx, 'unitPrice', parseFloat(t) || 0)}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Discount (₹)"
                  placeholder="0"
                  value={String(item.discount || '')}
                  onChangeText={(t) => handleUpdateItem(idx, 'discount', parseFloat(t) || 0)}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </Card>
        );
      })}

      {/* 3. Tax & Payment Settlement */}
      <Text style={styles.modalSectionTitle}>3. Tax & Settlement</Text>
      <Text style={styles.fieldLabel}>GST Tax Rate</Text>
      <View style={styles.taxRow}>
        {[18, 12, 5, 28, 0].map((rate) => (
          <TouchableOpacity
            key={rate}
            onPress={() => setTaxRate(rate)}
            style={[styles.taxChip, taxRate === rate && styles.taxChipActive]}
          >
            <Text style={[styles.taxChipText, taxRate === rate && styles.taxChipTextActive]}>
              {rate}%
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Payment Mode</Text>
      <View style={styles.tabToggle}>
        {(['UPI', 'CASH', 'CREDIT'] as const).map((mode) => {
          const isSelected = paymentMode === mode;
          if (isSalesman && mode === 'CREDIT') return null;
          return (
            <TouchableOpacity
              key={mode}
              onPress={() => setPaymentMode(mode)}
              style={[styles.toggleBtn, isSelected && styles.toggleBtnActive]}
            >
              <Text style={[styles.toggleText, isSelected && styles.toggleTextActive]}>
                {mode}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Input
        label="Internal Billing Notes"
        placeholder="e.g. Counter sale, self-pickup or special rate"
        value={notes}
        onChangeText={setNotes}
      />

      {/* Calculation Summary Box */}
      <Card elevated style={styles.summaryBox}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryVal}>{formatINR(subtotal)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tax ({taxRate}%)</Text>
          <Text style={styles.summaryVal}>{formatINR(taxAmount)}</Text>
        </View>
        <View
          style={[
            styles.summaryRow,
            { borderTopWidth: 1, borderTopColor: Colors.dark.border, paddingTop: 8 },
          ]}
        >
          <Text style={styles.grandTotalLabel}>Grand Total</Text>
          <Text style={styles.grandTotalVal}>{formatINR(grandTotal)}</Text>
        </View>
      </Card>

      <Button
        title={
          loadingQr
            ? 'Generating UPI QR...'
            : submitting
            ? 'Generating Invoice...'
            : paymentMode === 'UPI'
            ? `Proceed to UPI QR (${formatINR(grandTotal)})`
            : `Generate Invoice (${formatINR(grandTotal)})`
        }
        onPress={() => handleCreateInvoice()}
        loading={submitting || loadingQr}
        size="lg"
        style={{ marginTop: 14 }}
      />

      {/* Upfront Live UPI QR Verification Modal */}
      {upiPreviewData && (
        <BottomSheetModal
          visible={Boolean(upiPreviewData)}
          onClose={() => setUpiPreviewData(null)}
          title="Counter UPI Payment"
          subtitle="Customer scans with GPay, PhonePe, Paytm, or BHIM"
        >
          <View style={styles.upiModalContainer}>
            <Text style={styles.upiAmountHeader}>{formatINR(upiPreviewData.amount)}</Text>
            <Text style={styles.upiVpaSub}>Target VPA: {upiPreviewData.vpa}</Text>

            <View style={styles.upiQrBox}>
              {upiPreviewData.qrDataUrl ? (
                <Image
                  source={{ uri: upiPreviewData.qrDataUrl }}
                  style={{ width: 200, height: 200 }}
                  resizeMode="contain"
                />
              ) : (
                <ActivityIndicator size="large" color="#FFFFFF" />
              )}
            </View>

            <Text style={styles.upiNotice}>
              Verify payment on customer phone screen or store bank alert before issuing tax bill.
            </Text>

            <Button
              title="Payment Received & Issue Invoice"
              icon="checkmark-circle-outline"
              variant="primary"
              size="lg"
              loading={submitting}
              onPress={() => handleCreateInvoice('UPI')}
              style={{ width: '100%', marginTop: 12, backgroundColor: '#10B981' }}
            />

            <Button
              title="Customer Paying Cash Instead"
              icon="cash-outline"
              variant="secondary"
              loading={submitting}
              onPress={() => {
                setUpiPreviewData(null);
                setPaymentMode('CASH');
                handleCreateInvoice('CASH');
              }}
              style={{ width: '100%', marginTop: 8 }}
            />

            <TouchableOpacity
              onPress={() => setUpiPreviewData(null)}
              style={{ paddingVertical: 10, alignItems: 'center', marginTop: 4 }}
            >
              <Text style={{ fontSize: 13, color: Colors.dark.textSecondary }}>Back to Edit Invoice</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetModal>
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 12,
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
    backgroundColor: Colors.dark.primary,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  partyChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginRight: 8,
  },
  partyChipActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  partyChipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  partyChipTitleActive: {
    color: Colors.dark.primary,
  },
  partyChipPhone: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
    marginTop: 2,
  },
  itemCard: {
    padding: 12,
    marginBottom: 10,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemIndexTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.dark.primary,
  },
  smallChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginRight: 6,
  },
  smallChipActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  smallChipText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  smallChipTextActive: {
    color: Colors.dark.primary,
  },
  stockNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    marginVertical: 6,
  },
  stockNoticeText: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
  },
  numFieldsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
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
    backgroundColor: Colors.dark.primary,
    borderColor: Colors.dark.primary,
  },
  taxChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  taxChipTextActive: {
    color: '#FFFFFF',
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
  upiModalContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  upiAmountHeader: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.dark.text,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  upiVpaSub: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginBottom: 12,
  },
  upiQrBox: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  upiNotice: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
});
