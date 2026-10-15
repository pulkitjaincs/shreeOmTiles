import React, { useState, useEffect } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Colors } from '@/constants/theme';
import { mobileApiRequest } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import { Product, Warehouse, StockItem } from './types';

interface InwardStockModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  products: Product[];
  warehouses: Warehouse[];
  stocks?: StockItem[];
  initialProductId?: string;
  initialWarehouseId?: string;
  initialBatchNo?: string;
}

export function InwardStockModal({
  visible,
  onClose,
  onSuccess,
  products,
  warehouses,
  stocks = [],
  initialProductId,
  initialWarehouseId,
  initialBatchNo,
}: InwardStockModalProps) {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [quantity, setQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedProductId(initialProductId || products[0]?.id || '');
      setSelectedWarehouseId(initialWarehouseId || warehouses[0]?.id || '');
      const defaultLot =
        initialBatchNo ||
        `LOT-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      setBatchNo(defaultLot);
      setQuantity('50');
    }
  }, [visible, products, warehouses, initialProductId, initialWarehouseId, initialBatchNo]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // Current stock of selected product in the selected warehouse
  const currentMatchingStock = stocks.find(
    (s) =>
      s.productId === selectedProductId &&
      s.warehouseId === selectedWarehouseId &&
      (batchNo ? s.batchNo === batchNo.trim() : !s.batchNo),
  );
  const currentQty = currentMatchingStock?.quantity || 0;
  const incomingNum = parseInt(quantity, 10) || 0;
  const projectedQty = currentQty + incomingNum;

  // Warehouses dropdown with current stock levels for selected product
  const warehouseOptions = warehouses.map((wh) => {
    const sMatch = stocks.find(
      (s) => s.productId === selectedProductId && s.warehouseId === wh.id,
    );
    const qty = sMatch?.quantity || 0;
    return {
      value: wh.id,
      label: wh.name,
      subLabel: `Current Stock: ${qty} ${selectedProduct?.unit || 'units'} • ${wh.address || wh.type || 'Godown'}`,
      badge: `${qty} in stock`,
    };
  });

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

      Alert.alert('Success', `Successfully inwarded ${qtyNum} ${selectedProduct?.unit || 'units'} into warehouse!`);
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
      title="Inward Stock to Warehouse"
      subtitle="Receive and add newly procured inventory into showroom or godown"
    >
      <View>
        {/* Product Search & Selector */}
        <Select
          label="Select Product / Tile Design"
          placeholder="Search product..."
          value={selectedProductId}
          onChange={setSelectedProductId}
          searchable
          searchPlaceholder="Search product by name or category..."
          icon="cube-outline"
          options={products.map((p) => ({
            value: p.id,
            label: p.name,
            subLabel: `${p.category || 'Standard'} • Unit: ${p.unit}`,
          }))}
        />

        {/* Target Warehouse with Current Stock */}
        <Select
          label="Destination Warehouse / Showroom"
          placeholder="Choose target warehouse..."
          value={selectedWarehouseId}
          onChange={setSelectedWarehouseId}
          icon="business-outline"
          options={warehouseOptions}
        />

        {/* Original Amount & Projection Display */}
        {selectedWarehouseId ? (
          <View style={styles.stockProjectionBox}>
            <View style={styles.stockProjRow}>
              <View>
                <Text style={styles.projLabel}>Current Stock</Text>
                <Text style={styles.projVal}>{currentQty} {selectedProduct?.unit || 'units'}</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={Colors.dark.textSecondary} />
              <View>
                <Text style={styles.projLabel}>Projected After Inward</Text>
                <Text style={[styles.projVal, { color: '#10B981' }]}>
                  {projectedQty} {selectedProduct?.unit || 'units'}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Batch / Lot */}
        <Input
          label="Batch / Lot Number"
          placeholder="e.g. LOT-2026-10"
          value={batchNo}
          onChangeText={setBatchNo}
        />

        {/* Incoming Quantity */}
        <Input
          label="Incoming Quantity *"
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
  stockProjectionBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginVertical: 8,
  },
  stockProjRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  projLabel: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  projVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'monospace',
    marginTop: 2,
  },
});
