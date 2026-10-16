import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Colors } from '@/constants/theme';
import { formatINR, formatDate, cleanPhoneNumber } from '@/lib/formatters';
import { buildFullDeliveryManifestShareUrl } from '@/lib/whatsapp';
import { downloadAndSharePdf } from '@/lib/pdf';
import { Delivery } from './types';

interface DeliveryCardProps {
  delivery: Delivery;
  isOwnerOrAdmin: boolean;
  isDriver: boolean;
  isSupervisor?: boolean;
  userWarehouseId?: string | null;
  handoverInProgress: string | null;
  onOpenRunDetails: (delivery: Delivery) => void;
  onOpenPushModal: (delivery: Delivery) => void;
  onOpenCollectCash: (delivery: Delivery) => void;
  onCustomerPickedUp: (deliveryId: string) => void;
  onHandoverCash: (deliveryId: string) => void;
  onUpdateStatus: (deliveryId: string, status: string) => void;
  onSupervisorConfirmPick?: (deliveryId: string, itemIdx: number) => void;
}

export const DeliveryCard = React.memo(function DeliveryCard({
  delivery,
  isOwnerOrAdmin,
  isDriver,
  isSupervisor = false,
  userWarehouseId,
  handoverInProgress,
  onOpenRunDetails,
  onOpenPushModal,
  onOpenCollectCash,
  onCustomerPickedUp,
  onHandoverCash,
  onUpdateStatus,
  onSupervisorConfirmPick,
}: DeliveryCardProps) {
  const partyPhone = delivery.invoice?.party?.phone;
  const partyAddress = delivery.invoice?.party?.address;

  const itemsList = delivery.items || [];
  const pickedCount = itemsList.filter((it) => it.pickedUp).length;
  const totalCount = itemsList.length;

  const cashCollectedNum = Number(delivery.cashCollected || 0);

  const isDriverAssigned = Boolean(delivery.driverId);
  const isDelivered = delivery.status === 'DELIVERED';
  const isCancelled = delivery.status === 'CANCELLED';
  const isOutForPickup = delivery.status === 'OUT_FOR_PICKUP';
  const isOutForDelivery =
    delivery.status === 'OUT_FOR_DELIVERY' || delivery.status === 'PICKED_UP';
  const isAssignedToDriver = delivery.status === 'ASSIGNED';
  const isCustomerPickup =
    (delivery.status === 'DELIVERED' && !delivery.driverId) ||
    Boolean(
      delivery.notes &&
        /customer\s*picked\s*up|self-pickup|counter\s*pickup/i.test(delivery.notes),
    );
  const isPendingPush =
    delivery.status === 'PENDING' && !isDelivered && !isCancelled && !isCustomerPickup;

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

  const handleShareManifest = () => {
    const url = buildFullDeliveryManifestShareUrl(delivery);
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open WhatsApp. Please ensure WhatsApp is installed.');
    });
  };

  const hasCustomerOrRunActions = Boolean(
    partyPhone ||
      partyAddress ||
      isAssignedToDriver ||
      isOutForPickup ||
      isOutForDelivery ||
      isDelivered,
  );

  return (
    <Card elevated style={styles.card}>
      {/* Top Header: Invoice ID only & Status Badge */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.invoiceNoRow}>
            <Text style={styles.invoiceNo}>#{delivery.invoice?.invoiceNo || 'N/A'}</Text>
            <Text style={styles.dateText}>{formatDate(delivery.createdAt)}</Text>
          </View>
          <Text style={styles.partyName} numberOfLines={1}>
            {delivery.invoice?.party?.name || 'Walk-in Customer'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity
            style={styles.challanIconBtn}
            onPress={() =>
              downloadAndSharePdf(
                `delivery/${delivery.id}/challan-pdf`,
                `Challan_${delivery.invoice?.invoiceNo || delivery.id}`,
              )
            }
            activeOpacity={0.7}
          >
            <Ionicons name="document-text-outline" size={12} color="#38BDF8" />
            <Text style={styles.challanIconText}>Challan</Text>
          </TouchableOpacity>
          <StatusBadge status={delivery.status} size="sm" />
        </View>
      </View>

      {/* Destination & Phone */}
      <View style={styles.destinationRow}>
        {partyPhone ? (
          <TouchableOpacity
            style={styles.phoneChip}
            onPress={() => handleCall(partyPhone)}
            activeOpacity={0.7}
          >
            <Ionicons name="call" size={11} color="#38BDF8" />
            <Text style={styles.phoneChipText}>{partyPhone}</Text>
          </TouchableOpacity>
        ) : null}

        {partyAddress ? (
          <TouchableOpacity
            style={styles.addressChip}
            onPress={() => handleMap(partyAddress)}
            activeOpacity={0.7}
          >
            <Ionicons name="location" size={11} color="#F59E0B" />
            <Text style={styles.addressChipText} numberOfLines={1}>
              {partyAddress}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.pickupPill}>
            <Ionicons name="storefront-outline" size={11} color={Colors.dark.textSecondary} />
            <Text style={styles.pickupPillText}>Counter Pickup</Text>
          </View>
        )}
      </View>

      {/* Driver & Cash Custody Row */}
      <View style={styles.driverCashRow}>
        <View style={styles.driverTag}>
          <Ionicons
            name={delivery.driver ? 'person' : 'person-outline'}
            size={12}
            color={delivery.driver ? '#10B981' : Colors.dark.textSecondary}
          />
          <Text style={styles.driverText} numberOfLines={1}>
            {delivery.driver?.name ? delivery.driver.name : 'Unassigned Driver'}
          </Text>
          {delivery.driver?.phone ? (
            <TouchableOpacity onPress={() => handleCall(delivery.driver?.phone)}>
              <Ionicons name="call-outline" size={11} color="#38BDF8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Amount / Collection Tag - Masked for supervisor */}
        {!isSupervisor ? (
          cashCollectedNum > 0 ? (
            delivery.cashHandedOver ? (
              <View style={styles.settledBadge}>
                <Ionicons name="checkmark-circle" size={11} color="#10B981" />
                <Text style={styles.settledBadgeText}>
                  Received {formatINR(delivery.cashCollected)}
                </Text>
              </View>
            ) : (
              <View style={styles.inDriverHandBadge}>
                <Ionicons name="wallet" size={11} color="#F59E0B" />
                <Text style={styles.inDriverHandText}>
                  {formatINR(delivery.cashCollected)} with Driver
                </Text>
              </View>
            )
          ) : Number(delivery.amountToCollect || 0) > 0 ? (
            <View style={styles.toCollectBadge}>
              <Ionicons name="cash-outline" size={11} color="#F59E0B" />
              <Text style={styles.toCollectText}>
                Collect {formatINR(delivery.amountToCollect)}
              </Text>
            </View>
          ) : (
            <View style={styles.prepaidBadge}>
              <Text style={styles.prepaidText}>Prepaid / ₹0</Text>
            </View>
          )
        ) : (
          <View style={styles.prepaidBadge}>
            <Text style={styles.prepaidText}>{totalCount} Items</Text>
          </View>
        )}
      </View>

      {/* Warehouse Items Pickup Progress Bar */}
      {totalCount > 0 ? (
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Warehouse Pickups</Text>
            <Text style={styles.progressCount}>
              {pickedCount} / {totalCount} items picked
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${(pickedCount / totalCount) * 100}%` },
                pickedCount === totalCount && styles.progressFillComplete,
              ]}
            />
          </View>
        </View>
      ) : null}

      {/* Supervisor In-Line Warehouse Pickup Quick Actions */}
      {isSupervisor && (isAssignedToDriver || isOutForPickup) && userWarehouseId ? (
        <View style={styles.supervisorItemsBox}>
          <Text style={styles.supervisorBoxTitle}>Warehouse Items Verification</Text>
          {(delivery.items || [])
            .map((it, idx) => ({ it, idx }))
            .filter(({ it }) => it.warehouseId === userWarehouseId)
            .map(({ it, idx }) => (
              <View key={it.invoiceItemId || idx} style={styles.supervisorItemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.supervisorItemName}>{it.productName}</Text>
                  <Text style={styles.supervisorItemSub}>
                    {it.qty} {it.unit} {it.batchNo ? `• Lot: ${it.batchNo}` : ''}
                  </Text>
                </View>
                {it.pickedUp ? (
                  <View style={styles.supervisorPickedPill}>
                    <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                    <Text style={styles.supervisorPickedText}>
                      {it.pickedUpByName ? `Picked (${it.pickedUpByName})` : 'Picked'}
                    </Text>
                  </View>
                ) : (
                  <Button
                    title="Confirm Pick"
                    size="sm"
                    variant="primary"
                    onPress={() => onSupervisorConfirmPick && onSupervisorConfirmPick(delivery.id, idx)}
                  />
                )}
              </View>
            ))}
        </View>
      ) : null}

      {/* Handover Notice / Verification for Owner: shown strictly if cashCollected > 0 & !cashHandedOver and NOT supervisor */}
      {!isSupervisor && cashCollectedNum > 0 && !delivery.cashHandedOver ? (
        <View style={styles.handoverBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.handoverBannerTitle} numberOfLines={1}>
              Cash in Driver Hand: {formatINR(delivery.cashCollected)}
            </Text>
            <Text style={styles.handoverBannerSub} numberOfLines={1}>
              Collected from customer. Awaiting deposit into office register.
            </Text>
          </View>
          {isOwnerOrAdmin ? (
            <Button
              title={handoverInProgress === delivery.id ? 'Verifying...' : 'Verify'}
              size="sm"
              variant="primary"
              loading={handoverInProgress === delivery.id}
              onPress={() => onHandoverCash(delivery.id)}
              style={styles.verifyBtn}
            />
          ) : null}
        </View>
      ) : null}

      {/* Divider & Action Buttons */}
      {hasCustomerOrRunActions ? (
        <>
          <View style={styles.divider} />

          <View style={styles.cardActions}>
            {/* Customer Actions */}
            {partyPhone ? (
              <Button
                title="Call"
                icon="call"
                size="sm"
                variant="secondary"
                onPress={() => handleCall(partyPhone)}
                style={styles.actionBtn}
              />
            ) : null}

            {partyAddress ? (
              <Button
                title="Maps"
                icon="navigate"
                size="sm"
                variant="secondary"
                onPress={() => handleMap(partyAddress)}
                style={styles.actionBtn}
              />
            ) : null}

            {/* Reshare Manifest to Driver on WhatsApp */}
            {(isAssignedToDriver || isOutForPickup || isOutForDelivery) ? (
              <Button
                title="Manifest"
                icon="logo-whatsapp"
                size="sm"
                variant="secondary"
                onPress={handleShareManifest}
                style={[styles.actionBtn, styles.waManifestBtn]}
                textStyle={{ color: '#10B981' }}
              />
            ) : null}

            {/* Run Details: strictly shown when the order is delivered */}
            {isDelivered ? (
              <Button
                title="Run Details"
                icon="document-text-outline"
                size="sm"
                variant="outline"
                onPress={() => onOpenRunDetails(delivery)}
                style={[styles.actionBtn, { flex: 1.15 }]}
              />
            ) : null}
          </View>
        </>
      ) : null}

      {/* Owner: Push Dispatch & Counter Pickup Buttons */}
      {isOwnerOrAdmin && isPendingPush ? (
        <View style={styles.ownerActionsRow}>
          <Button
            title="Dispatch Order"
            icon="paper-plane-outline"
            variant="primary"
            size="sm"
            onPress={() => onOpenPushModal(delivery)}
            style={{ flex: 1.2, height: 38, borderRadius: 10 }}
          />
          {!isDriverAssigned ? (
            <Button
              title="Counter Pickup"
              icon="bag-check-outline"
              variant="outline"
              size="sm"
              onPress={() => onCustomerPickedUp(delivery.id)}
              style={{ flex: 1, height: 38, borderRadius: 10 }}
            />
          ) : null}
        </View>
      ) : null}

      {/* Driver Actions */}
      {isDriver && isAssignedToDriver ? (
        <Button
          title="Accept: Out for Pickup"
          icon="cube-outline"
          variant="primary"
          size="sm"
          onPress={() => onUpdateStatus(delivery.id, 'OUT_FOR_PICKUP')}
          style={{ marginTop: 8, height: 40, borderRadius: 10 }}
        />
      ) : null}

      {isDriver && (isOutForDelivery || delivery.status === 'PICKED_UP') ? (
        Number(delivery.amountToCollect || 0) > 0 ? (
          <Button
            title="Mark Delivered & Collect Cash"
            icon="checkmark-circle-outline"
            variant="primary"
            size="sm"
            onPress={() => onOpenCollectCash(delivery)}
            style={{ marginTop: 8, height: 40, borderRadius: 10 }}
          />
        ) : (
          <Button
            title="Mark as Delivered"
            icon="checkmark-circle-outline"
            variant="primary"
            size="sm"
            onPress={() => onUpdateStatus(delivery.id, 'DELIVERED')}
            style={{ marginTop: 8, height: 40, borderRadius: 10 }}
          />
        )
      ) : null}
    </Card>
  );
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  invoiceNoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  invoiceNo: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  dateText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
  },
  partyName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.text,
    marginTop: 2,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  phoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  phoneChipText: {
    fontSize: 11,
    color: '#38BDF8',
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  addressChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.dark.cardElevated,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  addressChipText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
  },
  pickupPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.dark.cardElevated,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  pickupPillText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  driverCashRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  driverTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  driverText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  settledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 6,
    paddingVertical: 2.5,
    paddingHorizontal: 7,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  settledBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
    fontFamily: 'monospace',
  },
  inDriverHandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 6,
    paddingVertical: 2.5,
    paddingHorizontal: 7,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  inDriverHandText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
    fontFamily: 'monospace',
  },
  toCollectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 6,
    paddingVertical: 2.5,
    paddingHorizontal: 7,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  toCollectText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
    fontFamily: 'monospace',
  },
  prepaidBadge: {
    backgroundColor: Colors.dark.cardElevated,
    borderRadius: 6,
    paddingVertical: 2.5,
    paddingHorizontal: 7,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  prepaidText: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  progressContainer: {
    marginTop: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  progressCount: {
    fontSize: 11,
    color: '#A855F7',
    fontWeight: '700',
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#A855F7',
    borderRadius: 3,
  },
  progressFillComplete: {
    backgroundColor: '#10B981',
  },
  handoverBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    padding: 8,
    marginTop: 10,
  },
  handoverBannerTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#F59E0B',
  },
  handoverBannerSub: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
    marginTop: 1,
  },
  verifyBtn: {
    minWidth: 74,
    height: 32,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 10,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    paddingHorizontal: 6,
  },
  waManifestBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  ownerActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  challanIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  challanIconText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#38BDF8',
  },
  supervisorItemsBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(168, 85, 247, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    gap: 8,
  },
  supervisorBoxTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#C084FC',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  supervisorItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  supervisorItemName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  supervisorItemSub: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
    marginTop: 1,
  },
  supervisorPickedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  supervisorPickedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
  },
});
