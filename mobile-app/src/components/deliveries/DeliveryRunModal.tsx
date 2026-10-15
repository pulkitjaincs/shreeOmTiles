import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Colors } from '@/constants/theme';
import { formatINR } from '@/lib/formatters';
import { Delivery } from './types';

interface DeliveryRunModalProps {
  delivery: Delivery | null;
  visible: boolean;
  onClose: () => void;
  onToggleItemPickup: (deliveryId: string, itemIdx: number, currentPicked: boolean | undefined) => void;
  onUpdateStatus: (deliveryId: string, status: string) => void;
  onOpenCollectCash: (delivery: Delivery) => void;
  onOpenAddTrip: (delivery: Delivery) => void;
}

export function DeliveryRunModal({
  delivery,
  visible,
  onClose,
  onToggleItemPickup,
  onUpdateStatus,
  onOpenCollectCash,
  onOpenAddTrip,
}: DeliveryRunModalProps) {
  if (!delivery) return null;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={`Run: Invoice #${delivery.invoice?.invoiceNo}`}
      subtitle={`Customer: ${delivery.invoice?.party?.name || 'Counter Sale'}`}
      maxHeightPercent={0.92}
    >
      <View>
        <View style={styles.detailsHeader}>
          <View>
            <Text style={styles.detailsDriver}>
              Driver: {delivery.driver?.name || 'Unassigned'}
            </Text>
            <Text style={styles.detailsStatusText}>
              Current: {delivery.status.replace(/_/g, ' ')}
            </Text>
          </View>
          <StatusBadge status={delivery.status} />
        </View>

        {/* Warehouse Pickup Checklist */}
        <Text style={styles.modalSectionTitle}>Warehouse Pickup Checklist</Text>
        <Text style={styles.modalSectionSub}>
          Tap each item to mark as picked up from the warehouse. Once marked, items are locked.
        </Text>

        {(delivery.items || []).map((it, idx) => (
          <Card
            key={idx}
            style={[styles.pickupItemCard, it.pickedUp && styles.pickupItemCardDone]}
          >
            <View style={styles.pickupRow}>
              <TouchableOpacity
                style={[styles.checkbox, it.pickedUp && styles.checkboxDone]}
                onPress={() => onToggleItemPickup(delivery.id, idx, it.pickedUp)}
                disabled={it.pickedUp}
              >
                {it.pickedUp ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <Text style={[styles.pickupItemName, it.pickedUp && styles.strikethrough]}>
                  {it.productName}
                </Text>
                <Text style={styles.pickupWarehouseName}>
                  From: {it.warehouseName || 'Warehouse'}
                </Text>
                {it.warehouseAddress ? (
                  <Text style={styles.pickupWarehouseAddr}>{it.warehouseAddress}</Text>
                ) : null}
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.pickupQty}>
                  {it.qty} {it.unit}
                </Text>
                {it.pickedUp ? (
                  <View style={styles.lockedBadge}>
                    <Ionicons name="lock-closed" size={10} color="#10B981" />
                    <Text style={styles.lockedText}>Picked</Text>
                  </View>
                ) : (
                  <Text style={styles.pendingPickText}>Pending</Text>
                )}
              </View>
            </View>
          </Card>
        ))}

        {/* Delivery Progression Actions */}
        <Text style={styles.modalSectionTitle}>Workflow Progression</Text>
        <View style={styles.progressionRow}>
          {delivery.status === 'ASSIGNED' ? (
            <Button
              title="Mark: Out for Pickup"
              variant="primary"
              onPress={() => onUpdateStatus(delivery.id, 'OUT_FOR_PICKUP')}
              style={{ flex: 1 }}
            />
          ) : null}

          {delivery.status === 'OUT_FOR_PICKUP' ? (
            <Button
              title="Mark: Out for Delivery"
              variant="primary"
              onPress={() => onUpdateStatus(delivery.id, 'OUT_FOR_DELIVERY')}
              style={{ flex: 1 }}
            />
          ) : null}

          {delivery.status === 'OUT_FOR_DELIVERY' ? (
            Number(delivery.amountToCollect || 0) > 0 ? (
              <Button
                title="Mark: Delivered & Collect Cash"
                variant="primary"
                onPress={() => {
                  onClose();
                  onOpenCollectCash(delivery);
                }}
                style={{ flex: 1 }}
              />
            ) : (
              <Button
                title="Mark: Order Delivered"
                variant="primary"
                onPress={() => {
                  onUpdateStatus(delivery.id, 'DELIVERED');
                  onClose();
                }}
                style={{ flex: 1 }}
              />
            )
          ) : null}
        </View>

        {/* Trips List & Add Trip */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.modalSectionTitle}>Internal Vehicle Trips</Text>
          <Button
            title="+ Add Trip"
            size="sm"
            variant="outline"
            onPress={() => onOpenAddTrip(delivery)}
          />
        </View>

        {((delivery as any).trips || []).length > 0 ? (
          (delivery as any).trips?.map((tr: any) => (
            <Card key={tr.id} style={styles.tripCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.tripTitle}>
                  Trip #{tr.tripNo} • {tr.vehicle || 'Vehicle'}
                </Text>
                <Text style={styles.tripCost}>{formatINR(tr.cost)}</Text>
              </View>
              {tr.notes ? <Text style={styles.tripNotes}>{tr.notes}</Text> : null}
            </Card>
          ))
        ) : (
          <Text style={styles.noTripsText}>No internal vehicle trips logged yet</Text>
        )}
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  detailsDriver: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  detailsStatusText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 14,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  modalSectionSub: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
    marginBottom: 10,
  },
  pickupItemCard: {
    padding: 12,
    marginBottom: 8,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
  },
  pickupItemCardDone: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  pickupItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    color: Colors.dark.textTertiary,
  },
  pickupWarehouseName: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  pickupWarehouseAddr: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
  },
  pickupQty: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  lockedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
  },
  pendingPickText: {
    fontSize: 10,
    color: '#F59E0B',
    fontWeight: '700',
    marginTop: 2,
  },
  progressionRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 6,
  },
  tripCard: {
    padding: 10,
    marginBottom: 6,
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tripCost: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.dark.textSecondary,
  },
  tripNotes: {
    fontSize: 10.5,
    color: Colors.dark.textTertiary,
    marginTop: 4,
  },
  noTripsText: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
});
