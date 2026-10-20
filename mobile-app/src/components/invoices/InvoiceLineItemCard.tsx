import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useThemedStyles } from '@/lib/theme-context';
import { formatINR } from '@/lib/formatters';
import { Product, InvoiceLineItem, StockLedger } from './types';

interface InvoiceLineItemCardProps {
  index: number;
  item: InvoiceLineItem;
  products: Product[];
  stockList?: StockLedger[];
  canRemove: boolean;
  onProductChange: (newProductId: string) => void;
  onQtyChange: (qty: number) => void;
  onUnitPriceChange: (price: number) => void;
  onRemove: () => void;
}

export function InvoiceLineItemCard({
  index,
  item,
  products,
  stockList,
  canRemove,
  onProductChange,
  onQtyChange,
  onUnitPriceChange,
  onRemove,
}: InvoiceLineItemCardProps) {
  const styles = useThemedStyles(createStyles);
  const selectedProduct = products.find((p) => p.id === item.productId);
  const availableStock = selectedProduct
    ? (stockList && stockList.length > 0
        ? stockList
            .filter((s) => s.productId === selectedProduct.id)
            .reduce((sum, s) => sum + Number(s.quantity || 0), 0)
        : (selectedProduct.availableQuantity ?? selectedProduct.totalStock ?? 0))
    : 0;

  const lineTotal = Math.max(0, (Number(item.qty) || 0) * (Number(item.unitPrice) || 0));

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
        clearable
        searchPlaceholder="Search product by name or category..."
        icon="cube-outline"
        options={products.map((p) => {
          const totalStock = stockList && stockList.length > 0
            ? stockList.filter((s) => s.productId === p.id).reduce((sum, s) => sum + Number(s.quantity || 0), 0)
            : (p.availableQuantity ?? p.totalStock ?? 0);
          const attrs = (p.attributes as Record<string, unknown>) || {};
          const price = attrs.price !== undefined ? formatINR(Number(attrs.price)) : '';
          return {
            value: p.id,
            label: p.name,
            subLabel: `${p.category || 'Standard'} • Unit: ${p.unit}${price ? ` • ${price}` : ''}${totalStock !== undefined ? ` • Stock: ${totalStock}` : ''}`,
          };
        })}
      />

      {/* Unified Stock Status Badge */}
      {item.productId ? (
        <View
          style={[
            styles.stockBadgeBox,
            availableStock <= 0 ? styles.stockBadgeBoxZero : styles.stockBadgeBoxPositive,
          ]}
        >
          <Ionicons
            name={availableStock <= 0 ? 'alert-circle-outline' : 'checkmark-circle-outline'}
            size={16}
            color={availableStock <= 0 ? '#F59E0B' : '#10B981'}
          />
          <Text
            style={[
              styles.stockBadgeText,
              availableStock <= 0 ? styles.stockBadgeTextZero : styles.stockBadgeTextPositive,
            ]}
          >
            {availableStock > 0
              ? `Unified Stock: ${availableStock} ${selectedProduct?.unit || 'units'}`
              : `Stock: 0 ${selectedProduct?.unit || 'units'} (Overdraft allowed)`}
          </Text>
        </View>
      ) : null}

      {/* Qty & Unit Price */}
      <View style={styles.numFieldsRow}>
        <View style={{ flex: 1 }}>
          <Input
            label={`Qty (${selectedProduct?.unit || 'units'})`}
            placeholder="1"
            value={item.qty ? String(item.qty) : ''}
            onChangeText={(t) => onQtyChange(parseFloat(t) || 0)}
            keyboardType="numeric"
          />
        </View>
        <View style={{ flex: 1.2 }}>
          <Input
            label="Rate (₹)"
            placeholder="0"
            value={item.unitPrice ? String(item.unitPrice) : ''}
            onChangeText={(t) => onUnitPriceChange(parseFloat(t) || 0)}
            keyboardType="numeric"
          />
        </View>
      </View>

      <View style={styles.allocatedRow}>
        <Text style={styles.stockNoticeText}>
          {item.productId
            ? `${item.qty || 0} ${selectedProduct?.unit || 'units'} × ${formatINR(Number(item.unitPrice) || 0)}`
            : 'No product selected'}
        </Text>
        <Text style={styles.lineTotalText}>
          Total: <Text style={styles.lineTotalValue}>{formatINR(lineTotal)}</Text>
        </Text>
      </View>
    </Card>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    itemCard: {
      padding: 12,
      marginBottom: 10,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
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
      color: colors.primary,
    },
    stockBadgeBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginVertical: 6,
      gap: 6,
    },
    stockBadgeBoxPositive: {
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      borderColor: 'rgba(16, 185, 129, 0.25)',
    },
    stockBadgeBoxZero: {
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderColor: 'rgba(245, 158, 11, 0.25)',
    },
    stockBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      flex: 1,
    },
    stockBadgeTextPositive: {
      color: '#10B981',
    },
    stockBadgeTextZero: {
      color: '#F59E0B',
    },
    allocatedRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 6,
      marginTop: 2,
    },
    stockNoticeText: {
      fontSize: 11,
      color: colors.textTertiary,
    },
    lineTotalText: {
      fontSize: 12,
      color: colors.textSecondary,
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
