import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { formatINR } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';

interface DriverTopStatusCardsProps {
  activeDelivery: any | null;
  pickedCount: number;
  totalItemsCount: number;
  allPickedUp: boolean;
  totalCashInCustody: number;
}

export function DriverTopStatusCards({
  activeDelivery,
  pickedCount,
  totalItemsCount,
  allPickedUp,
  totalCashInCustody,
}: DriverTopStatusCardsProps) {
  return (
    <View style={styles.container}>
      {/* Card 1: Pickup in Current Delivery */}
      <Card elevated style={styles.card}>
        <View style={styles.header}>
          <View style={styles.labelRow}>
            <Ionicons name="cube-outline" size={15} color="#FFFFFF" />
            <Text style={styles.label}>Pickup in Current Delivery</Text>
          </View>
          {activeDelivery && (
            <View
              style={[
                styles.badge,
                allPickedUp ? styles.badgeGreen : styles.badgeWhite,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  allPickedUp ? styles.badgeTextGreen : styles.badgeTextWhite,
                ]}
              >
                {pickedCount}/{totalItemsCount} Picked
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.title}>
          {activeDelivery
            ? activeDelivery.status === 'OUT_FOR_PICKUP'
              ? `Item Pickup (${pickedCount}/${totalItemsCount})`
              : activeDelivery.status === 'OUT_FOR_DELIVERY'
              ? 'Out for Delivery (Loaded)'
              : activeDelivery.status === 'DELIVERED'
              ? 'Delivered • Ready for Cash'
              : 'Assigned • Ready for Pickup'
            : 'Standby / Ready'}
        </Text>

        <Text style={styles.sub} numberOfLines={1}>
          {activeDelivery
            ? `Invoice #${activeDelivery.invoice?.invoiceNo} • ${activeDelivery.invoice?.party?.name}`
            : 'Waiting for dispatch assignment'}
        </Text>

        <View style={styles.footer}>
          <Text style={styles.footerLabel}>Cash to collect from customer:</Text>
          <Text
            style={[
              styles.footerVal,
              activeDelivery && Number(activeDelivery.amountToCollect || 0) > 0
                ? { color: '#F59E0B' }
                : { color: '#10B981' },
            ]}
          >
            {activeDelivery && Number(activeDelivery.amountToCollect || 0) > 0
              ? formatINR(activeDelivery.amountToCollect)
              : '₹0 (Prepaid)'}
          </Text>
        </View>
      </Card>

      {/* Card 2: Cash to Hand Over to Owner */}
      <Card elevated style={[styles.card, styles.cashCard]}>
        <View style={styles.header}>
          <View style={styles.labelRow}>
            <Ionicons name="wallet-outline" size={15} color="#10B981" />
            <Text style={[styles.label, { color: '#10B981' }]}>Cash to Hand Over</Text>
          </View>
          <View
            style={[
              styles.badge,
              totalCashInCustody > 0 ? styles.badgeAmber : styles.badgeGreen,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                totalCashInCustody > 0 ? styles.badgeTextAmber : styles.badgeTextGreen,
              ]}
            >
              {totalCashInCustody > 0 ? 'Pending Office Handover' : 'All Settled'}
            </Text>
          </View>
        </View>

        <Text style={[styles.title, { color: '#10B981', fontSize: 24 }]}>
          {formatINR(totalCashInCustody)}
        </Text>

        <Text style={styles.sub}>
          {totalCashInCustody > 0
            ? 'Physical cash in hand to be handed over to owner.'
            : 'All cash collections granted & settled with owner.'}
        </Text>

        <View style={[styles.footer, { borderTopColor: 'rgba(16, 185, 129, 0.2)' }]}>
          <Text style={styles.footerLabel}>Status with Owner:</Text>
          <Text style={[styles.footerVal, { color: '#10B981' }]}>
            {totalCashInCustody > 0
              ? `${formatINR(totalCashInCustody)} pending`
              : 'Up to date with office'}
          </Text>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    marginBottom: 12,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#16161A',
    borderWidth: 1,
    borderColor: Colors.dark.borderMedium,
  },
  cashCard: {
    borderColor: 'rgba(16, 185, 129, 0.25)',
    backgroundColor: 'rgba(16, 185, 129, 0.04)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 11.5,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  footerLabel: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
  },
  footerVal: {
    fontSize: 12,
    fontWeight: '800',
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  badgeGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  badgeAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  badgeWhite: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  badgeTextGreen: {
    color: '#10B981',
  },
  badgeTextAmber: {
    color: '#F59E0B',
  },
  badgeTextWhite: {
    color: '#FFFFFF',
  },
});
