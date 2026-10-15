import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/theme';
import { formatINR } from '@/lib/formatters';
import { Product, StockItem } from './types';

interface ProductCatalogCardProps {
  item: Product;
  stocks: StockItem[];
  isOwnerOrAdmin: boolean;
  onInward: (productId: string) => void;
  onEdit: (product: Product) => void;
  onZeroOut: (productId: string, productName: string) => void;
  onDelete: (productId: string, productName: string) => void;
}

export function ProductCatalogCard({
  item,
  stocks,
  isOwnerOrAdmin,
  onInward,
  onEdit,
  onZeroOut,
  onDelete,
}: ProductCatalogCardProps) {
  const totalStock = (item.stockLedgers && item.stockLedgers.length > 0)
    ? item.stockLedgers.reduce((sum, s) => sum + Number(s.quantity || 0), 0)
    : stocks.filter((s) => s.productId === item.id).reduce((sum, s) => sum + Number(s.quantity || 0), 0);

  const attrs = (item.attributes as Record<string, unknown>) || {};
  const priceVal =
    attrs.price !== undefined && attrs.price !== null && attrs.price !== ''
      ? Number(attrs.price)
      : item.price;

  const specs = Object.entries(attrs)
    .filter(([k, v]) => k !== 'price' && k !== 'purchasePrice' && Boolean(v))
    .map(([k, v]) => `${k}: ${v}`)
    .join(' • ');

  return (
    <Card elevated style={styles.productCard}>
      <View style={styles.stockTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.productTitle}>{item.name}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.categoryBadgePill}>
              <Text style={styles.categoryBadgeText}>{item.category}</Text>
            </View>
            {item.hsnCode ? (
              <View style={styles.hsnBadge}>
                <Text style={styles.hsnBadgeText}>HSN: {item.hsnCode}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {priceVal ? (
          <View style={styles.priceBox}>
            <Text style={styles.priceVal}>{formatINR(priceVal)}</Text>
            <Text style={styles.priceUnit}>/{item.unit}</Text>
          </View>
        ) : (
          <View style={styles.unitChip}>
            <Text style={styles.unitChipText}>{item.unit}</Text>
          </View>
        )}
      </View>

      {specs ? (
        <Text style={styles.specsText} numberOfLines={2}>
          {specs}
        </Text>
      ) : null}

      {/* Live Stock Level Badge */}
      <View style={styles.stockStatusRow}>
        <View
          style={[
            styles.stockStatusPill,
            totalStock <= 0
              ? styles.stockPillRed
              : totalStock < 10
              ? styles.stockPillAmber
              : styles.stockPillGreen,
          ]}
        >
          <Ionicons
            name={
              totalStock <= 0
                ? 'close-circle'
                : totalStock < 10
                ? 'alert-circle'
                : 'checkmark-circle'
            }
            size={12}
            color={
              totalStock <= 0 ? '#EF4444' : totalStock < 10 ? '#F59E0B' : '#10B981'
            }
          />
          <Text
            style={[
              styles.stockStatusText,
              {
                color:
                  totalStock <= 0
                    ? '#EF4444'
                    : totalStock < 10
                    ? '#F59E0B'
                    : '#10B981',
              },
            ]}
          >
            {totalStock <= 0
              ? `Out of Stock (0 ${item.unit})`
              : totalStock < 10
              ? `Low Stock: ${totalStock} ${item.unit}`
              : `In Stock: ${totalStock} ${item.unit}`}
          </Text>
        </View>
      </View>

      {isOwnerOrAdmin ? (
        <View style={styles.productActionsRow}>
          <Button
            title="+ Inward"
            size="sm"
            variant="secondary"
            icon="add-circle-outline"
            onPress={() => onInward(item.id)}
            style={{ flex: 1.1 }}
          />
          <Button
            title="Edit"
            size="sm"
            variant="secondary"
            icon="pencil-outline"
            onPress={() => onEdit(item)}
            style={{ flex: 1 }}
          />
          {totalStock > 0 ? (
            <Button
              title="Zero Stock"
              size="sm"
              variant="outline"
              onPress={() => onZeroOut(item.id, item.name)}
              style={{ flex: 1.1 }}
            />
          ) : null}
          {totalStock === 0 ? (
            <TouchableOpacity
              style={styles.deleteIconBtn}
              onPress={() => onDelete(item.id, item.name)}
            >
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  productCard: {
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.card,
  },
  stockTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  productTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  categoryBadgePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  hsnBadge: {
    backgroundColor: Colors.dark.cardElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  hsnBadgeText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: Colors.dark.textSecondary,
  },
  priceBox: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  priceVal: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'monospace',
    color: '#10B981',
  },
  priceUnit: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
  },
  unitChip: {
    backgroundColor: Colors.dark.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unitChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  specsText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 6,
    fontStyle: 'italic',
  },
  stockStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  stockStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  stockPillRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  stockPillAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  stockPillGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  stockStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  productActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  deleteIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
