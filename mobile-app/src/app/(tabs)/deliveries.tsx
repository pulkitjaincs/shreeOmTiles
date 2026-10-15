import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { mobileApiRequest, cachedMobileApiRequest } from '@/lib/api';
import { Colors } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { SearchBar } from '@/components/ui/SearchBar';
import { EmptyState } from '@/components/ui/EmptyState';

import {
  Delivery,
  DriverUser,
  FilterTab,
  DeliveryCounts,
  PushSuccessDialogData,
  DeliveryCard,
  DeliveryFilterTabs,
  PushDeliveryModal,
  PushSuccessModal,
  DeliveryRunModal,
  CollectCashModal,
  AddTripModal,
} from '@/components/deliveries';

export default function DeliveriesScreen() {
  const { user } = useAuth();
  const role = user?.role || 'DRIVER';

  const isDriver = role === 'DRIVER';
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [drivers, setDrivers] = useState<DriverUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('ALL');

  // Modals state
  const [activeDeliveryModal, setActiveDeliveryModal] = useState<Delivery | null>(null);
  const [pushModalDelivery, setPushModalDelivery] = useState<Delivery | null>(null);
  const [pushSuccessData, setPushSuccessData] = useState<PushSuccessDialogData | null>(null);
  const [collectCashDelivery, setCollectCashDelivery] = useState<Delivery | null>(null);
  const [addTripDelivery, setAddTripDelivery] = useState<Delivery | null>(null);

  // Handover state
  const [handoverInProgress, setHandoverInProgress] = useState<string | null>(null);

  const loadData = useCallback(async (force = false) => {
    try {
      const [delData, usersData] = await Promise.all([
        cachedMobileApiRequest<any[]>('/delivery', {
          forceRefresh: force,
          onRevalidate: (fresh) => {
            const list = Array.isArray(fresh) ? fresh : (fresh as any)?.data || [];
            setDeliveries(list);
          },
        }),
        isOwnerOrAdmin
          ? cachedMobileApiRequest<DriverUser[]>('/users?role=DRIVER', {
              forceRefresh: force,
              onRevalidate: (fresh) => setDrivers(fresh || []),
            }).catch(() => [])
          : Promise.resolve([]),
      ]);

      const list = Array.isArray(delData) ? delData : (delData as any)?.data || [];
      setDeliveries(list);
      setDrivers(usersData || []);
    } catch (err: any) {
      console.warn('Failed to load deliveries', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isOwnerOrAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  // Live filter counts matching web-dashboard
  const counts: DeliveryCounts = useMemo(() => {
    const total = deliveries.length;
    const pending = deliveries.filter(
      (d) => d.status === 'PENDING' || d.status === 'ASSIGNED',
    ).length;
    const outForPickup = deliveries.filter((d) => d.status === 'OUT_FOR_PICKUP').length;
    const outForDelivery = deliveries.filter(
      (d) => d.status === 'OUT_FOR_DELIVERY' || d.status === 'PICKED_UP',
    ).length;
    const delivered = deliveries.filter((d) => d.status === 'DELIVERED').length;
    const cancelled = deliveries.filter((d) => d.status === 'CANCELLED').length;
    return { total, pending, outForPickup, outForDelivery, delivered, cancelled };
  }, [deliveries]);

  // Filtered deliveries matching web-dashboard logic
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      if (activeFilter === 'PENDING') {
        if (d.status !== 'PENDING' && d.status !== 'ASSIGNED') return false;
      } else if (activeFilter === 'OUT_FOR_PICKUP') {
        if (d.status !== 'OUT_FOR_PICKUP') return false;
      } else if (activeFilter === 'OUT_FOR_DELIVERY') {
        if (d.status !== 'OUT_FOR_DELIVERY' && d.status !== 'PICKED_UP') return false;
      } else if (activeFilter === 'DELIVERED') {
        if (d.status !== 'DELIVERED') return false;
      } else if (activeFilter === 'CANCELLED') {
        if (d.status !== 'CANCELLED') return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const invNo = d.invoice?.invoiceNo?.toLowerCase() || '';
        const partyName = d.invoice?.party?.name?.toLowerCase() || '';
        const partyPhone = d.invoice?.party?.phone || '';
        const partyAddr = d.invoice?.party?.address?.toLowerCase() || '';
        const driverName = d.driver?.name?.toLowerCase() || '';
        return (
          invNo.includes(q) ||
          partyName.includes(q) ||
          partyPhone.includes(q) ||
          partyAddr.includes(q) ||
          driverName.includes(q)
        );
      }

      return true;
    });
  }, [deliveries, activeFilter, search]);

  // Update Status
  const handleUpdateStatus = async (deliveryId: string, status: string) => {
    try {
      await mobileApiRequest(`/delivery/${deliveryId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      Alert.alert('Status Updated', `Delivery marked as ${status.replace(/_/g, ' ')}`);
      setActiveDeliveryModal(null);
      loadData(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update delivery status');
    }
  };

  // 1-Click Customer Counter Pickup
  const handleCustomerPickedUp = async (deliveryId: string) => {
    Alert.alert(
      'Confirm Counter Pickup',
      'Has the customer physically collected all order items directly from the showroom / counter?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Completed',
          style: 'default',
          onPress: async () => {
            try {
              await mobileApiRequest(`/delivery/${deliveryId}/status`, {
                method: 'PATCH',
                body: JSON.stringify({
                  status: 'DELIVERED',
                  notes: 'Customer Picked Up (Self-Pickup from Counter)',
                }),
              });
              Alert.alert('Order Completed', 'Marked as Delivered. Driver dispatch permanently resolved.');
              loadData(true);
            } catch (err: any) {
              Alert.alert('Update Failed', err.message || 'Could not complete delivery');
            }
          },
        },
      ],
    );
  };

  // Warehouse item pickup check
  const handleToggleItemPickup = async (
    deliveryId: string,
    itemIdx: number,
    currentPicked: boolean | undefined,
  ) => {
    if (currentPicked) return;

    try {
      await mobileApiRequest(`/delivery/${deliveryId}/items/${itemIdx}/pickup`, {
        method: 'PATCH',
        body: JSON.stringify({ pickedUp: true }),
      });

      setDeliveries((prev) =>
        prev.map((d) => {
          if (d.id === deliveryId && d.items) {
            const nextItems = [...d.items];
            if (nextItems[itemIdx]) {
              nextItems[itemIdx] = { ...nextItems[itemIdx], pickedUp: true };
            }
            return { ...d, items: nextItems };
          }
          return d;
        }),
      );

      if (activeDeliveryModal && activeDeliveryModal.id === deliveryId && activeDeliveryModal.items) {
        const nextItems = [...activeDeliveryModal.items];
        if (nextItems[itemIdx]) {
          nextItems[itemIdx] = { ...nextItems[itemIdx], pickedUp: true };
        }
        setActiveDeliveryModal({ ...activeDeliveryModal, items: nextItems });
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to lock item pickup');
    }
  };

  // Verify Driver Cash Handover
  const handleHandoverCash = async (deliveryId: string) => {
    setHandoverInProgress(deliveryId);
    try {
      await mobileApiRequest(`/delivery/${deliveryId}/handover-cash`, {
        method: 'PATCH',
      });
      Alert.alert('Cash Handover Verified', 'Cash custody marked received into shop register!');
      loadData(true);
    } catch (err: any) {
      Alert.alert('Handover Failed', err.message || 'Could not verify driver cash handover');
    } finally {
      setHandoverInProgress(null);
    }
  };

  return (
    <View style={styles.screen}>
      <Header
        title={isDriver ? 'My Deliveries' : 'Dispatch Board'}
        subtitle={isDriver ? 'Active Runs & Pickups' : 'Driver Logistics & Routing'}
      />

      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search invoice #, customer, driver..."
      />

      {/* Filter Status Chips matching Web Dashboard */}
      <DeliveryFilterTabs
        activeFilter={activeFilter}
        onSelectFilter={setActiveFilter}
        counts={counts}
        isDriver={isDriver}
      />

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading delivery orders...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredDeliveries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
          }
          ListEmptyComponent={
            <EmptyState
              icon="bicycle-outline"
              title="No Deliveries Found"
              description="No dispatch runs match your search or filter."
            />
          }
          renderItem={({ item }) => (
            <DeliveryCard
              delivery={item}
              isOwnerOrAdmin={isOwnerOrAdmin}
              isDriver={isDriver}
              handoverInProgress={handoverInProgress}
              onOpenRunDetails={(d) => setActiveDeliveryModal(d)}
              onOpenPushModal={(d) => setPushModalDelivery(d)}
              onOpenCollectCash={(d) => setCollectCashDelivery(d)}
              onOpenAddTrip={(d) => setAddTripDelivery(d)}
              onCustomerPickedUp={handleCustomerPickedUp}
              onHandoverCash={handleHandoverCash}
              onUpdateStatus={handleUpdateStatus}
            />
          )}
        />
      )}

      {/* Modular Modals */}
      <PushDeliveryModal
        delivery={pushModalDelivery}
        visible={Boolean(pushModalDelivery)}
        onClose={() => setPushModalDelivery(null)}
        onSuccess={(dialogData) => {
          setPushModalDelivery(null);
          loadData(true);
          if (dialogData) {
            setPushSuccessData(dialogData);
          }
        }}
        drivers={drivers}
      />

      <PushSuccessModal
        data={pushSuccessData}
        visible={Boolean(pushSuccessData)}
        onClose={() => setPushSuccessData(null)}
      />

      <DeliveryRunModal
        delivery={activeDeliveryModal}
        visible={Boolean(activeDeliveryModal)}
        onClose={() => setActiveDeliveryModal(null)}
        onToggleItemPickup={handleToggleItemPickup}
        onUpdateStatus={handleUpdateStatus}
        onOpenCollectCash={(d) => setCollectCashDelivery(d)}
        onOpenAddTrip={(d) => setAddTripDelivery(d)}
      />

      <CollectCashModal
        delivery={collectCashDelivery}
        visible={Boolean(collectCashDelivery)}
        onClose={() => setCollectCashDelivery(null)}
        onSuccess={() => loadData(true)}
      />

      <AddTripModal
        delivery={addTripDelivery}
        visible={Boolean(addTripDelivery)}
        onClose={() => setAddTripDelivery(null)}
        onSuccess={() => loadData(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  listContent: {
    paddingVertical: 8,
    paddingBottom: 90,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 10,
  },
});
