import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/theme';
import { Warehouse } from './types';
import { StockItem } from '@/components/stock/types';

interface WarehouseCardProps {
  warehouse: Warehouse;
  stocks?: StockItem[];
  onEdit: (wh: Warehouse) => void;
  onZeroOut: (wh: Warehouse, totalUnits: number) => void;
  onDelete: (wh: Warehouse, totalUnits: number) => void;
  isOwnerOrAdmin?: boolean;
}

export function WarehouseCard({
  warehouse,
  stocks = [],
  onEdit,
  onZeroOut,
  onDelete,
  isOwnerOrAdmin = true,
}: WarehouseCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Compute live stock metrics for this location
  const whStocks = stocks.filter(
    (s) => s.warehouseId === warehouse.id && Number(s.quantity || 0) > 0,
  );
  const totalUnits = whStocks.reduce((sum, s) => sum + Number(s.quantity || 0), 0);
  const skuCount = new Set(
    whStocks.filter((s) => Boolean(s.productId)).map((s) => s.productId),
  ).size;
  const isShowroom = warehouse.type === 'SHOWROOM';

  return (
    <Card elevated style={styles.card}>
      {/* Top Header */}
      <View style={styles.headerRow}>
        <View
          style={[
            styles.iconContainer,
            isShowroom ? styles.iconContainerShowroom : styles.iconContainerWarehouse,
          ]}
        >
          <Ionicons
            name={isShowroom ? 'storefront-outline' : 'business-outline'}
            size={22}
            color={isShowroom ? '#38BDF8' : '#818CF8'}
          />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.titleRow}>
            <Text style={styles.nameText} numberOfLines={1}>
              {warehouse.name}
            </Text>
            <View style={isShowroom ? styles.showroomBadge : styles.warehouseBadge}>
              <Text style={isShowroom ? styles.showroomBadgeText : styles.warehouseBadgeText}>
                {warehouse.type}
              </Text>
            </View>
          </View>

          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={13} color={Colors.dark.textTertiary} />
            <Text style={styles.addressText} numberOfLines={1}>
              {warehouse.address || 'Address not registered'}
            </Text>
          </View>
        </View>
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Total Units</Text>
          <Text
            style={[
              styles.metricValue,
              totalUnits > 0 ? styles.metricValueActive : styles.metricValueEmpty,
            ]}
          >
            {totalUnits}{' '}
            <Text style={styles.metricUnit}>{totalUnits === 1 ? 'unit' : 'units'}</Text>
          </Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Unique Designs</Text>
          <Text style={styles.metricValue}>
            {skuCount} <Text style={styles.metricUnit}>SKUs</Text>
          </Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Location Status</Text>
          <View style={styles.statusPill}>
            <View
              style={[
                styles.statusDot,
                totalUnits > 0 ? styles.statusDotActive : styles.statusDotEmpty,
              ]}
            />
            <Text style={styles.statusText}>{totalUnits > 0 ? 'Active' : 'Empty'}</Text>
          </View>
        </View>
      </View>

      {/* Expand / Collapse Live Breakdown Toggle */}
      {whStocks.length > 0 ? (
        <TouchableOpacity
          style={styles.expandToggle}
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={expanded ? 'chevron-up' : 'list-outline'}
            size={14}
            color={Colors.dark.textSecondary}
          />
          <Text style={styles.expandToggleText}>
            {expanded
              ? 'Hide Inventory Breakdown'
              : `View Stored Items (${whStocks.length} batches)`}
          </Text>
        </TouchableOpacity>
      ) : null}

      {/* Expanded Inventory Items */}
      {expanded && whStocks.length > 0 ? (
        <View style={styles.breakdownBox}>
          {whStocks.slice(0, 6).map((item) => (
            <View key={item.id} style={styles.stockItemRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.stockProdName} numberOfLines={1}>
                  {item.product?.name || 'Item'}
                </Text>
                <Text style={styles.stockBatchText}>
                  {item.product?.category} • Batch: {item.batchNo || 'Standard'}
                </Text>
              </View>
              <Text
                style={[
                  styles.stockQtyText,
                  item.quantity <= 10 ? styles.stockQtyLow : styles.stockQtyNormal,
                ]}
              >
                {item.quantity} {item.product?.unit || 'units'}
              </Text>
            </View>
          ))}
          {whStocks.length > 6 ? (
            <Text style={styles.moreItemsText}>+ {whStocks.length - 6} more batches in stock</Text>
          ) : null}
        </View>
      ) : null}

      {/* Action Buttons with Strict Safeguards Matching Web */}
      {isOwnerOrAdmin ? (
        <View style={styles.actionsRow}>
          {/* Edit Location */}
          <Button
            title="Edit"
            icon="create-outline"
            size="sm"
            variant="outline"
            onPress={() => onEdit(warehouse)}
            style={styles.cardBtn}
          />

          {/* Zero-Out Action: Only shown/enabled when totalUnits > 0 */}
          {totalUnits > 0 ? (
            <Button
              title="Set to 0"
              icon="refresh-outline"
              size="sm"
              variant="secondary"
              onPress={() => onZeroOut(warehouse, totalUnits)}
              style={[styles.cardBtn, styles.zeroOutBtn]}
              textStyle={{ color: '#FBBF24' }}
            />
          ) : null}

          {/* Delete Action: Only shown/enabled when totalUnits === 0 (Strict Safeguard) */}
          {totalUnits === 0 ? (
            <Button
              title="Remove"
              icon="trash-outline"
              size="sm"
              variant="danger"
              onPress={() => onDelete(warehouse, totalUnits)}
              style={styles.cardBtn}
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.borderMedium,
    backgroundColor: Colors.dark.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerShowroom: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  iconContainerWarehouse: {
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.25)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  nameText: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    flex: 1,
  },
  showroomBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  showroomBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  warehouseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(129, 140, 248, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)',
  },
  warehouseBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#818CF8',
    letterSpacing: 0.5,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  addressText: {
    fontSize: 11.5,
    color: Colors.dark.textSecondary,
    flex: 1,
  },
  metricsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.dark.cardElevated,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.dark.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  metricValueActive: {
    color: '#10B981',
  },
  metricValueEmpty: {
    color: Colors.dark.textSecondary,
  },
  metricUnit: {
    fontSize: 10.5,
    fontWeight: '500',
    color: Colors.dark.textSecondary,
    fontFamily: 'System',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.dark.border,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusDotEmpty: {
    backgroundColor: '#71717A',
  },
  statusText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  expandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 4,
  },
  expandToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  breakdownBox: {
    marginTop: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 6,
  },
  stockItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 3,
  },
  stockProdName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stockBatchText: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
    marginTop: 1,
  },
  stockQtyText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  stockQtyNormal: {
    color: '#10B981',
  },
  stockQtyLow: {
    color: '#F59E0B',
  },
  moreItemsText: {
    fontSize: 10.5,
    color: Colors.dark.textTertiary,
    textAlign: 'center',
    marginTop: 2,
    fontStyle: 'italic',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  cardBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
  },
  zeroOutBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
});
