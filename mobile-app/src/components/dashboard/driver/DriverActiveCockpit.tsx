import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatINR } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';

interface DriverActiveCockpitProps {
  activeDelivery: any;
  allPickedUp: boolean;
  pickedCount: number;
  totalItemsCount: number;
  statusUpdating: boolean;
  onStatusChange: (deliveryId: string, status: string) => void;
  onOpenCollectCash: (delivery: any) => void;
  onCall: (phone?: string) => void;
  onWhatsApp: (phone?: string, name?: string, invoiceNo?: string) => void;
  onMap: (address?: string) => void;
}

export function DriverActiveCockpit({
  activeDelivery,
  allPickedUp,
  pickedCount,
  totalItemsCount,
  statusUpdating,
  onStatusChange,
  onOpenCollectCash,
  onCall,
  onWhatsApp,
  onMap,
}: DriverActiveCockpitProps) {
  if (!activeDelivery) return null;

  return (
    <View style={styles.container}>
      {/* Mission Header Card */}
      <View style={styles.missionCard}>
        <View style={styles.titleRow}>
          <View
            style={[
              styles.missionBadge,
              activeDelivery.status === 'OUT_FOR_PICKUP'
                ? styles.badgePurple
                : activeDelivery.status === 'DELIVERED'
                ? styles.badgeGreen
                : styles.badgeWhite,
            ]}
          >
            <Ionicons
              name={
                activeDelivery.status === 'OUT_FOR_PICKUP'
                  ? 'cube'
                  : activeDelivery.status === 'DELIVERED'
                  ? 'checkmark-circle'
                  : 'bicycle'
              }
              size={13}
              color={
                activeDelivery.status === 'OUT_FOR_PICKUP'
                  ? '#C084FC'
                  : activeDelivery.status === 'DELIVERED'
                  ? '#10B981'
                  : '#09090B'
              }
            />
            <Text
              style={[
                styles.badgeText,
                activeDelivery.status === 'OUT_FOR_PICKUP'
                  ? { color: '#C084FC' }
                  : activeDelivery.status === 'DELIVERED'
                  ? { color: '#10B981' }
                  : { color: '#09090B' },
              ]}
            >
              {activeDelivery.status === 'OUT_FOR_PICKUP'
                ? 'TASK 1: WAREHOUSE PICKUP'
                : activeDelivery.status === 'DELIVERED'
                ? 'ORDER DELIVERED'
                : activeDelivery.status === 'ASSIGNED'
                ? 'NEW ASSIGNMENT'
                : 'TASK 2: OUT FOR DELIVERY'}
            </Text>
          </View>
          <Text style={styles.invoiceTag}>#{activeDelivery.invoice?.invoiceNo}</Text>
        </View>

        {/* Stage Progression Action Button */}
        <View style={{ marginTop: 12 }}>
          {activeDelivery.status === 'ASSIGNED' ? (
            <Button
              title="Accept & Start Pickup"
              variant="primary"
              size="md"
              loading={statusUpdating}
              onPress={() => onStatusChange(activeDelivery.id, 'OUT_FOR_PICKUP')}
            />
          ) : activeDelivery.status === 'OUT_FOR_PICKUP' ? (
            allPickedUp ? (
              <Button
                title="All Items Picked Up → Out for Delivery"
                variant="primary"
                size="md"
                loading={statusUpdating}
                onPress={() => onStatusChange(activeDelivery.id, 'OUT_FOR_DELIVERY')}
              />
            ) : (
              <View style={styles.lockedNotice}>
                <Ionicons name="time-outline" size={15} color="#F59E0B" />
                <Text style={styles.lockedText}>
                  Pick all items to unlock &quot;Out for Delivery&quot; ({pickedCount}/{totalItemsCount})
                </Text>
              </View>
            )
          ) : activeDelivery.status === 'OUT_FOR_DELIVERY' ? (
            Number(activeDelivery.amountToCollect || 0) > 0 ? (
              <Button
                title={`Mark Delivered & Collect Cash (${formatINR(activeDelivery.amountToCollect)})`}
                variant="primary"
                size="md"
                onPress={() => onOpenCollectCash(activeDelivery)}
              />
            ) : (
              <Button
                title="Mark as Delivered"
                variant="primary"
                size="md"
                loading={statusUpdating}
                onPress={() => onStatusChange(activeDelivery.id, 'DELIVERED')}
              />
            )
          ) : activeDelivery.status === 'DELIVERED' &&
            Number(activeDelivery.amountToCollect || 0) > 0 &&
            Number(activeDelivery.cashCollected || 0) === 0 ? (
            <Button
              title={`Collect Cash (${formatINR(activeDelivery.amountToCollect)})`}
              variant="primary"
              size="md"
              onPress={() => onOpenCollectCash(activeDelivery)}
            />
          ) : (
            <View style={styles.deliveredNotice}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.deliveredText}>Delivered & Fully Settled</Text>
            </View>
          )}
        </View>
      </View>

      {/* Customer & Destination Details Card */}
      <Card style={styles.customerCard}>
        <View style={styles.customerHeader}>
          <Ionicons name="location-outline" size={15} color="#38BDF8" />
          <Text style={styles.customerHeaderTitle}>Customer & Destination</Text>
        </View>
        <Text style={styles.customerName}>{activeDelivery.invoice?.party?.name}</Text>
        <Text style={styles.customerAddress}>
          {activeDelivery.invoice?.party?.address || 'Counter Pickup / Local'}
        </Text>
        <Text style={styles.customerPhone}>
          📞 {activeDelivery.invoice?.party?.phone}
        </Text>

        {/* Action Buttons Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onCall(activeDelivery.invoice?.party?.phone)}
          >
            <Ionicons name="call" size={13} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: 'rgba(16, 185, 129, 0.4)' }]}
            onPress={() =>
              onWhatsApp(
                activeDelivery.invoice?.party?.phone,
                activeDelivery.invoice?.party?.name,
                activeDelivery.invoice?.invoiceNo,
              )
            }
          >
            <Ionicons name="logo-whatsapp" size={13} color="#10B981" />
            <Text style={[styles.actionBtnText, { color: '#10B981' }]}>WhatsApp</Text>
          </TouchableOpacity>

          {activeDelivery.invoice?.party?.address ? (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => onMap(activeDelivery.invoice?.party?.address)}
            >
              <Ionicons name="navigate" size={13} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Map</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </Card>

      {/* Cash Collection Banner */}
      <View
        style={[
          styles.cashBanner,
          Number(activeDelivery.amountToCollect || 0) > 0
            ? styles.bannerAmber
            : styles.bannerGreen,
        ]}
      >
        <Ionicons
          name={
            Number(activeDelivery.amountToCollect || 0) > 0
              ? 'warning-outline'
              : 'checkmark-circle-outline'
          }
          size={18}
          color={
            Number(activeDelivery.amountToCollect || 0) > 0 ? '#F59E0B' : '#10B981'
          }
        />
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.cashBannerTitle,
              Number(activeDelivery.amountToCollect || 0) > 0
                ? { color: '#FCD34D' }
                : { color: '#10B981' },
            ]}
          >
            {Number(activeDelivery.amountToCollect || 0) > 0
              ? `Collect Cash: ${formatINR(activeDelivery.amountToCollect)}`
              : 'Prepaid Order — Collect ₹0'}
          </Text>
          <Text style={styles.cashBannerSub}>
            {Number(activeDelivery.amountToCollect || 0) > 0
              ? 'Collect this cash at delivery and carry in custody.'
              : 'This order has already been paid at the counter.'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  missionCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#16161A',
    borderWidth: 1,
    borderColor: Colors.dark.borderMedium,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  missionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgePurple: {
    backgroundColor: 'rgba(168, 85, 247, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
  },
  badgeGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  badgeWhite: {
    backgroundColor: '#FFFFFF',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  invoiceTag: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.dark.textSecondary,
    fontFamily: 'monospace',
  },
  lockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  lockedText: {
    fontSize: 11,
    color: '#FCD34D',
    fontWeight: '600',
    flex: 1,
  },
  deliveredNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  deliveredText: {
    fontSize: 11.5,
    color: '#10B981',
    fontWeight: '700',
  },
  customerCard: {
    padding: 15,
    borderRadius: 16,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  customerHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
    textTransform: 'uppercase',
  },
  customerName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  customerAddress: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  customerPhone: {
    fontSize: 11.5,
    color: Colors.dark.textTertiary,
    marginTop: 3,
    fontFamily: 'monospace',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Colors.dark.cardElevated,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cashBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  bannerAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  bannerGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  cashBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  cashBannerSub: {
    fontSize: 10.5,
    color: Colors.dark.textSecondary,
    marginTop: 1,
  },
});
