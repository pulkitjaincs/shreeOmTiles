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
import { Ionicons } from '@expo/vector-icons';
import { DashboardData, DatePreset } from './types';

// Shared Components
import { DateFilterBar } from './shared/DateFilterBar';
import { SalesTimelineCard } from './shared/SalesTimelineCard';

// Owner Specific Components
import { ExecutiveKpiGrid } from './owner/ExecutiveKpiGrid';
import { DriverCashHandoverQueue } from './owner/DriverCashHandoverQueue';
import { SalesStaffPerformance } from './owner/SalesStaffPerformance';
import { PaymentCategoryBreakdown } from './owner/PaymentCategoryBreakdown';
import { ReceivablesHealthCard } from './owner/ReceivablesHealthCard';
import { RecentTransactionsStream } from './owner/RecentTransactionsStream';

interface OwnerDashboardViewProps {
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
  handoverInProgress: string | null;
  handleVerifyHandover: (deliveryId: string) => void;
  router: any;
}

export function OwnerDashboardView({
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
  handoverInProgress,
  handleVerifyHandover,
  router,
}: OwnerDashboardViewProps) {
  const kpi = analyticsData?.kpi;
  const pendingDeliveries = analyticsData?.pendingDriverDeliveries || [];
  const salesmen = analyticsData?.salesmenPerformance || [];
  const recHealth = analyticsData?.receivablesHealth;
  const revenueTrend = analyticsData?.revenueTrend || [];
  const paymentSplit = analyticsData?.paymentSplit || [];
  const categorySplit = analyticsData?.categorySplit || [];
  const recentTransactions = analyticsData?.recentTransactions || [];

  return (
    <View style={styles.screen}>
      <Header
        title="Executive Dashboard"
        subtitle="Live Intel & Store Analytics"
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
        {/* Top Executive Live Intel Bar with + New Invoice action */}
        <View style={styles.topExecutiveBar}>
          <View style={{ flex: 1 }}>
            <View style={styles.liveIntelBadgeRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveIntelText}>LIVE INTEL</Text>
            </View>
            <Text style={styles.topBarTitle}>Executive Overview</Text>
            <Text style={styles.topBarSub}>
              Real-time sales, collections, driver handovers & staff performance.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.newInvoiceBtn}
            onPress={() => router.push('/(tabs)/invoices')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color="#09090B" />
            <Text style={styles.newInvoiceBtnText}>New Invoice</Text>
          </TouchableOpacity>
        </View>

        {/* Date Filter Bar with custom date inputs */}
        <DateFilterBar
          preset={preset}
          setPreset={setPreset}
          dateFrom={dateFrom}
          dateTo={dateTo}
          setDateFrom={setDateFrom}
          setDateTo={setDateTo}
          onApplyDateRange={onApplyDateRange}
        />

        {/* 1. 6 Executive Primary KPI Cards */}
        <ExecutiveKpiGrid
          kpi={kpi}
          onNavigateInvoices={() => router.push('/(tabs)/invoices')}
          onNavigateTransactions={() => router.push('/(tabs)/transactions')}
          onNavigateDeliveries={() => router.push('/(tabs)/deliveries')}
        />

        {/* 2. Driver Cash Handover Queue */}
        <DriverCashHandoverQueue
          deliveries={pendingDeliveries}
          cashTotal={kpi?.cashToBeCollectedFromDrivers || 0}
          handoverInProgress={handoverInProgress}
          onVerifyHandover={handleVerifyHandover}
          onNavigateDeliveries={() => router.push('/(tabs)/deliveries')}
        />

        {/* 3. Revenue & Cashflow Timeline (Interactive Multi-Series Chart) */}
        <SalesTimelineCard
          trendData={revenueTrend}
          title="Revenue & Cashflow Timeline"
          subtitle="Daily trend of Invoiced, Collected, and Credit"
          showSeriesToggle={true}
        />

        {/* 4. Sales Staff Overview List with search */}
        <SalesStaffPerformance
          salesmen={salesmen}
          onManageStaff={() => router.push('/(tabs)/more')}
        />

        {/* 5. Payment & Product Category Breakdown */}
        <PaymentCategoryBreakdown
          paymentSplit={paymentSplit}
          categorySplit={categorySplit}
          onViewTransactions={() => router.push('/(tabs)/transactions')}
          onManageCatalog={() => router.push('/(tabs)/stock')}
        />

        {/* 6. Receivables & Credit Health with Top Debtors */}
        <ReceivablesHealthCard
          receivablesHealth={recHealth}
          onViewCreditLedger={() => router.push('/(tabs)/transactions')}
        />

        {/* 7. Recent Confirmed Transactions Stream */}
        <RecentTransactionsStream
          recentTransactions={recentTransactions}
          onViewLedger={() => router.push('/(tabs)/transactions')}
        />
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
  topExecutiveBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#16161A',
    borderWidth: 1,
    borderColor: Colors.dark.borderMedium,
    marginBottom: 8,
    gap: 12,
  },
  liveIntelBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveIntelText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.6,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  topBarSub: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  newInvoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
  newInvoiceBtnText: {
    color: '#09090B',
    fontSize: 12,
    fontWeight: '800',
  },
});
