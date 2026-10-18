import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { useThemedStyles, ThemeColors } from '@/lib/theme-context';
import { Card } from '@/components/ui/Card';
import { Ionicons } from '@expo/vector-icons';
import { cleanPhoneNumber } from '@/lib/formatters';

interface WarehousePickupChecklistProps {
  warehouseGroups?: {
    warehouseName: string;
    warehouseAddress: string;
    items: { item: any; originalIndex: number }[];
  }[];
  items?: { item: any; originalIndex: number }[];
  supervisors?: {
    id?: string;
    supervisorId?: string;
    supervisor?: { id?: string; name: string; phone?: string };
  }[];
  pickedCount: number;
  totalItemsCount: number;
  updatingIndex?: number | null;
  onTogglePickup?: (itemIndex: number, currentPicked: boolean) => void;
}

export function WarehousePickupChecklist({
  warehouseGroups,
  items,
  supervisors = [],
  pickedCount,
  totalItemsCount,
}: WarehousePickupChecklistProps) {
  const styles = useThemedStyles(createStyles);
  // Flatten items if items array passed, otherwise extract from warehouseGroups
  const checklistItems =
    items && items.length > 0
      ? items
      : (warehouseGroups || []).flatMap((g) => g.items || []);

  if (checklistItems.length === 0) return null;

  const handleCallSupervisor = (phone?: string) => {
    const clean = cleanPhoneNumber(phone);
    if (clean) {
      Linking.openURL(`tel:${clean}`).catch(() => {
        Alert.alert('Error', 'Unable to call supervisor');
      });
    }
  };

  const handleWhatsAppSupervisor = (phone?: string, name?: string) => {
    const clean = cleanPhoneNumber(phone);
    if (clean) {
      const msg = `Hello ${name || 'Supervisor'}, I am at the dispatch area for delivery pickup. Please verify my loaded items.`;
      Linking.openURL(`https://wa.me/91${clean}?text=${encodeURIComponent(msg)}`).catch(() => {
        Alert.alert('Error', 'Unable to open WhatsApp');
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Assigned Dispatch Supervisor(s) Card */}
      {supervisors && supervisors.length > 0 && (
        <Card style={styles.supervisorCard}>
          <View style={styles.supervisorHeader}>
            <View style={styles.supervisorIconBox}>
              <Ionicons name="shield-checkmark" size={16} color="#A855F7" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.supervisorTitle}>Assigned Dispatch Supervisor(s)</Text>
              <Text style={styles.supervisorSub}>
                Contact supervisor for goods inspection and gate pass verification:
              </Text>
            </View>
          </View>

          <View style={styles.supervisorsList}>
            {supervisors.map((sRecord, idx) => {
              const sup = sRecord.supervisor || (sRecord as any);
              if (!sup?.name) return null;

              return (
                <View key={sRecord.id || idx} style={styles.supervisorRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.supervisorName}>{sup.name}</Text>
                    {sup.phone ? (
                      <Text style={styles.supervisorPhone}>{sup.phone}</Text>
                    ) : null}
                  </View>

                  {sup.phone ? (
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.callBtn}
                        onPress={() => handleCallSupervisor(sup.phone)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="call" size={12} color="#38BDF8" />
                        <Text style={styles.callBtnText}>Call</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.waBtn}
                        onPress={() => handleWhatsAppSupervisor(sup.phone, sup.name)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="logo-whatsapp" size={12} color="#10B981" />
                        <Text style={styles.waBtnText}>WhatsApp</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </Card>
      )}

      {/* 2. Flat Items Pickup Checklist */}
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="checkbox-outline" size={16} color="#A855F7" />
          <Text style={styles.title}>Pickup Item Checklist</Text>
        </View>
        <Text style={styles.countText}>
          {pickedCount}/{totalItemsCount} Verified
        </Text>
      </View>
      <Text style={styles.sub}>
        Items to load for this delivery. Dispatch supervisor will inspect and verify physical pickup.
      </Text>

      <Card style={styles.checklistCard}>
        <View style={styles.itemsList}>
          {checklistItems.map(({ item, originalIndex }) => {
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
                  <Text style={styles.batchText}>
                    {item.batchNo ? `Lot: ${item.batchNo}` : 'Standard Lot'}
                  </Text>
                </View>

                {/* Pickup Status - Supervisor Verification only */}
                <View>
                  {isPicked ? (
                    <View style={styles.pickedBadgeLocked}>
                      <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                      <Text style={styles.pickedText}>
                        {item.pickedUpByName ? `Picked (${item.pickedUpByName})` : 'Verified'}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.awaitingBadge}>
                      <Ionicons name="time-outline" size={12} color="#F59E0B" />
                      <Text style={styles.awaitingText}>Awaiting Inspection</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </Card>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      marginTop: 14,
    },
    supervisorCard: {
      padding: 14,
      borderRadius: 16,
      marginBottom: 12,
      backgroundColor: 'rgba(168, 85, 247, 0.08)',
      borderWidth: 1,
      borderColor: 'rgba(168, 85, 247, 0.25)',
    },
    supervisorHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },
    supervisorIconBox: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: 'rgba(168, 85, 247, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    supervisorTitle: {
      fontSize: 12.5,
      fontWeight: '800',
      color: colors.text,
    },
    supervisorSub: {
      fontSize: 10.5,
      color: colors.textSecondary,
      marginTop: 1,
    },
    supervisorsList: {
      gap: 8,
    },
    supervisorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 10,
      borderRadius: 10,
      backgroundColor: colors.cardElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    supervisorName: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    supervisorPhone: {
      fontSize: 10.5,
      color: colors.textSecondary,
      marginTop: 1,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 6,
    },
    callBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 6,
      backgroundColor: 'rgba(56, 189, 248, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(56, 189, 248, 0.25)',
    },
    callBtnText: {
      fontSize: 10.5,
      fontWeight: '700',
      color: '#38BDF8',
    },
    waBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 6,
      backgroundColor: 'rgba(16, 185, 129, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.25)',
    },
    waBtnText: {
      fontSize: 10.5,
      fontWeight: '700',
      color: '#10B981',
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      fontSize: 13.5,
      fontWeight: '800',
      color: colors.text,
    },
    countText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#C084FC',
    },
    sub: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
      marginBottom: 10,
    },
    checklistCard: {
      padding: 14,
      borderRadius: 16,
      marginBottom: 10,
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
      backgroundColor: colors.cardElevated,
      borderWidth: 1,
      borderColor: colors.border,
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
      color: colors.text,
    },
    qtyBadge: {
      backgroundColor: colors.secondary,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 4,
    },
    qtyText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.secondaryForeground,
    },
    batchText: {
      fontSize: 10,
      color: colors.textTertiary,
      marginTop: 2,
      fontFamily: 'monospace',
    },
    pickedBadgeLocked: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
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
    awaitingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.25)',
    },
    awaitingText: {
      color: '#F59E0B',
      fontSize: 10.5,
      fontWeight: '700',
    },
  });
