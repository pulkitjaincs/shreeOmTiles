import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/theme';
import { formatINR } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';
import { DashboardKPI } from '../types';

interface ExecutiveKpiGridProps {
  kpi?: DashboardKPI;
  onNavigateInvoices: () => void;
  onNavigateTransactions: () => void;
  onNavigateDeliveries: () => void;
}

export function ExecutiveKpiGrid({
  kpi,
  onNavigateInvoices,
  onNavigateTransactions,
  onNavigateDeliveries,
}: ExecutiveKpiGridProps) {
  const data = kpi || {
    totalRevenue: 0,
    deltaRevenue: null,
    periodInvoices: 0,
    deltaInvoices: null,
    todayInvoices: 0,
    totalCollected: 0,
    totalCollectedCount: 0,
    cashToBeCollectedFromDrivers: 0,
    pendingDriverDeliveriesCount: 0,
    receivablesTotal: 0,
    receivablesCount: 0,
    payablesTotal: 0,
    payablesCount: 0,
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>Executive KPI Grid</Text>
      <View style={styles.grid}>
        {/* KPI 1: Invoiced Sales */}
        <TouchableOpacity
          style={[styles.kpiCard, styles.kpiCardPrimary]}
          onPress={onNavigateInvoices}
          activeOpacity={0.75}
        >
          <View style={styles.headerRow}>
            <Text style={styles.label}>Invoiced Sales</Text>
            <View style={styles.iconBox}>
              <Ionicons name="receipt-outline" size={13} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.value}>{formatINR(data.totalRevenue)}</Text>
          <View style={styles.footerRow}>
            <Text style={styles.subText}>{data.periodInvoices || 0} invoices</Text>
            {data.deltaRevenue !== null && data.deltaRevenue !== undefined && (
              <View
                style={[
                  styles.deltaBadge,
                  data.deltaRevenue >= 0 ? styles.deltaBadgeUp : styles.deltaBadgeDown,
                ]}
              >
                <Text
                  style={[
                    styles.deltaBadgeText,
                    data.deltaRevenue >= 0 ? styles.deltaTextUp : styles.deltaTextDown,
                  ]}
                >
                  {data.deltaRevenue >= 0 ? `↑ +${data.deltaRevenue}%` : `↓ ${data.deltaRevenue}%`}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* KPI 2: Invoices Count */}
        <TouchableOpacity
          style={styles.kpiCard}
          onPress={onNavigateInvoices}
          activeOpacity={0.75}
        >
          <View style={styles.headerRow}>
            <Text style={styles.label}>Invoices Count</Text>
            <View style={styles.iconBox}>
              <Ionicons name="trending-up-outline" size={13} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.value}>{data.periodInvoices || 0}</Text>
          <View style={styles.footerRow}>
            <Text style={styles.subText}>{data.todayInvoices || 0} today</Text>
            {data.deltaInvoices !== null && data.deltaInvoices !== undefined && (
              <View
                style={[
                  styles.deltaBadge,
                  data.deltaInvoices >= 0 ? styles.deltaBadgeUp : styles.deltaBadgeDown,
                ]}
              >
                <Text
                  style={[
                    styles.deltaBadgeText,
                    data.deltaInvoices >= 0 ? styles.deltaTextUp : styles.deltaTextDown,
                  ]}
                >
                  {data.deltaInvoices >= 0 ? `↑ +${data.deltaInvoices}%` : `↓ ${data.deltaInvoices}%`}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* KPI 3: Collected Inflow */}
        <TouchableOpacity
          style={[styles.kpiCard, styles.kpiCardEmerald]}
          onPress={onNavigateTransactions}
          activeOpacity={0.75}
        >
          <View style={styles.headerRow}>
            <Text style={[styles.label, { color: '#10B981' }]}>Collected (Inflow)</Text>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Ionicons name="wallet-outline" size={13} color="#10B981" />
            </View>
          </View>
          <Text style={[styles.value, { color: '#10B981' }]}>
            {formatINR(data.totalCollected)}
          </Text>
          <Text style={styles.subText}>{data.totalCollectedCount || 0} confirmed txns</Text>
        </TouchableOpacity>

        {/* KPI 4: With Drivers */}
        <TouchableOpacity
          style={[styles.kpiCard, styles.kpiCardAmber]}
          onPress={onNavigateDeliveries}
          activeOpacity={0.75}
        >
          <View style={styles.headerRow}>
            <Text style={[styles.label, { color: '#F59E0B' }]}>With Drivers</Text>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
              <Ionicons name="bicycle-outline" size={13} color="#F59E0B" />
            </View>
          </View>
          <Text style={[styles.value, { color: '#F59E0B' }]}>
            {formatINR(data.cashToBeCollectedFromDrivers)}
          </Text>
          <Text style={styles.subText}>
            {data.pendingDriverDeliveriesCount || 0} orders waiting handover
          </Text>
        </TouchableOpacity>

        {/* KPI 5: Customer Receivables */}
        <TouchableOpacity
          style={[styles.kpiCard, styles.kpiCardRose]}
          onPress={onNavigateTransactions}
          activeOpacity={0.75}
        >
          <View style={styles.headerRow}>
            <Text style={[styles.label, { color: '#EF4444' }]}>Receivables</Text>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
              <Ionicons name="arrow-down-outline" size={13} color="#EF4444" />
            </View>
          </View>
          <Text style={[styles.value, { color: '#EF4444' }]}>
            {formatINR(data.receivablesTotal)}
          </Text>
          <Text style={styles.subText}>{data.receivablesCount || 0} unpaid balances</Text>
        </TouchableOpacity>

        {/* KPI 6: Store Payables */}
        <TouchableOpacity
          style={[styles.kpiCard, styles.kpiCardAmberLight]}
          onPress={onNavigateTransactions}
          activeOpacity={0.75}
        >
          <View style={styles.headerRow}>
            <Text style={[styles.label, { color: '#FCD34D' }]}>Store Payables</Text>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(252, 211, 77, 0.15)' }]}>
              <Ionicons name="arrow-up-outline" size={13} color="#FCD34D" />
            </View>
          </View>
          <Text style={[styles.value, { color: '#FCD34D' }]}>
            {formatINR(data.payablesTotal)}
          </Text>
          <Text style={styles.subText}>{data.payablesCount || 0} debts we owe</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    marginBottom: 6,
  },
  sectionHeader: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    width: '48.5%',
    backgroundColor: '#141417',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 13,
  },
  kpiCardPrimary: {
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  kpiCardEmerald: {
    borderColor: 'rgba(16, 185, 129, 0.25)',
    backgroundColor: 'rgba(16, 185, 129, 0.04)',
  },
  kpiCardAmber: {
    borderColor: 'rgba(245, 158, 11, 0.25)',
    backgroundColor: 'rgba(245, 158, 11, 0.04)',
  },
  kpiCardRose: {
    borderColor: 'rgba(239, 68, 68, 0.25)',
    backgroundColor: 'rgba(239, 68, 68, 0.04)',
  },
  kpiCardAmberLight: {
    borderColor: 'rgba(252, 211, 77, 0.25)',
    backgroundColor: 'rgba(252, 211, 77, 0.04)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  iconBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: Colors.dark.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 17.5,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  subText: {
    fontSize: 10.5,
    color: Colors.dark.textTertiary,
    marginTop: 3,
  },
  deltaBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  deltaBadgeUp: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
  deltaBadgeDown: {
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
  },
  deltaBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  deltaTextUp: {
    color: '#10B981',
  },
  deltaTextDown: {
    color: '#EF4444',
  },
});
