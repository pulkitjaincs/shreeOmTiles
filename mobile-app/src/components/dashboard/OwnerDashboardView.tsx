import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Colors } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FilterPills } from '@/components/ui/FilterPills';
import { formatINR, formatDate } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';

interface OwnerDashboardViewProps {
  analyticsData: any;
  preset: 'today' | '7d' | '30d' | 'month' | 'all';
  setPreset: (preset: 'today' | '7d' | '30d' | 'month' | 'all') => void;
  refreshing: boolean;
  onRefresh: () => void;
  handoverInProgress: string | null;
  handleVerifyHandover: (deliveryId: string) => void;
  router: any;
}

export function OwnerDashboardView({
  analyticsData,
  preset,
  setPreset,
  refreshing,
  onRefresh,
  handoverInProgress,
  handleVerifyHandover,
  router,
}: OwnerDashboardViewProps) {
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

        {/* REVENUE & COLLECTIONS TREND BARS */}
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

        {/* PAYMENT & CATEGORY SPLIT BREAKDOWN */}
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

        {/* RECENT TRANSACTIONS STREAM */}
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 18,
    marginBottom: 10,
    letterSpacing: -0.2,
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
    borderRadius: 16,
  },
  driverCashHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  driverCashTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FCD34D',
  },
  driverCashSubtitle: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
    maxWidth: 220,
  },
  driverCashTotal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  handoverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    gap: 10,
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
    color: '#10B981',
    marginTop: 2,
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
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  salesmanSub: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  salesmanTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#10B981',
  },
  receivablesCard: {
    padding: 16,
    borderRadius: 16,
  },
  recRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
  },
  recVal: {
    fontSize: 20,
    fontWeight: '800',
    marginVertical: 4,
  },
  recSub: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
  },
  trendHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trendLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  trendCard: {
    padding: 14,
    borderRadius: 16,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
    gap: 10,
  },
  trendDate: {
    width: 60,
    fontSize: 10.5,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  trendBarsContainer: {
    flex: 1,
    gap: 4,
  },
  barWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barFill: {
    height: 7,
    borderRadius: 4,
  },
  barValue: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  splitsGrid: {
    gap: 12,
  },
  splitCard: {
    padding: 16,
    borderRadius: 16,
  },
  splitHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  splitRow: {
    marginBottom: 10,
  },
  splitRowMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  splitName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  splitAmount: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
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
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.dark.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.borderMedium,
  },
  txParty: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  txSub: {
    fontSize: 10.5,
    color: Colors.dark.textTertiary,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
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
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
