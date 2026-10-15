import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { mobileApiRequest, cachedMobileApiRequest } from '@/lib/api';
import { Colors } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SearchBar } from '@/components/ui/SearchBar';
import { FilterPills } from '@/components/ui/FilterPills';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatINR, cleanPhoneNumber } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';

import { Delivery, DriverUser } from '@/components/deliveries/types';
import { PushDeliveryModal } from '@/components/deliveries/PushDeliveryModal';
import { DeliveryRunModal } from '@/components/deliveries/DeliveryRunModal';
import { CollectCashModal } from '@/components/deliveries/CollectCashModal';
import { AddTripModal } from '@/components/deliveries/AddTripModal';

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
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [activeDeliveryModal, setActiveDeliveryModal] = useState<Delivery | null>(null);
  const [pushModalDelivery, setPushModalDelivery] = useState<Delivery | null>(null);
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

  // Customer phone call
  const handleCall = (phone?: string) => {
    const clean = cleanPhoneNumber(phone);
    if (clean) {
      Linking.openURL(`tel:${clean}`).catch(() => {
        Alert.alert('Error', 'Unable to initiate phone call');
      });
    }
  };

  // Google Maps
  const handleMap = (address?: string) => {
    if (address) {
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
      ).catch(() => {
        Alert.alert('Error', 'Unable to launch Google Maps');
      });
    }
  };

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

  // Filtered deliveries
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      const partyName = d.invoice?.party?.name?.toLowerCase() || '';
      const invoiceNo = d.invoice?.invoiceNo?.toLowerCase() || '';
      const driverName = d.driver?.name?.toLowerCase() || '';
      const s = search.toLowerCase();

      const matchesSearch = partyName.includes(s) || invoiceNo.includes(s) || driverName.includes(s);
      const matchesFilter = statusFilter === 'ALL' || d.status === statusFilter;
      return matchesSearch && matchesFilter;
    });
  }, [deliveries, search, statusFilter]);

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

      {/* Filter Status Chips */}
      <FilterPills
        options={[
          { label: 'All Orders', value: 'ALL', count: deliveries.length },
          { label: 'Pending', value: 'PENDING' },
          { label: 'Assigned', value: 'ASSIGNED' },
          { label: 'Out for Pickup', value: 'OUT_FOR_PICKUP' },
          { label: 'Out for Delivery', value: 'OUT_FOR_DELIVERY' },
          { label: 'Delivered', value: 'DELIVERED' },
        ]}
        selected={statusFilter}
        onSelect={setStatusFilter}
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
          renderItem={({ item }) => {
            const itemsList = item.items || [];
            const pickedCount = itemsList.filter((it) => it.pickedUp).length;
            const totalCount = itemsList.length;

            return (
              <Card elevated style={styles.deliveryCard}>
                {/* Header */}
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.invoiceNo}>
                      Invoice #{item.invoice?.invoiceNo}
                    </Text>
                    <Text style={styles.partyName}>{item.invoice?.party?.name}</Text>
                  </View>
                  <StatusBadge status={item.status} size="sm" />
                </View>

                {/* Driver & Cash Custody Banner */}
                <View style={styles.infoRow}>
                  <View style={styles.driverTag}>
                    <Ionicons name="person-outline" size={13} color="#A1A1AA" />
                    <Text style={styles.driverText}>
                      {item.driver?.name ? `Driver: ${item.driver.name}` : 'Unassigned'}
                    </Text>
                  </View>

                  {Number(item.amountToCollect || 0) > 0 ? (
                    <Text style={styles.collectText}>
                      Collect: {formatINR(item.amountToCollect)}
                    </Text>
                  ) : null}
                </View>

                {/* Warehouse Item Pickup Progress */}
                {totalCount > 0 ? (
                  <View style={styles.pickupProgressBar}>
                    <View style={styles.progressHeader}>
                      <Text style={styles.progressLabel}>Warehouse Item Pickups</Text>
                      <Text style={styles.progressCount}>
                        {pickedCount} / {totalCount} items picked
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${totalCount > 0 ? (pickedCount / totalCount) * 100 : 0}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ) : null}

                {/* Address & Quick Actions */}
                {item.invoice?.party?.address ? (
                  <View style={styles.addressBox}>
                    <Ionicons name="location-outline" size={14} color="#A1A1AA" />
                    <Text style={styles.addressText} numberOfLines={2}>
                      {item.invoice?.party?.address}
                    </Text>
                  </View>
                ) : null}

                {/* Handover Notice for Owner */}
                {item.cashCollected && !item.cashHandedOver ? (
                  <View style={styles.handoverBanner}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.handoverBannerTitle}>
                        Cash in Driver Hand: {formatINR(item.cashCollected)}
                      </Text>
                      <Text style={styles.handoverBannerSub}>
                        Driver has not handed over this cash at the office yet
                      </Text>
                    </View>
                    {isOwnerOrAdmin ? (
                      <Button
                        title="Verify"
                        size="sm"
                        variant="primary"
                        loading={handoverInProgress === item.id}
                        onPress={() => handleHandoverCash(item.id)}
                      />
                    ) : null}
                  </View>
                ) : null}

                {/* Action Buttons */}
                <View style={styles.cardActions}>
                  <Button
                    title="Call"
                    icon="call"
                    size="sm"
                    variant="secondary"
                    onPress={() => handleCall(item.invoice?.party?.phone)}
                    style={{ flex: 1 }}
                  />

                  {item.invoice?.party?.address ? (
                    <Button
                      title="Maps"
                      icon="navigate"
                      size="sm"
                      variant="secondary"
                      onPress={() => handleMap(item.invoice?.party?.address)}
                      style={{ flex: 1 }}
                    />
                  ) : null}

                  <Button
                    title="Run Details"
                    size="sm"
                    variant="outline"
                    onPress={() => setActiveDeliveryModal(item)}
                    style={{ flex: 1.2 }}
                  />
                </View>

                {/* Owner: Push Dispatch & Counter Pickup Buttons */}
                {isOwnerOrAdmin && item.status === 'PENDING' ? (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <Button
                      title="Dispatch Order"
                      icon="paper-plane-outline"
                      variant="primary"
                      size="md"
                      onPress={() => setPushModalDelivery(item)}
                      style={{ flex: 1.3 }}
                    />
                    <Button
                      title="Counter Pickup"
                      icon="bag-check-outline"
                      variant="outline"
                      size="md"
                      onPress={() => handleCustomerPickedUp(item.id)}
                      style={{ flex: 1.1 }}
                    />
                  </View>
                ) : null}

                {/* Driver: Collect Cash Button */}
                {isDriver &&
                (item.status === 'OUT_FOR_DELIVERY' || item.status === 'PICKED_UP') ? (
                  Number(item.amountToCollect || 0) > 0 ? (
                    <Button
                      title="Mark Delivered & Collect Cash"
                      icon="checkmark-circle-outline"
                      variant="primary"
                      size="md"
                      onPress={() => setCollectCashDelivery(item)}
                      style={{ marginTop: 8 }}
                    />
                  ) : (
                    <Button
                      title="Mark as Delivered"
                      icon="checkmark-circle-outline"
                      variant="primary"
                      size="md"
                      onPress={() => handleUpdateStatus(item.id, 'DELIVERED')}
                      style={{ marginTop: 8 }}
                    />
                  )
                ) : null}
              </Card>
            );
          }}
        />
      )}

      {/* Modular Modals */}
      <PushDeliveryModal
        delivery={pushModalDelivery}
        visible={Boolean(pushModalDelivery)}
        onClose={() => setPushModalDelivery(null)}
        onSuccess={() => loadData(true)}
        drivers={drivers}
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
    padding: 16,
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
  deliveryCard: {
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  invoiceNo: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  partyName: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  driverTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.dark.cardElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  driverText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  collectText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  pickupProgressBar: {
    marginVertical: 8,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  progressCount: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '700',
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.dark.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginVertical: 6,
    padding: 8,
    backgroundColor: Colors.dark.cardElevated,
    borderRadius: 8,
  },
  addressText: {
    fontSize: 11.5,
    color: Colors.dark.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
  handoverBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    marginVertical: 6,
  },
  handoverBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F59E0B',
  },
  handoverBannerSub: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
    marginTop: 1,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
});
