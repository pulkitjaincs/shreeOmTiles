import React, { useState, useEffect } from 'react';
import { View, Text, Alert, StyleSheet, TouchableOpacity } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Colors } from '@/constants/theme';
import { mobileApiRequest } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import { Product, Warehouse, StockItem } from './types';

interface StockAdjustModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  products: Product[];
  warehouses: Warehouse[];
  stocks?: StockItem[];
  initialStockItem?: StockItem | null;
}

export function StockAdjustModal({
  visible,
  onClose,
  onSuccess,
  products,
  warehouses,
  stocks = [],
  initialStockItem,
}: StockAdjustModalProps) {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Initialize or reset on open
  useEffect(() => {
    if (visible) {
      if (initialStockItem) {
        setSelectedProductId(initialStockItem.productId);
        setQuantity(String(initialStockItem.quantity));
      } else {
        const initialProdId = products[0]?.id || '';
        setSelectedProductId(initialProdId);
        const match = stocks.find((s) => s.productId === initialProdId);
        setQuantity(match ? String(match.quantity) : '0');
      }
    }
  }, [visible, products, stocks, initialStockItem]);

  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const match = stocks.find((s) => s.productId === prodId);
    setQuantity(match ? String(match.quantity) : '0');
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const matchingStock = stocks.find((s) => s.productId === selectedProductId);
  const currentQty = matchingStock?.quantity ?? selectedProduct?.availableQuantity ?? 0;

  const handleAdjust = async () => {
    if (!selectedProductId || quantity === '') {
      Alert.alert('Required Fields', 'Please select product and enter verified count');
      return;
    }
    const qtyNum = parseFloat(quantity);
    if (isNaN(qtyNum)) {
      Alert.alert('Invalid Quantity', 'Please enter a valid numeric count');
      return;
    }

    setSubmitting(true);
    try {
      await mobileApiRequest('/stock/adjust', {
        method: 'POST',
        body: JSON.stringify({
          productId: selectedProductId,
          quantity: qtyNum,
          mode: 'SET',
        }),
      });

      Alert.alert('Success', `Physical count adjusted to ${qtyNum} ${selectedProduct?.unit || 'units'}!`);
      onClose();
      onSuccess();
    } catch (err: any) {
      Alert.alert('Adjustment Failed', err.message || 'Could not adjust stock');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Audit Physical Count"
      subtitle="Verify or correct product physical inventory count"
    >
      <View>
        {/* Product Search & Selector */}
        <Select
          label="Select Product"
          placeholder="Search and choose product..."
          value={selectedProductId}
          onChange={handleProductChange}
          searchable
          searchPlaceholder="Search product by name or category..."
          icon="cube-outline"
          options={products.map((p) => ({
            value: p.id,
            label: p.name,
            subLabel: `${p.category || 'Standard'} • Unit: ${p.unit}`,
          }))}
        />

        {/* Original Amount Display & Quick Zero */}
        <View style={styles.currentStockBox}>
          <View style={{ flex: 1 }}>
            <Text style={styles.currentStockLabel}>Original / System Count</Text>
            <Text style={styles.currentStockVal}>
              {currentQty}{' '}
              <Text style={{ fontSize: 13, fontWeight: '500', color: Colors.dark.textSecondary }}>
                {selectedProduct?.unit || 'units'}
              </Text>
            </Text>
          </View>
          <TouchableOpacity
            style={styles.zeroBtn}
            onPress={() => setQuantity('0')}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={13} color="#F59E0B" />
            <Text style={styles.zeroBtnText}>Set to 0</Text>
          </TouchableOpacity>
        </View>

        {/* Verified Physical Count Input */}
        <Input
          label="Verified Physical Quantity *"
          placeholder="e.g. 80"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
        />

        <Button
          title={submitting ? 'Saving Adjustment...' : 'Save Stock Adjustment'}
          onPress={handleAdjust}
          loading={submitting}
          variant="primary"
          size="lg"
          style={{ marginTop: 12 }}
        />
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  currentStockBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginVertical: 10,
  },
  currentStockLabel: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currentStockVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  zeroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  zeroBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F59E0B',
  },
});
