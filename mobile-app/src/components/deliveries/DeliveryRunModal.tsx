import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Colors } from '@/constants/theme';
import { formatINR, formatDate, cleanPhoneNumber } from '@/lib/formatters';
import { downloadAndSharePdf } from '@/lib/pdf';
import { useAuth } from '@/lib/auth-context';
import { Delivery } from './types';

interface DeliveryRunModalProps {
  delivery: Delivery | null;
  visible: boolean;
  onClose: () => void;
  onToggleItemPickup?: (deliveryId: string, itemIdx: number, currentPicked: boolean | undefined) => void;
  onUpdateStatus?: (deliveryId: string, status: string) => void;
  onOpenCollectCash?: (delivery: Delivery) => void;
}

export function DeliveryRunModal({
  delivery,
  visible,
  onClose,
}: DeliveryRunModalProps) {
  const { user } = useAuth();
  const isSupervisor = user?.role === 'SUPERVISOR';
  if (!delivery) return null;

  const partyPhone = delivery.invoice?.party?.phone;
  const partyAddress = delivery.invoice?.party?.address;
  const isSelfPickup =
    !delivery.driverId ||
    Boolean(
      delivery.notes &&
        /customer\s*picked\s*up|self-pickup|counter\s*pickup/i.test(delivery.notes),
    );

  const deliveredItems =
    delivery.items && delivery.items.length > 0
      ? delivery.items
      : (delivery.invoice?.items || []).map((it: any) => ({
          productId: it.productId,
          productName: it.product?.name || 'Product',
          unit: it.product?.unit || 'unit',
          warehouseName: it.warehouse?.name || 'Warehouse',
          warehouseAddress: it.warehouse?.address || '',
          batchNo: it.batchNo,
          qty: it.qty,
          pickedUp: true,
        }));

  const cashCollectedNum = Number(delivery.cashCollected || 0);

  const handleCall = (phone?: string) => {
    const clean = cleanPhoneNumber(phone);
    if (clean) {
      Linking.openURL(`tel:${clean}`).catch(() => {
        Alert.alert('Error', 'Unable to initiate phone call');
      });
    }
  };

  const handleMap = (address?: string) => {
    if (address) {
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
      ).catch(() => {
        Alert.alert('Error', 'Unable to open Google Maps');
      });
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={`Run Details: #${delivery.invoice?.invoiceNo || 'N/A'}`}
      subtitle={`Customer: ${delivery.invoice?.party?.name || 'Walk-in Customer'}`}
      maxHeightPercent={0.92}
    >
      <View style={styles.modalContent}>
        {/* Top Header Card */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>Delivery Fulfillment</Text>
              <Text style={styles.summaryDriverName} numberOfLines={1}>
                {isSelfPickup
                  ? 'Customer Self-Pickup (Showroom Counter)'
                  : delivery.driver?.name
                  ? `Driver: ${delivery.driver.name}`
                  : 'Delivered (Direct)'}
              </Text>
            </View>
            <StatusBadge status={delivery.status} size="sm" />
          </View>

          {/* Quick Contact & Navigation */}
          <View style={styles.contactRow}>
            {partyPhone ? (
              <TouchableOpacity
                style={styles.actionChip}
                onPress={() => handleCall(partyPhone)}
                activeOpacity={0.7}
              >
                <Ionicons name="call" size={12} color="#38BDF8" />
                <Text style={styles.actionChipText}>{partyPhone}</Text>
              </TouchableOpacity>
            ) : null}

            {partyAddress ? (
              <TouchableOpacity
                style={[styles.actionChip, { flex: 1 }]}
                onPress={() => handleMap(partyAddress)}
                activeOpacity={0.7}
              >
                <Ionicons name="location" size={12} color="#F59E0B" />
                <Text style={styles.actionChipText} numberOfLines={1}>
                  {partyAddress}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Delivered Timestamp */}
          <View style={styles.dateMetaRow}>
            <Ionicons name="calendar-outline" size={12} color={Colors.dark.textTertiary} />
            <Text style={styles.dateMetaText}>
              Delivered on {formatDate(delivery.cashCollectedAt || delivery.createdAt)}
            </Text>
          </View>
        </Card>

        {/* Payment & Cash Custody Status - Mask for Supervisor */}
        {!isSupervisor ? (
          <Card style={styles.paymentCard}>
            <View style={styles.paymentRow}>
              <View>
                <Text style={styles.paymentLabel}>Payment Settlement</Text>
                <Text style={styles.paymentValue}>
                  {cashCollectedNum > 0
                    ? formatINR(delivery.cashCollected)
                    : Number(delivery.amountToCollect || 0) === 0
                    ? 'Prepaid (₹0 Dues)'
                    : `Dues: ${formatINR(delivery.amountToCollect)}`}
                </Text>
              </View>

              {cashCollectedNum > 0 ? (
                delivery.cashHandedOver ? (
                  <View style={styles.settledBadge}>
                    <Ionicons name="checkmark-done" size={12} color="#10B981" />
                    <Text style={styles.settledBadgeText}>Office Received</Text>
                  </View>
                ) : (
                  <View style={styles.custodyBadge}>
                    <Ionicons name="wallet-outline" size={12} color="#F59E0B" />
                    <Text style={styles.custodyBadgeText}>With Driver</Text>
                  </View>
                )
              ) : (
                <View style={styles.settledBadge}>
                  <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                  <Text style={styles.settledBadgeText}>Fully Settled</Text>
                </View>
              )}
            </View>
          </Card>
        ) : null}

        {/* Delivered Items Manifest */}
        <Text style={styles.sectionTitle}>
          Delivered Line Items ({deliveredItems.length})
        </Text>

        {deliveredItems.map((it: any, idx: number) => (
          <Card key={idx} style={styles.itemCard}>
            <View style={styles.itemRow}>
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark" size={14} color="#10B981" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{it.productName}</Text>
                <Text style={styles.itemSub}>
                  Origin: {it.warehouseName || 'Warehouse'}
                  {it.batchNo ? ` • Batch: ${it.batchNo}` : ''}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.itemQty}>
                  {it.qty} {it.unit}
                </Text>
                <View style={styles.deliveredPill}>
                  <Text style={styles.deliveredPillText}>Delivered</Text>
                </View>
              </View>
            </View>
          </Card>
        ))}

        {/* Optional Notes */}
        {delivery.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Fulfillment Notes</Text>
            <Text style={styles.notesText}>{delivery.notes}</Text>
          </View>
        ) : null}

        {/* Challan PDF Download */}
        <Button
          title="Download Delivery Challan PDF"
          icon="document-text-outline"
          variant="outline"
          size="md"
          onPress={() =>
            downloadAndSharePdf(
              `delivery/${delivery.id}/challan-pdf`,
              `Challan_${delivery.invoice?.invoiceNo || delivery.id}`,
            )
          }
          style={{ marginTop: 14 }}
        />

        {/* Close Button */}
        <Button
          title="Done & Close"
          variant="secondary"
          size="md"
          onPress={onClose}
          style={{ marginTop: 10 }}
        />
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    paddingBottom: 16,
  },
  summaryCard: {
    padding: 12,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 10,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  summaryLabel: {
    fontSize: 10.5,
    color: Colors.dark.textTertiary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryDriverName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  contactRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.dark.cardElevated,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  actionChipText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  dateMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  dateMetaText: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
  },
  paymentCard: {
    padding: 12,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 14,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLabel: {
    fontSize: 10.5,
    color: Colors.dark.textTertiary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  paymentValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  settledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  settledBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  custodyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  custodyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  itemCard: {
    padding: 10,
    marginBottom: 6,
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  itemSub: {
    fontSize: 10.5,
    color: Colors.dark.textTertiary,
    marginTop: 1,
  },
  itemQty: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  deliveredPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 4,
    paddingVertical: 1,
    paddingHorizontal: 5,
    marginTop: 2,
  },
  deliveredPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#10B981',
  },
  notesBox: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginTop: 8,
  },
  notesLabel: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  notesText: {
    fontSize: 11.5,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
});
