import React, { useState, useEffect } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { mobileApiRequest } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import { Product, Warehouse, StockItem } from './types';

interface StockTransferModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  products: Product[];
  warehouses: Warehouse[];
  stocks?: StockItem[];
  initialStockItem?: StockItem | null;
}

export function StockTransferModal({
  visible,
  onClose,
  onSuccess,
  products,
  warehouses,
  stocks = [],
  initialStockItem,
}: StockTransferModalProps) {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedSourceKey, setSelectedSourceKey] = useState('');
  const [destWarehouseId, setDestWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter sources where stock > 0 for this product
  const availableSources = stocks.filter(
    (s) => s.productId === selectedProductId && s.quantity > 0,
  );

  // Initialize or reset
  useEffect(() => {
    if (visible) {
      if (initialStockItem) {
        setSelectedProductId(initialStockItem.productId);
        setSelectedSourceKey(`${initialStockItem.warehouseId}:::${initialStockItem.batchNo || ''}`);
        const otherWh = warehouses.find((w) => w.id !== initialStockItem.warehouseId);
        setDestWarehouseId(otherWh ? otherWh.id : '');
        setQuantity(String(Math.min(initialStockItem.quantity, 10) || 1));
      } else {
        setSelectedProductId('');
        setSelectedSourceKey('');
        setDestWarehouseId('');
        setQuantity('');
      }
    }
  }, [visible, warehouses, initialStockItem]);

  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const prodSources = stocks.filter(
      (s) => s.productId === prodId && s.quantity > 0,
    );
    if (prodSources.length > 0) {
      const firstSrc = prodSources[0];
      setSelectedSourceKey(`${firstSrc.warehouseId}:::${firstSrc.batchNo || ''}`);
      const otherWh = warehouses.find((w) => w.id !== firstSrc.warehouseId);
      setDestWarehouseId(otherWh ? otherWh.id : '');
      setQuantity(String(Math.min(firstSrc.quantity, 10) || 1));
    } else {
      setSelectedSourceKey('');
      setDestWarehouseId('');
      setQuantity('');
    }
  };

  const [fromWarehouseId, batchNo] = selectedSourceKey ? selectedSourceKey.split(':::') : ['', ''];

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const matchingStock = stocks.find(
    (s) =>
      s.productId === selectedProductId &&
      s.warehouseId === fromWarehouseId &&
      (batchNo ? s.batchNo === batchNo : !s.batchNo),
  );
  const availableQty = matchingStock?.quantity || 0;

  // Destination warehouses (excluding source)
  const destWarehouseOptions = warehouses
    .filter((w) => w.id !== fromWarehouseId)
    .map((wh) => ({
      value: wh.id,
      label: wh.name,
      subLabel: `${wh.type || 'Location'} • ${wh.address || ''}`,
    }));

  const handleTransfer = async () => {
    if (!selectedProductId || !fromWarehouseId || !destWarehouseId || !quantity) {
      Alert.alert('Required Fields', 'Please select product, source/destination warehouses, and quantity');
      return;
    }
    if (fromWarehouseId === destWarehouseId) {
      Alert.alert('Invalid Destination', 'Source and destination warehouses must be different');
      return;
    }
    const qtyNum = parseInt(quantity, 10);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      Alert.alert('Invalid Quantity', 'Quantity must be a positive integer');
      return;
    }
    if (qtyNum > availableQty) {
      Alert.alert(
        'Insufficient Stock',
        `Cannot transfer ${qtyNum} units. Available in source is ${availableQty} units.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      await mobileApiRequest('/stock/transfer', {
        method: 'POST',
        body: JSON.stringify({
          productId: selectedProductId,
          fromWarehouseId,
          toWarehouseId: destWarehouseId,
          batchNo: batchNo?.trim() || undefined,
          quantity: qtyNum,
        }),
      });

      Alert.alert('Success', `Transferred ${qtyNum} units between warehouses!`);
      onClose();
      onSuccess();
    } catch (err: any) {
      Alert.alert('Transfer Failed', err.message || 'Could not transfer stock');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Inter-Warehouse Stock Transfer"
      subtitle="Transfer inventory between warehouses/showrooms"
    >
      <View>
        {/* Product Search & Selector */}
        <Select
          label="Select Product"
          placeholder="Search product..."
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

        {/* Source Warehouse - Only where stock > 0 */}
        {!selectedProductId ? (
          <Select
            label="Source Warehouse (In-Stock Only)"
            placeholder="Select product first..."
            value=""
            disabled
            onChange={() => {}}
            icon="business-outline"
            options={[]}
          />
        ) : availableSources.length === 0 ? (
          <View style={styles.outOfStockBox}>
            <Ionicons name="alert-circle" size={16} color="#EF4444" />
            <Text style={styles.outOfStockText}>
              No available stock found in any warehouse for this product. Transfer not possible.
            </Text>
          </View>
        ) : (
          <Select
            label="Source Warehouse (In-Stock Only)"
            placeholder="Choose source warehouse..."
            value={selectedSourceKey}
            onChange={(val) => {
              setSelectedSourceKey(val);
              const [wId, bNo] = val.split(':::');
              const match = stocks.find(
                (s) =>
                  s.productId === selectedProductId &&
                  s.warehouseId === wId &&
                  (bNo ? s.batchNo === bNo : !s.batchNo),
              );
              if (match) {
                setQuantity(String(Math.min(match.quantity, 10) || 1));
              }
              const otherWh = warehouses.find((w) => w.id !== wId);
              if (destWarehouseId === wId && otherWh) {
                setDestWarehouseId(otherWh.id);
              }
            }}
            icon="business-outline"
            options={availableSources.map((s) => ({
              value: `${s.warehouseId}:::${s.batchNo || ''}`,
              label: `${s.warehouse?.name || 'Warehouse'}${s.batchNo ? ` [Batch: ${s.batchNo}]` : ''}`,
              subLabel: `Available: ${s.quantity} ${s.product?.unit || 'units'} • ${s.warehouse?.type || 'Godown'}`,
              badge: `${s.quantity} units`,
            }))}
          />
        )}

        {/* Original Amount Available */}
        {fromWarehouseId ? (
          <View style={styles.currentStockBox}>
            <Ionicons name="cube-outline" size={16} color="#10B981" />
            <Text style={styles.currentStockText}>
              Available in Source:{' '}
              <Text style={{ fontWeight: '800', color: '#FFFFFF' }}>{availableQty}</Text>{' '}
              {selectedProduct?.unit || 'units'}
            </Text>
          </View>
        ) : null}

        {/* Destination Warehouse */}
        <Select
          label="Destination Warehouse (To)"
          placeholder="Choose destination warehouse..."
          value={destWarehouseId}
          onChange={setDestWarehouseId}
          icon="business-outline"
          options={destWarehouseOptions}
        />

        {/* Transfer Quantity */}
        <Input
          label="Transfer Quantity *"
          placeholder="e.g. 50"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
        />

        <Button
          title={submitting ? 'Transferring...' : 'Execute Stock Transfer'}
          onPress={handleTransfer}
          loading={submitting}
          disabled={availableSources.length === 0}
          variant="primary"
          size="lg"
          style={{ marginTop: 12 }}
        />
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  outOfStockBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginVertical: 10,
    gap: 8,
  },
  outOfStockText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
    flex: 1,
  },
  currentStockBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginVertical: 8,
    gap: 8,
  },
  currentStockText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
});
