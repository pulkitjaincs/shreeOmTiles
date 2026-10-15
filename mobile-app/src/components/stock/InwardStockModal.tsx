import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/theme';
import { mobileApiRequest } from '@/lib/api';
import { Product, Warehouse } from './types';

interface InwardStockModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  products: Product[];
  warehouses: Warehouse[];
}

export function InwardStockModal({
  visible,
  onClose,
  onSuccess,
  products,
  warehouses,
}: InwardStockModalProps) {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [quantity, setQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedProductId(products[0]?.id || '');
      setSelectedWarehouseId(warehouses[0]?.id || '');
      setBatchNo(`LOT-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
      setQuantity('');
    }
  }, [visible, products, warehouses]);

  const handleInward = async () => {
    if (!selectedProductId || !selectedWarehouseId || !quantity) {
      Alert.alert('Required Fields', 'Please select product, warehouse, and quantity');
      return;
    }
    const qtyNum = parseInt(quantity, 10);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      Alert.alert('Invalid Quantity', 'Quantity must be a positive integer');
      return;
    }

    setSubmitting(true);
    try {
      await mobileApiRequest('/stock/adjust', {
        method: 'POST',
        body: JSON.stringify({
          productId: selectedProductId,
          warehouseId: selectedWarehouseId,
          batchNo: batchNo.trim() || undefined,
          quantity: qtyNum,
          mode: 'ADD',
        }),
      });

      Alert.alert('Success', 'Inventory successfully inwarded and restocked!');
      onClose();
      onSuccess();
    } catch (err: any) {
      Alert.alert('Inward Failed', err.message || 'Could not record inward stock');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Inward Stock"
      subtitle="Record newly received inventory into warehouse"
    >
      <View>
        <Text style={styles.fieldLabel}>Select Product</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
          {products.map((p) => {
            const isSelected = selectedProductId === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => setSelectedProductId(p.id)}
                style={[styles.smallChip, isSelected && styles.smallChipActive]}
              >
                <Text style={[styles.smallChipText, isSelected && styles.smallChipTextActive]}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.fieldLabel}>Target Warehouse</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
          {warehouses.map((wh) => {
            const isSelected = selectedWarehouseId === wh.id;
            return (
              <TouchableOpacity
                key={wh.id}
                onPress={() => setSelectedWarehouseId(wh.id)}
                style={[styles.smallChip, isSelected && styles.smallChipActive]}
              >
                <Text style={[styles.smallChipText, isSelected && styles.smallChipTextActive]}>
                  {wh.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Input
          label="Batch / Lot Number"
          placeholder="e.g. LOT-2026-10"
          value={batchNo}
          onChangeText={setBatchNo}
        />

        <Input
          label="Incoming Quantity"
          placeholder="e.g. 100"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
        />

        <Button
          title={submitting ? 'Inwarding...' : 'Confirm Inward Stock'}
          onPress={handleInward}
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
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    marginBottom: 4,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  smallChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginRight: 6,
  },
  smallChipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  smallChipText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  smallChipTextActive: {
    color: '#09090B',
    fontWeight: '800',
  },
});
