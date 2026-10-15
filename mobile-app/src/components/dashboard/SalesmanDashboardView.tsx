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
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatINR, formatDate } from '@/lib/formatters';

interface SalesmanDashboardViewProps {
  user: any;
  analyticsData: any;
  refreshing: boolean;
  onRefresh: () => void;
  router: any;
}

export function SalesmanDashboardView({
  user,
  analyticsData,
  refreshing,
  onRefresh,
  router,
}: SalesmanDashboardViewProps) {
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
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySub: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
  },
});
