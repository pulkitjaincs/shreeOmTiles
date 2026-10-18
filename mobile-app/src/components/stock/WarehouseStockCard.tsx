import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Colors, ThemeColors } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/lib/theme-context';
import { StockItem } from './types';

interface WarehouseStockCardProps {
  item: StockItem;
  isOwnerOrAdmin?: boolean;
  isSupervisor?: boolean;
  userWarehouseId?: string | null;
  onInward?: (item: StockItem) => void;
  onAdjust?: (item: StockItem) => void;
}

export const WarehouseStockCard = React.memo(function WarehouseStockCard({
  item,
  isOwnerOrAdmin = false,
  isSupervisor = false,
  userWarehouseId,
  onInward,
  onAdjust,
}: WarehouseStockCardProps) {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);

  const isZeroStock = Number(item.quantity || 0) <= 0;
  const isLowStock = Number(item.quantity || 0) < 10;

  const canManage = isOwnerOrAdmin || isSupervisor;
  const showActions = canManage && (onInward || onAdjust);

  return (
    <Card elevated style={styles.stockCard}>
      <View style={styles.stockTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.productTitle} numberOfLines={1}>
            {item.product?.name || 'Product'}
          </Text>
          <View style={styles.categoryPill}>
            <Text style={styles.categoryBadge}>{item.product?.category || 'General'}</Text>
          </View>
        </View>
        <View style={styles.qtyBox}>
          <Text
            style={[
              styles.qtyNumber,
              isZeroStock ? styles.qtyZero : isLowStock ? styles.qtyLow : styles.qtyNormal,
            ]}
          >
            {item.quantity}
          </Text>
          <Text style={styles.unitText}>{item.product?.unit || 'units'}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.stockMeta}>
        <View style={[styles.metaItem, { flex: 1 }]}>
          <Ionicons name="checkmark-circle-outline" size={13} color="#10B981" />
          <Text style={styles.metaText} numberOfLines={1}>
            Stock Status: <Text style={styles.metaBatchVal}>{item.batchNo ? `Batch: ${item.batchNo}` : 'Unified Stock'}</Text>
          </Text>
        </View>
      </View>

      {/* Row-Level Quick Actions Matching Web Dashboard */}
      {showActions ? (
        <View style={styles.actionsRow}>
          {onInward ? (
            <TouchableOpacity
              style={styles.actionBtnInward}
              onPress={() => onInward(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={13} color="#10B981" />
              <Text style={styles.actionTextInward}>+ Inward</Text>
            </TouchableOpacity>
          ) : null}

          {onAdjust ? (
            <TouchableOpacity
              style={styles.actionBtnAudit}
              onPress={() => onAdjust(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.actionTextAudit}>Audit</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
});

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    stockCard: {
      padding: 14,
      marginBottom: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    stockTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 10,
    },
    productTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.2,
    },
    categoryPill: {
      alignSelf: 'flex-start',
      marginTop: 4,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: colors.cardElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryBadge: {
      fontSize: 10.5,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    qtyBox: {
      alignItems: 'flex-end',
    },
    qtyNumber: {
      fontSize: 22,
      fontWeight: '900',
      fontFamily: 'monospace',
    },
    qtyNormal: {
      color: '#10B981',
    },
    qtyLow: {
      color: '#F59E0B',
    },
    qtyZero: {
      color: '#EF4444',
    },
    unitText: {
      fontSize: 10.5,
      color: colors.textTertiary,
      marginTop: 1,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 10,
    },
    stockMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    metaText: {
      fontSize: 11.5,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    metaBatchVal: {
      color: colors.text,
      fontFamily: 'monospace',
      fontWeight: '600',
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    actionBtnInward: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      height: 34,
      borderRadius: 8,
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.25)',
    },
    actionTextInward: {
      fontSize: 11.5,
      fontWeight: '700',
      color: '#10B981',
    },
    actionBtnTransfer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      height: 34,
      borderRadius: 8,
      backgroundColor: 'rgba(56, 189, 248, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(56, 189, 248, 0.25)',
    },
    actionTextTransfer: {
      fontSize: 11.5,
      fontWeight: '700',
      color: '#38BDF8',
    },
    actionBtnAudit: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      height: 34,
      borderRadius: 8,
      backgroundColor: colors.cardElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionTextAudit: {
      fontSize: 11.5,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  });
