import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Colors } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cleanPhoneNumber, formatDate } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';
import { mobileApiRequest, cachedMobileApiRequest } from '@/lib/api';

interface SupervisorDashboardViewProps {
  user: any;
  refreshing: boolean;
  onRefresh: () => void;
  router: any;
}

export function SupervisorDashboardView({
  user,
  refreshing,
  onRefresh,
  router,
}: SupervisorDashboardViewProps) {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  const warehouseId = user?.scope;

  const loadData = useCallback(async (force = false) => {
    try {
      const [delData, whData] = await Promise.all([
        cachedMobileApiRequest<any[]>('/delivery', {
          forceRefresh: force,
          onRevalidate: (fresh) => {
            const list = Array.isArray(fresh) ? fresh : (fresh as any)?.data || [];
            setDeliveries(list);
          },
        }),
        cachedMobileApiRequest<any[]>('/warehouses', {
          forceRefresh: force,
          onRevalidate: (fresh) => setWarehouses(fresh || []),
        }).catch(() => []),
      ]);

      const list = Array.isArray(delData) ? delData : (delData as any)?.data || [];
      setDeliveries(list);
      setWarehouses(whData || []);
    } catch (err: any) {
      console.warn('Supervisor dashboard load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const assignedWarehouse = useMemo(() => {
    if (!warehouseId || !warehouses.length) return null;
    return warehouses.find((w) => w.id === warehouseId);
  }, [warehouseId, warehouses]);

  // Deliveries relevant to this supervisor's warehouse (must have items belonging to warehouseId)
  const warehouseRuns = useMemo(() => {
    return deliveries
      .filter((d) => d.status !== 'CANCELLED' && d.status !== 'DELIVERED')
      .map((d) => {
        const items = d.items || [];
        const myItems = items.filter((it: any) =>
          warehouseId ? it.warehouseId === warehouseId : true,
        );
        return {
          ...d,
          relevantItems: myItems,
          allMyItemsPicked:
            myItems.length > 0 && myItems.every((it: any) => Boolean(it.pickedUp)),
        };
      })
      .filter((d) => d.relevantItems.length > 0);
  }, [deliveries, warehouseId]);

  // Statistics
  const pendingPickupItemsCount = useMemo(() => {
    let count = 0;
    warehouseRuns.forEach((r) => {
      r.relevantItems.forEach((it: any) => {
        if (!it.pickedUp) count += 1;
      });
    });
    return count;
  }, [warehouseRuns]);

  const completedPickupItemsCount = useMemo(() => {
    let count = 0;
    warehouseRuns.forEach((r) => {
      r.relevantItems.forEach((it: any) => {
        if (it.pickedUp) count += 1;
      });
    });
    return count;
  }, [warehouseRuns]);

  // Supervisor item pickup confirmation
  const handleConfirmItemPickup = async (
    deliveryId: string,
    itemIndex: number,
    productName: string,
  ) => {
    setUpdatingItemId(`${deliveryId}-${itemIndex}`);
    try {
      await mobileApiRequest(`/delivery/${deliveryId}/items/${itemIndex}/pickup`, {
        method: 'PATCH',
        body: JSON.stringify({ pickedUp: true }),
      });
      Alert.alert('Item Picked', `Confirmed pickup for "${productName}". Driver can now proceed once all items are ready.`);
      loadData(true);
      onRefresh();
    } catch (err: any) {
      Alert.alert('Pickup Failed', err.message || 'Failed to confirm item pickup');
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleCallDriver = (phone?: string) => {
    const clean = cleanPhoneNumber(phone);
    if (clean) {
      Linking.openURL(`tel:${clean}`).catch(() => {
        Alert.alert('Error', 'Unable to call driver');
      });
    }
  };

  return (
    <View style={styles.screen}>
      <Header
        title="Warehouse Cockpit"
        subtitle={assignedWarehouse ? `Godown: ${assignedWarehouse.name}` : `Supervisor: ${user?.name || 'Staff'}`}
        rightAction={{
          icon: 'refresh-outline',
          onPress: () => {
            loadData(true);
            onRefresh();
          },
        }}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || loading}
            onRefresh={() => {
              loadData(true);
              onRefresh();
            }}
            tintColor="#FFFFFF"
          />
        }
      >
        {/* Godown Identity Banner */}
        <Card elevated style={styles.warehouseBanner}>
          <View style={styles.bannerTop}>
            <View style={styles.warehouseIconCircle}>
              <Ionicons name="business" size={20} color="#C084FC" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.warehouseTitle}>
                {assignedWarehouse?.name || 'Assigned Warehouse'}
              </Text>
              <Text style={styles.warehouseSub} numberOfLines={1}>
                {assignedWarehouse?.address || 'Primary Logistics & Storage Hub'}
              </Text>
            </View>
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>SUPERVISOR</Text>
            </View>
          </View>
        </Card>

        {/* Quick Stats Grid */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <View style={styles.statIconRow}>
              <Ionicons name="cube-outline" size={16} color="#F59E0B" />
              <Text style={[styles.statValue, { color: '#F59E0B' }]}>
                {pendingPickupItemsCount}
              </Text>
            </View>
            <Text style={styles.statLabel}>Pending Pickups</Text>
            <Text style={styles.statSub}>Awaiting loading</Text>
          </Card>

          <Card style={styles.statCard}>
            <View style={styles.statIconRow}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#10B981" />
              <Text style={[styles.statValue, { color: '#10B981' }]}>
                {completedPickupItemsCount}
              </Text>
            </View>
            <Text style={styles.statLabel}>Items Picked</Text>
            <Text style={styles.statSub}>Loaded for dispatch</Text>
          </Card>

          <Card style={styles.statCard}>
            <View style={styles.statIconRow}>
              <Ionicons name="bicycle-outline" size={16} color="#38BDF8" />
              <Text style={[styles.statValue, { color: '#38BDF8' }]}>
                {warehouseRuns.length}
              </Text>
            </View>
            <Text style={styles.statLabel}>Active Driver Runs</Text>
            <Text style={styles.statSub}>At this godown</Text>
          </Card>
        </View>

        {/* Driver Pickup Verification Queue */}
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="checkmark-done-circle" size={17} color="#C084FC" />
            <Text style={styles.sectionTitle}>Driver Pickup Verification</Text>
          </View>
          <View style={styles.badgePurple}>
            <Text style={styles.badgePurpleText}>
              {warehouseRuns.length} Runs
            </Text>
          </View>
        </View>
        <Text style={styles.sectionSub}>
          Drivers arrive here for pickup. Inspect and tap &quot;Confirm Pickup&quot; to authorize goods departure.
        </Text>

        {warehouseRuns.length === 0 ? (
          <Card style={styles.emptyRunsCard}>
            <Ionicons name="checkmark-circle-outline" size={36} color="#10B981" />
            <Text style={styles.emptyRunsTitle}>All Warehouse Pickups Clear</Text>
            <Text style={styles.emptyRunsSub}>
              There are no pending driver orders requiring pickup from this godown.
            </Text>
          </Card>
        ) : (
          warehouseRuns.map((run) => (
            <Card key={run.id} elevated style={styles.runCard}>
              {/* Run Header */}
              <View style={styles.runHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.invoiceNo}>
                      #{run.invoice?.invoiceNo || 'N/A'}
                    </Text>
                    <StatusBadge status={run.status} size="sm" />
                  </View>
                  <Text style={styles.customerName} numberOfLines={1}>
                    Destination: {run.invoice?.party?.name || 'Walk-in Customer'}
                  </Text>
                  <Text style={styles.dateMeta}>
                    Dispatched: {formatDate(run.createdAt)}
                  </Text>
                </View>

                {/* Driver Tag */}
                {run.driver ? (
                  <TouchableOpacity
                    style={styles.driverTag}
                    onPress={() => handleCallDriver(run.driver?.phone)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="person" size={12} color="#10B981" />
                    <Text style={styles.driverTagName} numberOfLines={1}>
                      {run.driver.name}
                    </Text>
                    {run.driver?.phone ? (
                      <Ionicons name="call" size={11} color="#38BDF8" />
                    ) : null}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.unassignedDriverTag}>
                    <Text style={styles.unassignedDriverText}>No Driver</Text>
                  </View>
                )}
              </View>

              <View style={styles.divider} />

              {/* Items Table / List */}
              <View style={styles.itemsList}>
                {run.relevantItems.map((it: any) => {
                  const itemIdx = (run.items || []).findIndex(
                    (raw: any) => raw.invoiceItemId === it.invoiceItemId,
                  );
                  const isUpdating = updatingItemId === `${run.id}-${itemIdx}`;
                  const isPicked = Boolean(it.pickedUp);

                  return (
                    <View
                      key={it.invoiceItemId || itemIdx}
                      style={[
                        styles.itemRow,
                        isPicked && styles.itemRowPicked,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.nameRow}>
                          <Text style={styles.itemName}>{it.productName}</Text>
                          <View style={styles.qtyBadge}>
                            <Text style={styles.qtyText}>
                              {it.qty} {it.unit}
                            </Text>
                          </View>
                        </View>
                        {it.batchNo ? (
                          <Text style={styles.batchText}>Lot/Batch: {it.batchNo}</Text>
                        ) : null}
                      </View>

                      {/* Pickup Confirmation Action */}
                      <View>
                        {isPicked ? (
                          <View style={styles.pickedBadge}>
                            <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                            <Text style={styles.pickedText}>
                              {it.pickedUpByName ? `Picked (${it.pickedUpByName})` : 'Picked'}
                            </Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.confirmPickBtn}
                            disabled={isUpdating}
                            onPress={() =>
                              handleConfirmItemPickup(
                                run.id,
                                itemIdx >= 0 ? itemIdx : 0,
                                it.productName,
                              )
                            }
                          >
                            {isUpdating ? (
                              <ActivityIndicator size="small" color="#09090B" />
                            ) : (
                              <>
                                <Ionicons name="checkmark" size={13} color="#09090B" />
                                <Text style={styles.confirmPickBtnText}>Confirm Pick</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>
          ))
        )}

        {/* Quick Hub Navigation Cards */}
        <View style={styles.hubSection}>
          <Text style={styles.hubTitle}>Warehouse Quick Hub</Text>
          <View style={styles.hubGrid}>
            <TouchableOpacity
              style={styles.hubCard}
              onPress={() => router.push('/(tabs)/stock')}
              activeOpacity={0.7}
            >
              <View style={[styles.hubIconCircle, { backgroundColor: '#38BDF8' }]}>
                <Ionicons name="cube" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.hubCardTitle}>Stock & Audit</Text>
              <Text style={styles.hubCardSub}>Audit godown inventory</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.hubCard}
              onPress={() => router.push('/(tabs)/invoices')}
              activeOpacity={0.7}
            >
              <View style={[styles.hubIconCircle, { backgroundColor: '#A855F7' }]}>
                <Ionicons name="receipt" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.hubCardTitle}>All Invoices</Text>
              <Text style={styles.hubCardSub}>View quantities & items</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.hubCard}
              onPress={() => router.push('/(tabs)/more')}
              activeOpacity={0.7}
            >
              <View style={[styles.hubIconCircle, { backgroundColor: '#F59E0B' }]}>
                <Ionicons name="cart" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.hubCardTitle}>Inward Purchases</Text>
              <Text style={styles.hubCardSub}>Track received inventory</Text>
            </TouchableOpacity>
          </View>
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
  warehouseBanner: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    backgroundColor: 'rgba(168, 85, 247, 0.06)',
  },
  bannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  warehouseIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warehouseTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  warehouseSub: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 1,
  },
  rolePill: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
  },
  rolePillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#C084FC',
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
  },
  statSub: {
    fontSize: 9,
    color: Colors.dark.textTertiary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  badgePurple: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePurpleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C084FC',
  },
  sectionSub: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
    marginBottom: 10,
  },
  emptyRunsCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    marginBottom: 14,
  },
  emptyRunsTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 8,
  },
  emptyRunsSub: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginTop: 3,
  },
  runCard: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  runHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  invoiceNo: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  customerName: {
    fontSize: 11.5,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  dateMeta: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
    marginTop: 1,
  },
  driverTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  driverTagName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
    maxWidth: 90,
  },
  unassignedDriverTag: {
    backgroundColor: Colors.dark.secondary,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  unassignedDriverText: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginVertical: 10,
  },
  itemsList: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    backgroundColor: Colors.dark.cardElevated,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 10,
  },
  itemRowPicked: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  qtyBadge: {
    backgroundColor: Colors.dark.secondary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  qtyText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  batchText: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  pickedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  pickedText: {
    color: '#10B981',
    fontSize: 10.5,
    fontWeight: '800',
  },
  confirmPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  confirmPickBtnText: {
    color: '#09090B',
    fontSize: 11,
    fontWeight: '800',
  },
  hubSection: {
    marginTop: 14,
  },
  hubTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  hubGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  hubCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
  },
  hubIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  hubCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  hubCardSub: {
    fontSize: 9,
    color: Colors.dark.textTertiary,
    textAlign: 'center',
    marginTop: 2,
  },
});
