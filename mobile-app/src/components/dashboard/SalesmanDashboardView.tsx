import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { Colors } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatINR, formatDateTime, cleanPhoneNumber } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';
import { DashboardData, DatePreset } from './types';

// Shared Components
import { DateFilterBar } from './shared/DateFilterBar';
import { SalesTimelineCard } from './shared/SalesTimelineCard';
import { CategorySplitCard } from './shared/CategorySplitCard';

interface SalesmanDashboardViewProps {
  user: any;
  analyticsData: DashboardData | null;
  preset: DatePreset;
  setPreset: (preset: DatePreset) => void;
  dateFrom: string;
  dateTo: string;
  setDateFrom: (value: string) => void;
  setDateTo: (value: string) => void;
  onApplyDateRange: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  router: any;
}

export function SalesmanDashboardView({
  user,
  analyticsData,
  preset,
  setPreset,
  dateFrom,
  dateTo,
  setDateFrom,
  setDateTo,
  onApplyDateRange,
  refreshing,
  onRefresh,
  router,
}: SalesmanDashboardViewProps) {
  const kpi = analyticsData?.kpi;
  const recentInvoices = analyticsData?.salesmanRecentInvoices || [];
  const trend = analyticsData?.revenueTrend || [];
  const categories = analyticsData?.categorySplit || [];

  // Average ticket size (AOV)
  const avgTicket = useMemo(() => {
    if (!kpi?.periodInvoices || kpi.periodInvoices <= 0) return 0;
    return (kpi.totalRevenue || 0) / kpi.periodInvoices;
  }, [kpi]);

  const handleCall = (phone?: string) => {
    const clean = cleanPhoneNumber(phone);
    if (clean) {
      Linking.openURL(`tel:${clean}`).catch(() => {
        Alert.alert('Error', 'Unable to initiate phone call');
      });
    }
  };

  return (
    <View style={styles.screen}>
      <Header
        title="Sales Staff Portal"
        subtitle={`Salesman: ${user?.name || 'Staff'}`}
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
        {/* Top Personal Greeting & Quick Invoice CTA */}
        <View style={styles.topGreetingCard}>
          <View style={{ flex: 1 }}>
            <View style={styles.personalBadgeRow}>
              <View style={styles.personalDot} />
              <Text style={styles.personalBadgeText}>PERSONAL SALES VIEW</Text>
            </View>
            <Text style={styles.greetingTitle}>Welcome, {user?.name || 'Staff'}</Text>
            <Text style={styles.greetingSub}>
              Track your sales, completed orders, upfront collections & customer credits.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.createInvoiceBtn}
            onPress={() => router.push('/(tabs)/invoices')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color="#09090B" />
            <Text style={styles.createInvoiceBtnText}>+ Invoice</Text>
          </TouchableOpacity>
        </View>

        {/* Reusable Date Filter Bar */}
        <DateFilterBar
          preset={preset}
          setPreset={setPreset}
          dateFrom={dateFrom}
          dateTo={dateTo}
          setDateFrom={setDateFrom}
          setDateTo={setDateTo}
          onApplyDateRange={onApplyDateRange}
        />

        {/* 3 Dedicated Personal KPI Cards (Matching Web Salesman Dashboard) */}
        <Text style={styles.sectionTitle}>My Personal Performance</Text>
        <View style={styles.kpiCardsCol}>
          {/* Card 1: My Invoiced Sales */}
          <Card elevated style={styles.personalKpiCard}>
            <View style={styles.personalKpiRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.personalKpiLabel} numberOfLines={1}>My Invoiced Sales</Text>
                <Text
                  style={styles.personalKpiValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {formatINR(kpi?.totalRevenue)}
                </Text>
                {kpi?.deltaRevenue !== null && kpi?.deltaRevenue !== undefined ? (
                  <View
                    style={[
                      styles.deltaBadge,
                      kpi.deltaRevenue >= 0 ? styles.deltaBadgeUp : styles.deltaBadgeDown,
                    ]}
                  >
                    <Text
                      style={[
                        styles.deltaBadgeText,
                        kpi.deltaRevenue >= 0 ? styles.deltaTextUp : styles.deltaTextDown,
                      ]}
                      numberOfLines={1}
                    >
                      {kpi.deltaRevenue >= 0
                        ? `+${kpi.deltaRevenue.toFixed(1)}% vs prev`
                        : `${kpi.deltaRevenue.toFixed(1)}% vs prev`}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.personalKpiSub} numberOfLines={1}>Selected period sales</Text>
                )}
              </View>
              <View style={styles.kpiIconCircle}>
                <Ionicons name="trending-up-outline" size={24} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.personalKpiNote} numberOfLines={1}>
              Total revenue billed across upfront collections and customer credits
            </Text>
          </Card>

          {/* 2-Column Row: My Invoices Raised + Average Ticket Size */}
          <View style={styles.secondaryKpiRow}>
            {/* Card 2: Invoices Raised */}
            <Card style={styles.secondaryKpiCard}>
              <View style={styles.kpiHeaderSmall}>
                <Text style={styles.personalKpiLabel} numberOfLines={1}>Invoices</Text>
                <Ionicons name="receipt-outline" size={15} color="#10B981" />
              </View>
              <Text
                style={styles.secondaryKpiVal}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {kpi?.periodInvoices || 0}
              </Text>
              <View style={styles.todayInvoicesBadge}>
                <Text style={styles.todayInvoicesBadgeText} numberOfLines={1}>
                  {kpi?.todayInvoices || 0} raised today
                </Text>
              </View>
              <Text style={styles.kpiFootnote} numberOfLines={1}>
                {kpi?.totalInvoices || 0} lifetime invoices
              </Text>
            </Card>

            {/* Card 3: Average Ticket Size */}
            <Card style={styles.secondaryKpiCard}>
              <View style={styles.kpiHeaderSmall}>
                <Text style={styles.personalKpiLabel} numberOfLines={1}>Avg Ticket</Text>
                <Ionicons name="wallet-outline" size={15} color="#A855F7" />
              </View>
              <Text
                style={[styles.secondaryKpiVal, { color: '#C084FC' }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {formatINR(avgTicket)}
              </Text>
              <View style={[styles.todayInvoicesBadge, { backgroundColor: 'rgba(168, 85, 247, 0.12)' }]}>
                <Text style={[styles.todayInvoicesBadgeText, { color: '#C084FC' }]} numberOfLines={1}>
                  Avg order value
                </Text>
              </View>
              <Text style={styles.kpiFootnote} numberOfLines={1}>Direct retail billing</Text>
            </Card>
          </View>
        </View>

        {/* Reusable Sales Timeline (Personal daily sales trend) */}
        <SalesTimelineCard
          trendData={trend}
          title="My Sales Timeline"
          subtitle="Daily trend of invoices billed by your account"
          showSeriesToggle={false}
        />

        {/* Reusable Category Split Card */}
        {categories.length > 0 && (
          <View style={{ marginTop: 14 }}>
            <CategorySplitCard
              categories={categories}
              title="Categories Sold by Me"
              onManageCatalog={() => router.push('/(tabs)/stock')}
            />
          </View>
        )}

        {/* My Recent Invoices */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <View style={styles.titleRow}>
              <Ionicons name="receipt-outline" size={15} color="#FFFFFF" />
              <Text style={styles.sectionTitle}>My Recent Invoices</Text>
            </View>
            <Text style={styles.sectionSub}>Invoices created directly by you</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/invoices')}>
            <Text style={styles.sectionLink}>Go to Invoices →</Text>
          </TouchableOpacity>
        </View>

        {recentInvoices.length > 0 ? (
          recentInvoices.slice(0, 8).map((inv) => {
            const isUpi = inv.paymentMode === 'UPI';
            const isCash = inv.paymentMode === 'CASH';

            return (
              <Card key={inv.id} style={styles.recentInvoiceCard}>
                <View style={styles.recentRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <View style={styles.invNumberRow}>
                      <Text style={styles.recentInvoiceNo} numberOfLines={1}>#{inv.invoiceNo}</Text>
                      <View
                        style={[
                          styles.modeBadge,
                          isUpi
                            ? styles.modeBadgeUpi
                            : isCash
                            ? styles.modeBadgeCash
                            : styles.modeBadgeDefault,
                        ]}
                      >
                        <Text
                          style={[
                            styles.modeBadgeText,
                            isUpi
                              ? { color: '#38BDF8' }
                              : isCash
                              ? { color: '#10B981' }
                              : { color: Colors.dark.textSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          {inv.paymentMode || 'PAID'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.recentParty} numberOfLines={1} ellipsizeMode="tail">
                      {inv.partyName}
                    </Text>

                    <View style={styles.invMetaRow}>
                      <Text style={styles.recentDate}>{formatDateTime(inv.createdAt)}</Text>
                      {inv.partyPhone ? (
                        <TouchableOpacity
                          style={styles.invPhoneBtn}
                          onPress={() => handleCall(inv.partyPhone)}
                        >
                          <Ionicons name="call" size={10} color="#10B981" />
                          <Text style={styles.invPhoneText} numberOfLines={1}>{inv.partyPhone}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <Text
                      style={styles.recentAmount}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {formatINR(inv.total)}
                    </Text>
                    <StatusBadge status={inv.status} size="sm" />
                  </View>
                </View>
              </Card>
            );
          })
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptySub}>No invoices created yet for this period</Text>
          </Card>
        )}

        {/* Operational Policy Callout (Matching Web Dashboard) */}
        <View style={styles.policyCard}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF" style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.policyTitle}>Sales Operational Policy</Text>
            <Text style={styles.policyText}>
              Sales staff can collect full payments upfront (Cash/UPI), accept partial payments, or offer customer store credit. Approving returns and payouts remain restricted to Administrators.
            </Text>
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
  topGreetingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderRadius: 18,
    backgroundColor: '#16161A',
    borderWidth: 1,
    borderColor: Colors.dark.borderMedium,
    marginBottom: 8,
    gap: 12,
  },
  personalBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  personalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  personalBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.5,
  },
  greetingTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  greetingSub: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
    maxWidth: 240,
  },
  createInvoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  createInvoiceBtnText: {
    color: '#09090B',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 12,
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 16,
    marginBottom: 10,
  },
  sectionSub: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  sectionLink: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#38BDF8',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kpiCardsCol: {
    gap: 10,
  },
  personalKpiCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#16161A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  personalKpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  personalKpiLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  personalKpiValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    marginVertical: 4,
    letterSpacing: -0.5,
  },
  personalKpiSub: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
  },
  personalKpiNote: {
    fontSize: 10.5,
    color: Colors.dark.textTertiary,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.07)',
  },
  kpiIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.borderMedium,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  deltaBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  deltaBadgeUp: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
  deltaBadgeDown: {
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
  },
  deltaBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  deltaTextUp: {
    color: '#10B981',
  },
  deltaTextDown: {
    color: '#EF4444',
  },
  secondaryKpiRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryKpiCard: {
    flex: 1,
    padding: 13,
    borderRadius: 14,
  },
  kpiHeaderSmall: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  secondaryKpiVal: {
    fontSize: 19,
    fontWeight: '900',
    color: '#FFFFFF',
    marginVertical: 4,
  },
  todayInvoicesBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  todayInvoicesBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  kpiFootnote: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
  },
  recentInvoiceCard: {
    padding: 13,
    marginBottom: 8,
  },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recentInvoiceNo: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  modeBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  modeBadgeUpi: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  modeBadgeCash: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  modeBadgeDefault: {
    backgroundColor: Colors.dark.secondary,
  },
  modeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  recentParty: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.dark.text,
    marginTop: 2,
  },
  invMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  recentDate: {
    fontSize: 10.5,
    color: Colors.dark.textTertiary,
  },
  invPhoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  invPhoneText: {
    fontSize: 10.5,
    color: '#10B981',
    fontFamily: 'monospace',
  },
  recentAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  policyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#16161A',
    borderWidth: 1,
    borderColor: Colors.dark.borderMedium,
    marginTop: 14,
  },
  policyTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  policyText: {
    fontSize: 10.5,
    color: Colors.dark.textSecondary,
    lineHeight: 15,
  },
  emptyCard: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
  },
});
