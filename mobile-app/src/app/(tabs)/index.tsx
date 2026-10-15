import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { cachedMobileApiRequest, mobileApiRequest } from '@/lib/api';
import { Colors } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FilterPills } from '@/components/ui/FilterPills';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatINR, formatDate, cleanPhoneNumber } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const role = user?.role || 'SALESMAN';

  const isDriver = role === 'DRIVER';
  const isSalesman = role === 'SALESMAN';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [preset, setPreset] = useState<'today' | '7d' | '30d' | 'month' | 'all'>('today');

  // Analytics data for Owner/Admin and Salesman
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  // Driver active deliveries
  const [driverDeliveries, setDriverDeliveries] = useState<any[]>([]);
  const [handoverInProgress, setHandoverInProgress] = useState<string | null>(null);

  const loadData = useCallback(async (force = false) => {
    try {
      if (isDriver) {
        const deliveries = await cachedMobileApiRequest<any[]>('/delivery', {
          forceRefresh: force,
          onRevalidate: (fresh) => setDriverDeliveries(fresh || []),
        });
        setDriverDeliveries(deliveries || []);
      } else {
        const data = await cachedMobileApiRequest<any>(
          `/analytics/dashboard?preset=${preset}`,
          {
            forceRefresh: force,
            onRevalidate: (fresh) => setAnalyticsData(fresh),
          },
        );
        setAnalyticsData(data);
      }
    } catch (err: any) {
      console.warn('Dashboard load error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isDriver, preset]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  // Driver quick action: Call customer
  const handleCall = (phone?: string) => {
    const clean = cleanPhoneNumber(phone);
    if (clean) {
      Linking.openURL(`tel:${clean}`).catch(() => {
        Alert.alert('Error', 'Unable to initiate phone call');
      });
    }
  };

  // Driver quick action: Open Google Maps
  const handleMap = (address?: string) => {
    if (address) {
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
      ).catch(() => {
        Alert.alert('Error', 'Unable to open maps');
      });
    }
  };

  // Owner/Admin: Handover Cash Approval
  const handleVerifyHandover = async (deliveryId: string) => {
    Alert.alert(
      'Verify Cash Handover',
      'Confirm you have physically received this cash at the counter? This will update the invoice to PAID and settle the credit ledger.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Clear Custody',
          onPress: async () => {
            setHandoverInProgress(deliveryId);
            try {
              await mobileApiRequest(`/delivery/${deliveryId}/handover-cash`, {
                method: 'PATCH',
                body: JSON.stringify({}),
              });
              Alert.alert('Success', 'Cash verified! Custody cleared and payment recorded.');
              loadData(true);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to verify handover');
            } finally {
              setHandoverInProgress(null);
            }
          },
        },
      ],
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.screen}>
        <Header title="Shree Om Tiles" />
        <View style={styles.center}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading dashboard metrics...</Text>
        </View>
      </View>
    );
  }

  // ==========================================
  // RENDER 1: DRIVER DASHBOARD
  // ==========================================
  if (isDriver) {
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

  // ==========================================
  // RENDER 2: SALESMAN DASHBOARD
  // ==========================================
  if (isSalesman) {
    const kpi = analyticsData?.kpi || {};
    const recentInvoices = analyticsData?.salesmanRecentInvoices || [];

    return (
      <View style={styles.screen}>
        <Header title="Sales Portal" subtitle={`Salesman: ${user?.name || 'Staff'}`} />
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
          }
        >
          {/* Quick Counter Billing CTA */}
          <Card elevated style={styles.salesHeroCard}>
            <View>
              <Text style={styles.salesHeroTitle}>New Counter Sale</Text>
              <Text style={styles.salesHeroSub}>
                Quick invoice creation with live stock verification & on-screen UPI QR
              </Text>
            </View>
            <Button
              title="+ Create Invoice"
              onPress={() => router.push('/(tabs)/invoices')}
              variant="primary"
              size="md"
              style={{ marginTop: 14 }}
            />
          </Card>

          {/* Metrics Grid */}
          <Text style={styles.sectionTitle}>My Sales Performance</Text>
          <View style={styles.metricsGrid}>
            <Card style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Revenue</Text>
              <Text style={styles.metricValue}>{formatINR(kpi.totalRevenue)}</Text>
              <Text style={styles.metricSub}>Billed this period</Text>
            </Card>

            <Card style={styles.metricCard}>
              <Text style={styles.metricLabel}>Invoices Created</Text>
              <Text style={styles.metricValue}>{kpi.periodInvoices || 0}</Text>
              <Text style={styles.metricSub}>Orders completed</Text>
            </Card>

            <Card style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Cash / UPI</Text>
              <Text style={styles.metricValue}>{formatINR(kpi.totalCollected)}</Text>
              <Text style={styles.metricSub}>Collected upfront</Text>
            </Card>

            <Card style={styles.metricCard}>
              <Text style={styles.metricLabel}>{"Today's Invoices"}</Text>
              <Text style={styles.metricValue}>{kpi.todayInvoices || 0}</Text>
              <Text style={styles.metricSub}>Bills today</Text>
            </Card>
          </View>

          {/* Recent Invoices Stream */}
          <Text style={styles.sectionTitle}>My Recent Invoices</Text>
          {recentInvoices.length > 0 ? (
            recentInvoices.slice(0, 5).map((inv: any) => (
              <Card key={inv.id} style={styles.recentInvoiceCard}>
                <View style={styles.recentRow}>
                  <View>
                    <Text style={styles.recentInvoiceNo}>#{inv.invoiceNo}</Text>
                    <Text style={styles.recentParty}>{inv.partyName}</Text>
                    <Text style={styles.recentDate}>{formatDate(inv.createdAt)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.recentAmount}>{formatINR(inv.total)}</Text>
                    <StatusBadge status={inv.status} size="sm" />
                  </View>
                </View>
              </Card>
            ))
          ) : (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptySub}>No invoices created yet for this period</Text>
            </Card>
          )}
        </ScrollView>
      </View>
    );
  }

  // ==========================================
  // RENDER 3: OWNER & ADMIN EXECUTIVE DASHBOARD
  // ==========================================
  const kpi = analyticsData?.kpi || {};
  const pendingDeliveries = analyticsData?.pendingDriverDeliveries || [];
  const salesmen = analyticsData?.salesmenPerformance || [];
  const recHealth = analyticsData?.receivablesHealth || {};
  const revenueTrend = analyticsData?.revenueTrend || [];
  const paymentSplit = analyticsData?.paymentSplit || [];
  const categorySplit = analyticsData?.categorySplit || [];
  const recentTransactions = analyticsData?.recentTransactions || [];

  const trendMax = Math.max(
    ...revenueTrend.map((t: any) =>
      Math.max(Number(t.invoiced || 0), Number(t.collected || 0)),
    ),
    1000,
  );
  const totalCategoryRevenue = categorySplit.reduce(
    (sum: number, c: any) => sum + Number(c.value || 0),
    0,
  );
  const totalPaymentRevenue = paymentSplit.reduce(
    (sum: number, p: any) => sum + Number(p.value || 0),
    0,
  );

  return (
    <View style={styles.screen}>
      <Header
        title="Executive Overview"
        subtitle="Pocket Analytics & Management"
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
        {/* Date Filter Pills */}
        <FilterPills
          options={[
            { label: 'Today', value: 'today' },
            { label: '7 Days', value: '7d' },
            { label: '30 Days', value: '30d' },
            { label: 'This Month', value: 'month' },
            { label: 'All Time', value: 'all' },
          ]}
          selected={preset}
          onSelect={(val: any) => setPreset(val)}
        />

        {/* Primary Executive KPI Card */}
        <Card elevated style={styles.executiveHero}>
          <View style={styles.execRow}>
            <View>
              <Text style={styles.execLabel}>Gross Period Revenue</Text>
              <Text style={styles.execValue}>{formatINR(kpi.totalRevenue)}</Text>
              {kpi.deltaRevenue !== null && kpi.deltaRevenue !== undefined ? (
                <View style={styles.deltaBadge}>
                  <Text style={styles.deltaText}>
                    {kpi.deltaRevenue >= 0 ? `+${kpi.deltaRevenue}%` : `${kpi.deltaRevenue}%`} vs last period
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.execIconCircle}>
              <Ionicons name="trending-up-outline" size={26} color="#FFFFFF" />
            </View>
          </View>
        </Card>

        {/* Driver Cash in Hand Clearance Box (Critical ERP Queue) */}
        {Number(kpi.cashToBeCollectedFromDrivers || 0) > 0 || pendingDeliveries.length > 0 ? (
          <Card elevated style={styles.driverCashCard}>
            <View style={styles.driverCashHeader}>
              <View>
                <Text style={styles.driverCashTitle}>Driver Cash Handover Queue</Text>
                <Text style={styles.driverCashSubtitle}>
                  Physical cash collected by drivers awaiting counter verification
                </Text>
              </View>
              <Text style={styles.driverCashTotal}>
                {formatINR(kpi.cashToBeCollectedFromDrivers)}
              </Text>
            </View>

            {pendingDeliveries.map((item: any) => {
              const deliveryId = item.id || item.deliveryId;
              const cashAmount = item.amount ?? item.amountToCollect ?? 0;
              return (
                <View key={deliveryId} style={styles.handoverItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.handoverDriver}>
                      Driver: {item.driverName || 'Assigned Driver'}
                    </Text>
                    <Text style={styles.handoverInvoice}>
                      Invoice #{item.invoiceNo} • {item.partyName}
                    </Text>
                    <Text style={styles.handoverAmount}>
                      Cash to hand over: {formatINR(cashAmount)}
                    </Text>
                  </View>
                  <Button
                    title="Verify Cash"
                    size="sm"
                    variant="primary"
                    loading={handoverInProgress === deliveryId}
                    onPress={() => handleVerifyHandover(deliveryId)}
                  />
                </View>
              );
            })}
          </Card>
        ) : null}

        {/* Secondary KPIs Grid */}
        <Text style={styles.sectionTitle}>Key ERP Metrics</Text>
        <View style={styles.metricsGrid}>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>Total Invoices</Text>
            <Text style={styles.metricValue}>{kpi.periodInvoices || 0}</Text>
            <Text style={styles.metricSub}>{kpi.todayInvoices || 0} today</Text>
          </Card>

          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>Collected Cash/UPI</Text>
            <Text style={styles.metricValue}>{formatINR(kpi.totalCollected)}</Text>
            <Text style={styles.metricSub}>{kpi.totalCollectedCount || 0} receipts</Text>
          </Card>

          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>Receivables Due</Text>
            <Text style={[styles.metricValue, { color: '#F59E0B' }]}>
              {formatINR(kpi.receivablesTotal)}
            </Text>
            <Text style={styles.metricSub}>{kpi.receivablesCount || 0} unpaid accounts</Text>
          </Card>

          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>Pending UPI</Text>
            <Text style={styles.metricValue}>{kpi.pendingUpi || 0}</Text>
            <Text style={styles.metricSub}>Awaiting verification</Text>
          </Card>
        </View>

        {/* Salesmen Performance Section */}
        {salesmen.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Sales Staff Performance</Text>
            {salesmen.map((s: any) => {
              const staffId = s.id || s.salesmanId;
              const staffName = s.name || s.salesmanName || 'Staff';
              const count = s.invoiceCount ?? s.invoicesCount ?? 0;
              const aov = s.avgOrderValue ?? s.averageTicket ?? 0;
              const total = s.totalSales ?? 0;
              return (
                <Card key={staffId} style={styles.salesmanCard}>
                  <View style={styles.salesmanRow}>
                    <View>
                      <Text style={styles.salesmanName}>{staffName}</Text>
                      <Text style={styles.salesmanSub}>
                        {count} invoices • Avg ₹{Math.round(aov).toLocaleString('en-IN')}
                      </Text>
                    </View>
                    <Text style={styles.salesmanTotal}>{formatINR(total)}</Text>
                  </View>
                </Card>
              );
            })}
          </>
        ) : null}

        {/* Receivables Health Summary */}
        <Text style={styles.sectionTitle}>Credit Health Overview</Text>
        <Card style={styles.receivablesCard}>
          <View style={styles.recRow}>
            <View>
              <Text style={styles.recLabel}>Overdue Credit</Text>
              <Text style={[styles.recVal, { color: '#EF4444' }]}>
                {formatINR(recHealth.overdue?.total)}
              </Text>
              <Text style={styles.recSub}>{recHealth.overdue?.count || 0} overdue parties</Text>
            </View>
            <View>
              <Text style={styles.recLabel}>Partially Paid</Text>
              <Text style={[styles.recVal, { color: '#F59E0B' }]}>
                {formatINR(recHealth.partial?.total)}
              </Text>
              <Text style={styles.recSub}>{recHealth.partial?.count || 0} parties</Text>
            </View>
          </View>
          <Button
            title="Open Credit Ledger"
            variant="outline"
            size="sm"
            onPress={() => router.push('/(tabs)/transactions')}
            style={{ marginTop: 14 }}
          />
        </Card>

        {/* ========================================================================= */}
        {/* REVENUE & COLLECTIONS TREND BARS                                          */}
        {/* ========================================================================= */}
        {revenueTrend.length > 0 ? (
          <View>
            <View style={styles.trendHeaderRow}>
              <Text style={styles.sectionTitle}>Daily Inflow & Collections</Text>
              <View style={styles.trendLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#FFFFFF' }]} />
                  <Text style={styles.legendText}>Billed</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.legendText}>Collected</Text>
                </View>
              </View>
            </View>

            <Card style={styles.trendCard}>
              {revenueTrend.slice(-7).map((point: any, idx: number) => {
                const invVal = Number(point.invoiced || 0);
                const colVal = Number(point.collected || 0);
                const invPct = Math.min(100, Math.round((invVal / trendMax) * 100));
                const colPct = Math.min(100, Math.round((colVal / trendMax) * 100));
                return (
                  <View key={idx} style={styles.trendRow}>
                    <Text style={styles.trendDate}>{point.label || point.date}</Text>
                    <View style={styles.trendBarsContainer}>
                      {/* Billed Bar */}
                      <View style={styles.barWrapper}>
                        <View
                          style={[
                            styles.barFill,
                            { width: `${Math.max(invPct, 2)}%`, backgroundColor: '#FFFFFF' },
                          ]}
                        />
                        <Text style={styles.barValue}>{formatINR(invVal)}</Text>
                      </View>
                      {/* Collected Bar */}
                      <View style={styles.barWrapper}>
                        <View
                          style={[
                            styles.barFill,
                            { width: `${Math.max(colPct, 2)}%`, backgroundColor: '#10B981' },
                          ]}
                        />
                        <Text style={[styles.barValue, { color: '#10B981' }]}>
                          {formatINR(colVal)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>
        ) : null}

        {/* ========================================================================= */}
        {/* PAYMENT & CATEGORY SPLIT BREAKDOWN                                        */}
        {/* ========================================================================= */}
        <Text style={styles.sectionTitle}>Payment & Category Breakdown</Text>
        <View style={styles.splitsGrid}>
          {/* Payment Split */}
          <Card style={styles.splitCard}>
            <Text style={styles.splitHeaderTitle}>Payment Modes</Text>
            {paymentSplit.map((pm: any, idx: number) => {
              const pct =
                totalPaymentRevenue > 0
                  ? Math.round((Number(pm.value || 0) / totalPaymentRevenue) * 100)
                  : 0;
              return (
                <View key={idx} style={styles.splitRow}>
                  <View style={styles.splitRowMeta}>
                    <Text style={styles.splitName}>{pm.name}</Text>
                    <Text style={styles.splitAmount}>
                      {formatINR(pm.value)} ({pct}%)
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${pct}%`,
                          backgroundColor:
                            pm.name === 'UPI'
                              ? '#38BDF8'
                              : pm.name === 'CASH'
                              ? '#10B981'
                              : '#F59E0B',
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </Card>

          {/* Category Split */}
          {categorySplit.length > 0 ? (
            <Card style={styles.splitCard}>
              <Text style={styles.splitHeaderTitle}>Sales by Category</Text>
              {categorySplit.slice(0, 5).map((cat: any, idx: number) => {
                const pct =
                  totalCategoryRevenue > 0
                    ? Math.round((Number(cat.value || 0) / totalCategoryRevenue) * 100)
                    : 0;
                return (
                  <View key={idx} style={styles.splitRow}>
                    <View style={styles.splitRowMeta}>
                      <Text style={styles.splitName}>{cat.name}</Text>
                      <Text style={styles.splitAmount}>
                        {formatINR(cat.value)} ({pct}%)
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${pct}%`,
                            backgroundColor:
                              idx === 0 ? '#FFFFFF' : idx === 1 ? '#A855F7' : '#F59E0B',
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </Card>
          ) : null}
        </View>

        {/* ========================================================================= */}
        {/* RECENT TRANSACTIONS STREAM                                                */}
        {/* ========================================================================= */}
        {recentTransactions.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Recent Payments Feed</Text>
            {recentTransactions.slice(0, 6).map((tx: any) => (
              <Card key={tx.id} style={styles.txCard}>
                <View style={styles.txRow}>
                  <View style={styles.txIconCircle}>
                    <Ionicons
                      name={tx.mode === 'UPI' ? 'qr-code-outline' : 'cash-outline'}
                      size={18}
                      color="#FFFFFF"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txParty}>{tx.partyName}</Text>
                    <Text style={styles.txSub}>
                      {tx.invoiceNo && tx.invoiceNo !== 'Direct'
                        ? `Inv #${tx.invoiceNo} • `
                        : ''}
                      {formatDate(tx.paidAt)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.txAmount}>{formatINR(tx.amount)}</Text>
                    <View style={styles.txBadge}>
                      <Text style={styles.txBadgeText}>{tx.mode}</Text>
                    </View>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        ) : null}
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
  salesHeroCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#16161A',
  },
  salesHeroTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  salesHeroSub: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 3,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48.5%',
    padding: 14,
    borderRadius: 14,
    marginBottom: 0,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginVertical: 4,
  },
  metricSub: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
  },
  recentInvoiceCard: {
    padding: 14,
    marginBottom: 8,
  },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentInvoiceNo: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  recentParty: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 1,
  },
  recentDate: {
    fontSize: 10.5,
    color: Colors.dark.textTertiary,
    marginTop: 3,
  },
  recentAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  executiveHero: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#16161A',
  },
  execRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  execLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  execValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    marginVertical: 4,
    letterSpacing: -0.5,
  },
  deltaBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  deltaText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '700',
  },
  execIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.dark.cardElevated,
    borderWidth: 1,
    borderColor: Colors.dark.borderMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverCashCard: {
    marginTop: 14,
    padding: 16,
    backgroundColor: '#18181D',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  driverCashHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  driverCashTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FCD34D',
  },
  driverCashSubtitle: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    maxWidth: 220,
    marginTop: 2,
  },
  driverCashTotal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  handoverItem: {
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  handoverDriver: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  handoverInvoice: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  handoverAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FCD34D',
    marginTop: 3,
  },
  salesmanCard: {
    padding: 14,
    marginBottom: 8,
  },
  salesmanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  salesmanName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  salesmanSub: {
    fontSize: 11.5,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  salesmanTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  receivablesCard: {
    padding: 16,
  },
  recRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  recLabel: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  recVal: {
    fontSize: 18,
    fontWeight: '800',
    marginVertical: 4,
  },
  recSub: {
    fontSize: 10.5,
    color: Colors.dark.textTertiary,
  },
  trendHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 10,
  },
  trendLegend: {
    flexDirection: 'row',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  trendCard: {
    padding: 14,
    marginBottom: 6,
  },
  trendRow: {
    marginBottom: 12,
  },
  trendDate: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    marginBottom: 4,
  },
  trendBarsContainer: {
    gap: 4,
  },
  barWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 18,
  },
  barFill: {
    height: 8,
    borderRadius: 4,
    minWidth: 4,
  },
  barValue: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  splitsGrid: {
    gap: 10,
  },
  splitCard: {
    padding: 14,
  },
  splitHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  splitRow: {
    marginBottom: 10,
  },
  splitRowMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  splitName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  splitAmount: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.dark.secondary,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  txCard: {
    padding: 12,
    marginBottom: 8,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  txIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.dark.cardElevated,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txParty: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  txSub: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#10B981',
  },
  txBadge: {
    backgroundColor: Colors.dark.secondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
  },
  txBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
