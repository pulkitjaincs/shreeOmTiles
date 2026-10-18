import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { mobileApiRequest, cachedMobileApiRequest, subscribeToAppSync } from '@/lib/api';
import { useTheme, useThemedStyles } from '@/lib/theme-context';
import { Header } from '@/components/ui/Header';
import { SearchBar } from '@/components/ui/SearchBar';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { EmptyState } from '@/components/ui/EmptyState';

import {
  Delivery,
  DriverUser,
  FilterTab,
  DeliveryCounts,
  PushSuccessDialogData,
  DeliveryCard,
  PushDeliveryModal,
  PushSuccessModal,
  DeliveryRunModal,
  CollectCashModal,
} from '@/components/deliveries';

export default function DeliveriesScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const role = user?.role || 'DRIVER';

  const styles = useThemedStyles((c) =>
    StyleSheet.create({
      screen: {
        flex: 1,
        backgroundColor: c.background,
      },
      topControlContainer: {
        paddingBottom: 4,
      },
      filterDropdownRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        marginTop: 4,
        marginBottom: 2,
      },
      resultsRow: {
        minHeight: 24,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
        marginBottom: 2,
      },
      resultsText: {
        color: c.textTertiary,
        fontSize: 11,
      },
      clearFiltersText: {
        color: '#38BDF8',
        fontSize: 11,
        fontWeight: '700',
      },
      listContent: {
        paddingVertical: 6,
        paddingBottom: 90,
      },
      center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      },
      loadingText: {
        color: c.textSecondary,
        fontSize: 12,
        marginTop: 10,
      },
    })
  );

  const isDriver = role === 'DRIVER';
  const isSupervisor = role === 'SUPERVISOR';
  const isDirectorOrAdmin = role === 'OWNER' || (role as any) === 'DIRECTOR' || role === 'ADMIN';
  const isOwnerOrAdmin = isDirectorOrAdmin;
  const userWarehouseId = user?.scope;

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
          ? cachedMobileApiRequest<any>('/users?role=DRIVER', {
              forceRefresh: force,
              onRevalidate: (fresh) => {
                const driverList = Array.isArray(fresh) ? fresh : (fresh as any)?.data || [];
                setDrivers(driverList);
              },
            }).catch(() => [])
          : Promise.resolve([]),
      ]);

      const list = Array.isArray(delData) ? delData : (delData as any)?.data || [];
      setDeliveries(list);
      const driverList = Array.isArray(usersData) ? usersData : (usersData as any)?.data || [];
      setDrivers(driverList);
    } catch (err: any) {
      console.warn('Failed to load deliveries', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isOwnerOrAdmin]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  useEffect(() => {
    const unsubscribe = subscribeToAppSync(() => {
      void loadData();
    });
    return () => unsubscribe();
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

  // Dropdown options matching web-dashboard filters
  const filterOptions = useMemo(() => [
    {
      label: 'All Deliveries',
      value: 'ALL',
      count: counts.total,
      icon: 'layers-outline' as const,
      color: '#FFFFFF',
    },
    {
      label: isDriver ? 'Ready for Pickup' : 'Pending Dispatch',
      value: 'PENDING',
      count: counts.pending,
      icon: 'time-outline' as const,
      color: '#F59E0B',
    },
    {
      label: 'Out for Pickup',
      value: 'OUT_FOR_PICKUP',
      count: counts.outForPickup,
      icon: 'cube-outline' as const,
      color: '#A855F7',
    },
    {
      label: 'Out for Delivery',
      value: 'OUT_FOR_DELIVERY',
      count: counts.outForDelivery,
      icon: 'bicycle-outline' as const,
      color: '#38BDF8',
    },
    {
      label: 'Delivered',
      value: 'DELIVERED',
      count: counts.delivered,
      icon: 'checkmark-circle-outline' as const,
      color: '#10B981',
    },
    ...(counts.cancelled > 0
      ? [
          {
            label: 'Cancelled',
            value: 'CANCELLED',
            count: counts.cancelled,
            icon: 'close-circle-outline' as const,
            color: '#EF4444',
          },
        ]
      : []),
  ], [counts, isDriver]);

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

  // Supervisor item pickup confirmation
  const handleSupervisorConfirmPick = async (deliveryId: string, itemIdx: number) => {
    try {
      await mobileApiRequest(`/delivery/${deliveryId}/items/${itemIdx}/pickup`, {
        method: 'PATCH',
        body: JSON.stringify({ pickedUp: true }),
      });
      Alert.alert('Item Picked', 'Item verified and marked as picked!');
      loadData(true);
    } catch (err: any) {
      Alert.alert('Pickup Failed', err.message || 'Could not verify item pickup');
    }
  };

  return (
    <View style={styles.screen}>
      <Header
        title={isDriver ? 'My Deliveries' : 'Dispatch Board'}
        subtitle={isDriver ? 'Active Runs & Pickups' : 'Driver Logistics & Routing'}
      />

      <View style={styles.topControlContainer}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search invoice #, customer, driver..."
        />

        {/* View Selection Dropdown matching Invoices & Payments */}
        <View style={styles.filterDropdownRow}>
          <FilterDropdown
            label="Filter"
            value={activeFilter}
            onSelect={(val) => setActiveFilter(val as FilterTab)}
            options={filterOptions}
            hideLabelPrefix
            showCountOnTrigger
            containerStyle={{ flex: 1 }}
          />
        </View>

        {/* Results Count & Reset */}
        <View style={styles.resultsRow}>
          <Text style={styles.resultsText}>
            Showing {filteredDeliveries.length} of {deliveries.length} deliveries
          </Text>
          {(activeFilter !== 'ALL' || Boolean(search.trim())) ? (
            <TouchableOpacity
              onPress={() => {
                setActiveFilter('ALL');
                setSearch('');
              }}
            >
              <Text style={styles.clearFiltersText}>Reset Filters</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={colors.text} />
          <Text style={styles.loadingText}>Loading delivery orders...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredDeliveries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
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
              isSupervisor={isSupervisor}
              userWarehouseId={userWarehouseId}
              handoverInProgress={handoverInProgress}
              onOpenRunDetails={(d) => setActiveDeliveryModal(d)}
              onOpenPushModal={(d) => setPushModalDelivery(d)}
              onOpenCollectCash={(d) => setCollectCashDelivery(d)}
              onCustomerPickedUp={handleCustomerPickedUp}
              onHandoverCash={handleHandoverCash}
              onUpdateStatus={handleUpdateStatus}
              onSupervisorConfirmPick={handleSupervisorConfirmPick}
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
      />

      <CollectCashModal
        delivery={collectCashDelivery}
        visible={Boolean(collectCashDelivery)}
        onClose={() => setCollectCashDelivery(null)}
        onSuccess={() => loadData(true)}
      />
    </View>
  );
}
