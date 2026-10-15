import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { Ionicons } from '@expo/vector-icons';

interface WarehousePickupChecklistProps {
  warehouseGroups: Array<{
    warehouseName: string;
    warehouseAddress: string;
    items: Array<{ item: any; originalIndex: number }>;
  }>;
  pickedCount: number;
  totalItemsCount: number;
  updatingIndex: number | null;
  onTogglePickup: (itemIndex: number, currentPicked: boolean) => void;
}

export function WarehousePickupChecklist({
  warehouseGroups,
  pickedCount,
  totalItemsCount,
  updatingIndex,
  onTogglePickup,
}: WarehousePickupChecklistProps) {
  if (warehouseGroups.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="business-outline" size={16} color="#A855F7" />
          <Text style={styles.title}>Warehouse Pickup Checklist</Text>
        </View>
        <Text style={styles.countText}>
          {pickedCount}/{totalItemsCount} Picked
        </Text>
      </View>
      <Text style={styles.sub}>
        Visit each warehouse and tap &quot;Pick Up&quot; to verify and load items.
      </Text>

      {warehouseGroups.map((group, gIdx) => (
        <Card key={gIdx} style={styles.groupCard}>
          {/* Warehouse Header */}
          <View style={styles.groupHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.warehouseName}>{group.warehouseName}</Text>
              {group.warehouseAddress ? (
                <Text style={styles.warehouseAddress}>📍 {group.warehouseAddress}</Text>
              ) : null}
            </View>
            <Text style={styles.progressText}>
              {group.items.filter((i) => i.item.pickedUp).length}/{group.items.length} items
            </Text>
          </View>

          {/* Items in this warehouse */}
          <View style={styles.itemsList}>
            {group.items.map(({ item, originalIndex }) => {
              const isUpdating = updatingIndex === originalIndex;
              const isPicked = Boolean(item.pickedUp);

              return (
                <View
                  key={originalIndex}
                  style={[
                    styles.itemRow,
                    isPicked && styles.itemRowPicked,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.itemName}>{item.productName}</Text>
                      <View style={styles.qtyBadge}>
                        <Text style={styles.qtyText}>
                          {item.qty} {item.unit}
                        </Text>
                      </View>
                    </View>
                    {item.batchNo ? (
                      <Text style={styles.batchText}>Lot/Batch: {item.batchNo}</Text>
                    ) : null}
                  </View>

                  {/* Pickup Action Button - LOCKED once picked */}
                  <View>
                    {isPicked ? (
                      <View style={styles.pickedBadgeLocked}>
                        <Ionicons name="checkmark" size={13} color="#10B981" />
                        <Text style={styles.pickedText}>Picked</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.pickBtn}
                        disabled={isUpdating}
                        onPress={() => onTogglePickup(originalIndex, false)}
                      >
                        {isUpdating ? (
                          <ActivityIndicator size="small" color="#09090B" />
                        ) : (
                          <>
                            <Ionicons name="cube-outline" size={12} color="#09090B" />
                            <Text style={styles.pickBtnText}>Pick Up</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  countText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#C084FC',
  },
  sub: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
    marginBottom: 10,
  },
  groupCard: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    paddingBottom: 8,
    marginBottom: 10,
  },
  warehouseName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  warehouseAddress: {
    fontSize: 10.5,
    color: Colors.dark.textTertiary,
    marginTop: 1,
  },
  progressText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  itemsList: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    backgroundColor: Colors.dark.cardElevated,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 10,
  },
  itemRowPicked: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  qtyBadge: {
    backgroundColor: Colors.dark.secondary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  qtyText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  batchText: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pickBtnText: {
    color: '#09090B',
    fontSize: 11,
    fontWeight: '800',
  },
  pickedBadgeLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  pickedText: {
    color: '#10B981',
    fontSize: 10.5,
    fontWeight: '800',
  },
});
