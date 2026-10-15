import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Colors } from '@/constants/theme';
import { formatINR } from '@/lib/formatters';
import { Product, Warehouse, InvoiceLineItem } from './types';

interface InvoiceLineItemCardProps {
  index: number;
  item: InvoiceLineItem;
  products: Product[];
  warehouses: Warehouse[];
  canRemove: boolean;
  onProductChange: (newProductId: string) => void;
  onAllocationQtyChange: (allocationIndex: number, text: string) => void;
  onUnitPriceChange: (price: number) => void;
  onDiscountChange: (discount: number) => void;
  onRemove: () => void;
}

export function InvoiceLineItemCard({
  index,
  item,
  products,
  warehouses,
  canRemove,
  onProductChange,
  onAllocationQtyChange,
  onUnitPriceChange,
  onDiscountChange,
  onRemove,
}: InvoiceLineItemCardProps) {
  const selectedProduct = products.find((p) => p.id === item.productId);
  const totalAllocated = (item.allocations || []).reduce((sum, a) => sum + (a.qty || 0), 0);
  const lineTotal = Math.max(
    0,
    totalAllocated * (Number(item.unitPrice) || 0) - (Number(item.discount) || 0),
  );

  return (
    <Card style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemIndexTitle}>Item #{index + 1}</Text>
        {canRemove ? (
          <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Product Selector */}
      <Select
        label="Select Product"
        placeholder="Choose product / tile..."
        value={item.productId}
        onChange={onProductChange}
        searchable
        searchPlaceholder="Search product by name or category..."
        icon="cube-outline"
        options={products.map((p) => ({
          value: p.id,
          label: p.name,
          subLabel: `${p.category || 'Standard'} • Unit: ${p.unit}`,
        }))}
      />

      {/* Warehouse & Batch Allocation */}
      <Text style={styles.fieldLabel}>Warehouse & Batch Allocation</Text>
      {(item.allocations || []).length === 0 ? (
        <View style={styles.outOfStockBox}>
          <Ionicons name="alert-circle" size={16} color="#EF4444" />
          <Text style={styles.outOfStockText}>
            Out of stock across all locations for this product.
          </Text>
        </View>
      ) : (
        (item.allocations || []).map((allocation, allocationIndex) => {
          const warehouse = warehouses.find((wh) => wh.id === allocation.warehouseId);
          const locationName = warehouse?.name || 'Warehouse';
          const batchInfo = allocation.batchNo ? ` • Batch ${allocation.batchNo}` : ' • Standard';
          return (
            <Input
              key={`${allocation.warehouseId}-${allocation.batchNo || 'standard'}-${allocationIndex}`}
              label={`${locationName}${batchInfo} (Available: ${allocation.availableQty})`}
              placeholder="0"
              value={allocation.qty ? String(allocation.qty) : ''}
              onChangeText={(value) => onAllocationQtyChange(allocationIndex, value)}
              keyboardType="number-pad"
            />
          );
        })
      )}

      <View style={styles.allocatedRow}>
        <Text style={styles.stockNoticeText}>
          Total allocated: {totalAllocated} {selectedProduct?.unit || 'units'}
        </Text>
        <Text style={styles.lineTotalText}>
          Line Total: <Text style={styles.lineTotalValue}>{formatINR(lineTotal)}</Text>
        </Text>
      </View>

      {/* Unit Price & Discount */}
      <View style={styles.numFieldsRow}>
        <View style={{ flex: 1 }}>
          <Input
            label="Unit Price (₹)"
            placeholder="0"
            value={item.unitPrice ? String(item.unitPrice) : ''}
            onChangeText={(t) => onUnitPriceChange(parseFloat(t) || 0)}
            keyboardType="numeric"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label="Discount (₹)"
            placeholder="0"
            value={item.discount ? String(item.discount) : ''}
            onChangeText={(t) => onDiscountChange(parseFloat(t) || 0)}
            keyboardType="numeric"
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
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
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  outOfStockBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 6,
    gap: 8,
  },
  outOfStockText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
    flex: 1,
  },
  allocatedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 4,
  },
  stockNoticeText: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
  },
  lineTotalText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  lineTotalValue: {
    color: '#34D399',
    fontWeight: '800',
  },
  numFieldsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
});
