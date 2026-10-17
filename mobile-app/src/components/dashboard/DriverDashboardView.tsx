import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { Colors } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { cleanPhoneNumber } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';
import { mobileApiRequest } from '@/lib/api';
import { CollectCashModal } from '@/components/deliveries/CollectCashModal';

// Driver Modular Components
import { DriverTopStatusCards } from './driver/DriverTopStatusCards';
import { DriverActiveCockpit } from './driver/DriverActiveCockpit';
import { WarehousePickupChecklist } from './driver/WarehousePickupChecklist';
import { QueuedAssignmentsList } from './driver/QueuedAssignmentsList';

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
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [collectCashDelivery, setCollectCashDelivery] = useState<any | null>(null);

  // Active delivery: Currently in pickup, out for delivery, or awaiting cash collection
  const activeDelivery = useMemo(() => {
    return (
      driverDeliveries.find(
        (d) =>
          d.status === 'OUT_FOR_PICKUP' ||
          d.status === 'OUT_FOR_DELIVERY' ||
          d.status === 'PICKED_UP' ||
          (d.status === 'DELIVERED' &&
            Number(d.amountToCollect || 0) > 0 &&
            Number(d.cashCollected || 0) === 0),
      ) ||
      driverDeliveries.find((d) => d.status === 'ASSIGNED')
    );
  }, [driverDeliveries]);

  // Other assigned deliveries waiting in queue
  const pendingAssigned = useMemo(() => {
    return driverDeliveries.filter(
      (d) => d.status === 'ASSIGNED' && d.id !== activeDelivery?.id,
    );
  }, [driverDeliveries, activeDelivery]);

  // Physical cash in hand awaiting office handover
  const totalCashInCustody = useMemo(() => {
    return driverDeliveries
      .filter((d) => d.cashCollected && !d.cashHandedOver)
      .reduce((sum, d) => sum + Number(d.cashCollected || 0), 0);
  }, [driverDeliveries]);

  const allItemsList = useMemo(() => {
    if (!activeDelivery) return [];
    if (activeDelivery.items && activeDelivery.items.length > 0) {
      return activeDelivery.items;
    }
    return (activeDelivery.invoice?.items || []).map((it: any) => ({
      productId: it.productId,
      productName: it.product?.name || 'Product',
      unit: it.product?.unit || 'unit',
      warehouseName: it.warehouse?.name || 'Main Warehouse',
      warehouseAddress: it.warehouse?.address || '',
      batchNo: it.batchNo,
      qty: it.qty,
      pickedUp: false,
    }));
  }, [activeDelivery]);

  const pickedCount = allItemsList.filter((i: any) => i.pickedUp).length;
  const totalItemsCount = allItemsList.length;
  const allPickedUp = totalItemsCount > 0 && pickedCount === totalItemsCount;

  // Change delivery status
  const handleStatusChange = async (deliveryId: string, newStatus: string) => {
    setStatusUpdating(true);
    try {
      const updated = await mobileApiRequest(`/delivery/${deliveryId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      onRefresh();

      if (newStatus === 'DELIVERED') {
        const target = driverDeliveries.find((d) => d.id === deliveryId) || updated;
        if (Number(target.amountToCollect || 0) > 0) {
          setCollectCashDelivery(target);
        }
      }
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Failed to update delivery status');
    } finally {
      setStatusUpdating(false);
    }
  };

  // WhatsApp customer
  const handleWhatsApp = (phone?: string, partyName?: string, invoiceNo?: string) => {
    const clean = cleanPhoneNumber(phone);
    if (clean) {
      const msg = `Hello ${partyName || 'Customer'}, I am your delivery driver for Invoice #${invoiceNo || ''}. I am on my way to deliver your items.`;
      Linking.openURL(`https://wa.me/91${clean}?text=${encodeURIComponent(msg)}`).catch(() => {
        Alert.alert('Error', 'Unable to open WhatsApp');
      });
    }
  };

  return (
    <View style={styles.screen}>
      <Header
        title="Driver Operations"
        subtitle={`Driver: ${user?.name || 'Staff'}`}
        rightAction={{
          icon: 'refresh-outline',
          onPress: () => onRefresh(),
        }}
      />
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
        }
      >
        {/* 1. Top Status Cards (Pickup progress & Cash custody) */}
        <DriverTopStatusCards
          activeDelivery={activeDelivery}
          pickedCount={pickedCount}
          totalItemsCount={totalItemsCount}
          allPickedUp={allPickedUp}
          totalCashInCustody={totalCashInCustody}
        />

        {/* 2. Active Mission Cockpit */}
        {activeDelivery ? (
          <>
            <DriverActiveCockpit
              activeDelivery={activeDelivery}
              allPickedUp={allPickedUp}
              pickedCount={pickedCount}
              totalItemsCount={totalItemsCount}
              statusUpdating={statusUpdating}
              onStatusChange={handleStatusChange}
              onOpenCollectCash={(delivery) => setCollectCashDelivery(delivery)}
              onCall={handleCall}
              onWhatsApp={handleWhatsApp}
              onMap={handleMap}
            />

            {/* 3. Interactive Pickup Checklist & Supervisor Card */}
            <WarehousePickupChecklist
              items={allItemsList.map((item: any, idx: number) => ({ item, originalIndex: idx }))}
              supervisors={activeDelivery.supervisors}
              pickedCount={pickedCount}
              totalItemsCount={totalItemsCount}
            />
          </>
        ) : (
          <Card style={styles.emptyCard}>
            <Ionicons name="checkmark-done-circle-outline" size={40} color="#10B981" />
            <Text style={styles.emptyTitle}>No Active Runs</Text>
            <Text style={styles.emptySub}>
              You currently have no active deliveries. When the store director dispatches new orders, they will appear here.
            </Text>
          </Card>
        )}

        {/* 4. Queued Delivery Assignments */}
        <QueuedAssignmentsList
          pendingAssigned={pendingAssigned}
          onStartPickup={(deliveryId) => handleStatusChange(deliveryId, 'OUT_FOR_PICKUP')}
        />

        {/* 5. Driver Quick Tools */}
        <Text style={styles.sectionTitle}>Driver Tools</Text>
        <View style={styles.shortcutsGrid}>
          <TouchableOpacity
            style={styles.shortcutCard}
            onPress={() => router.push('/(tabs)/deliveries')}
            activeOpacity={0.75}
          >
            <Ionicons name="bicycle-outline" size={20} color="#FFFFFF" />
            <Text style={styles.shortcutText}>Deliveries Panel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shortcutCard}
            onPress={() => router.push('/(tabs)/stock')}
            activeOpacity={0.75}
          >
            <Ionicons name="cube-outline" size={20} color="#FFFFFF" />
            <Text style={styles.shortcutText}>Live Stock Catalog</Text>
          </TouchableOpacity>
        </View>

        {/* 6. Collect Cash Bottom Sheet Modal */}
        {collectCashDelivery && (
          <CollectCashModal
            delivery={collectCashDelivery}
            visible={Boolean(collectCashDelivery)}
            onClose={() => setCollectCashDelivery(null)}
            onSuccess={() => {
              setCollectCashDelivery(null);
              onRefresh();
            }}
          />
        )}
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
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 18,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  shortcutsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  shortcutCard: {
    flex: 1,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  shortcutText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyCard: {
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 10,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
});
