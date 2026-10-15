import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Colors } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatINR } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';

interface DriverDashboardViewProps {
  user: any;
  refreshing: boolean;
  onRefresh: () => void;
  driverDeliveries: any[];
  router: any;
  handleCall: (phone?: string) => void;
  handleMap: (address?: string) => void;
}

export function DriverDashboardView({
  user,
  refreshing,
  onRefresh,
  driverDeliveries,
  router,
  handleCall,
  handleMap,
}: DriverDashboardViewProps) {
  const activeDelivery = driverDeliveries.find(
    (d) =>
      d.status === 'ASSIGNED' ||
      d.status === 'OUT_FOR_PICKUP' ||
      d.status === 'PICKED_UP' ||
      d.status === 'OUT_FOR_DELIVERY',
  );

  const unhandedCash = driverDeliveries
    .filter((d) => d.cashCollected && !d.cashHandedOver)
    .reduce((sum, d) => sum + Number(d.cashCollected || 0), 0);

  return (
    <View style={styles.screen}>
      <Header title="Driver Portal" subtitle={`Driver: ${user?.name || 'Staff'}`} />
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
        }
      >
        {/* Physical Cash in Custody Hero Card */}
        <Card elevated style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroLabel}>Physical Cash in Hand</Text>
              <Text style={styles.heroValue}>{formatINR(unhandedCash)}</Text>
              <Text style={styles.heroSub}>
                {unhandedCash > 0
                  ? 'Hand over this cash to Owner/Admin when returning to office'
                  : 'All collected cash has been handed over to office'}
              </Text>
            </View>
            <View style={styles.heroIconBox}>
              <Ionicons name="wallet-outline" size={28} color="#FFFFFF" />
            </View>
          </View>
        </Card>

        {/* Active Assigned Delivery */}
        <Text style={styles.sectionTitle}>Active Assigned Run</Text>
        {activeDelivery ? (
          <Card elevated style={styles.activeRunCard}>
            <View style={styles.runHeader}>
              <View>
                <Text style={styles.runInvoiceNo}>
                  Invoice #{activeDelivery.invoice?.invoiceNo}
                </Text>
                <Text style={styles.runPartyName}>
                  {activeDelivery.invoice?.party?.name}
                </Text>
              </View>
              <StatusBadge status={activeDelivery.status} />
            </View>

            {/* Amount to collect badge */}
            {Number(activeDelivery.amountToCollect || 0) > 0 ? (
              <View style={styles.amountCollectBox}>
                <Text style={styles.amountCollectLabel}>Amount to Collect from Party:</Text>
                <Text style={styles.amountCollectValue}>
                  {formatINR(activeDelivery.amountToCollect)}
                </Text>
              </View>
            ) : null}

            {/* Address & Quick Actions */}
            {activeDelivery.invoice?.party?.address ? (
              <View style={styles.addressRow}>
                <Ionicons name="location-outline" size={16} color={Colors.dark.textSecondary} />
                <Text style={styles.addressText} numberOfLines={2}>
                  {activeDelivery.invoice?.party?.address}
                </Text>
              </View>
            ) : null}

            <View style={styles.runActionsRow}>
              <Button
                title="Call Customer"
                icon="call"
                variant="secondary"
                size="sm"
                onPress={() => handleCall(activeDelivery.invoice?.party?.phone)}
                style={{ flex: 1 }}
              />
              {activeDelivery.invoice?.party?.address ? (
                <Button
                  title="Navigate"
                  icon="navigate"
                  variant="secondary"
                  size="sm"
                  onPress={() => handleMap(activeDelivery.invoice?.party?.address)}
                  style={{ flex: 1 }}
                />
              ) : null}
            </View>

            <Button
              title="Open Run Details & Pickups"
              variant="primary"
              size="md"
              onPress={() => router.push('/(tabs)/deliveries')}
              style={{ marginTop: 10 }}
            />
          </Card>
        ) : (
          <Card style={styles.emptyCard}>
            <Ionicons name="checkmark-done-circle-outline" size={36} color="#10B981" />
            <Text style={styles.emptyTitle}>No Pending Runs</Text>
            <Text style={styles.emptySub}>
              You currently have no active deliveries assigned. Refresh or check back when the owner dispatches new orders.
            </Text>
          </Card>
        )}

        {/* Quick Shortcuts */}
        <Text style={styles.sectionTitle}>Quick Tools</Text>
        <View style={styles.shortcutsGrid}>
          <TouchableOpacity
            style={styles.shortcutCard}
            onPress={() => router.push('/(tabs)/deliveries')}
            activeOpacity={0.75}
          >
            <Ionicons name="bicycle-outline" size={22} color="#FFFFFF" />
            <Text style={styles.shortcutText}>All Deliveries</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shortcutCard}
            onPress={() => router.push('/(tabs)/stock')}
            activeOpacity={0.75}
          >
            <Ionicons name="cube-outline" size={22} color="#FFFFFF" />
            <Text style={styles.shortcutText}>Live Stock</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 18,
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  heroCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#16161A',
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    marginVertical: 4,
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    maxWidth: 240,
    lineHeight: 16,
  },
  heroIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.dark.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.borderMedium,
  },
  activeRunCard: {
    padding: 16,
    borderRadius: 16,
  },
  runHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  runInvoiceNo: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  runPartyName: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  amountCollectBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountCollectLabel: {
    fontSize: 12,
    color: '#FCD34D',
    fontWeight: '600',
  },
  amountCollectValue: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  addressText: {
    fontSize: 12.5,
    color: Colors.dark.textSecondary,
    flex: 1,
  },
  runActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 10,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
  },
  shortcutsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  shortcutCard: {
    flex: 1,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  shortcutText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
