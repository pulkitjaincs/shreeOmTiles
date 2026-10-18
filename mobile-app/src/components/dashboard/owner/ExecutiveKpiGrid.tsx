import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme, useThemedStyles, ThemeColors } from '@/lib/theme-context';
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
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
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

      {/* Row 1: Invoiced Sales & Invoices Count */}
      <View style={styles.kpiRow}>
        {/* KPI 1: Invoiced Sales */}
        <TouchableOpacity
          style={[styles.kpiCard, styles.kpiCardPrimary]}
          onPress={onNavigateInvoices}
          activeOpacity={0.75}
        >
          <View style={styles.headerRow}>
            <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">
              Invoiced Sales
            </Text>
            <View style={styles.iconBox}>
              <Ionicons name="receipt-outline" size={13} color={colors.text} />
            </View>
          </View>
          <Text
            style={styles.value}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {formatINR(data.totalRevenue)}
          </Text>
          <View style={styles.footerRow}>
            <Text style={styles.subText} numberOfLines={1} ellipsizeMode="tail">
              {data.periodInvoices || 0} invoices
            </Text>
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
                  numberOfLines={1}
                >
                  {data.deltaRevenue >= 0 ? `↑+${data.deltaRevenue}%` : `↓${data.deltaRevenue}%`}
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
            <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">
              Invoices Count
            </Text>
            <View style={styles.iconBox}>
              <Ionicons name="trending-up-outline" size={13} color={colors.text} />
            </View>
          </View>
          <Text
            style={styles.value}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {data.periodInvoices || 0}
          </Text>
          <View style={styles.footerRow}>
            <Text style={styles.subText} numberOfLines={1} ellipsizeMode="tail">
              {data.todayInvoices || 0} today
            </Text>
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
                  numberOfLines={1}
                >
                  {data.deltaInvoices >= 0 ? `↑+${data.deltaInvoices}%` : `↓${data.deltaInvoices}%`}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Row 2: Collected (Inflow) & With Drivers */}
      <View style={styles.kpiRow}>
        {/* KPI 3: Collected Inflow */}
        <TouchableOpacity
          style={[styles.kpiCard, styles.kpiCardEmerald]}
          onPress={onNavigateTransactions}
          activeOpacity={0.75}
        >
          <View style={styles.headerRow}>
            <Text
              style={[styles.label, { color: '#10B981' }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              Collected Inflow
            </Text>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Ionicons name="wallet-outline" size={13} color="#10B981" />
            </View>
          </View>
          <Text
            style={[styles.value, { color: '#10B981' }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {formatINR(data.totalCollected)}
          </Text>
          <View style={styles.footerRow}>
            <Text style={styles.subText} numberOfLines={1} ellipsizeMode="tail">
              {data.totalCollectedCount || 0} confirmed txns
            </Text>
          </View>
        </TouchableOpacity>

        {/* KPI 4: With Drivers */}
        <TouchableOpacity
          style={[styles.kpiCard, styles.kpiCardAmber]}
          onPress={onNavigateDeliveries}
          activeOpacity={0.75}
        >
          <View style={styles.headerRow}>
            <Text
              style={[styles.label, { color: '#F59E0B' }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              With Drivers
            </Text>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
              <Ionicons name="bicycle-outline" size={13} color="#F59E0B" />
            </View>
          </View>
          <Text
            style={[styles.value, { color: '#F59E0B' }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {formatINR(data.cashToBeCollectedFromDrivers)}
          </Text>
          <View style={styles.footerRow}>
            <Text style={styles.subText} numberOfLines={1} ellipsizeMode="tail">
              {data.pendingDriverDeliveriesCount || 0} waiting handover
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Row 3: Customer Receivables & Store Payables */}
      <View style={styles.kpiRow}>
        {/* KPI 5: Customer Receivables */}
        <TouchableOpacity
          style={[styles.kpiCard, styles.kpiCardRose]}
          onPress={onNavigateTransactions}
          activeOpacity={0.75}
        >
          <View style={styles.headerRow}>
            <Text
              style={[styles.label, { color: '#EF4444' }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              Receivables
            </Text>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
              <Ionicons name="arrow-down-outline" size={13} color="#EF4444" />
            </View>
          </View>
          <Text
            style={[styles.value, { color: '#EF4444' }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {formatINR(data.receivablesTotal)}
          </Text>
          <View style={styles.footerRow}>
            <Text style={styles.subText} numberOfLines={1} ellipsizeMode="tail">
              {data.receivablesCount || 0} unpaid balances
            </Text>
          </View>
        </TouchableOpacity>

        {/* KPI 6: Store Payables */}
        <TouchableOpacity
          style={[styles.kpiCard, styles.kpiCardAmberLight]}
          onPress={onNavigateTransactions}
          activeOpacity={0.75}
        >
          <View style={styles.headerRow}>
            <Text
              style={[styles.label, { color: '#FCD34D' }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              Store Payables
            </Text>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(252, 211, 77, 0.15)' }]}>
              <Ionicons name="arrow-up-outline" size={13} color="#FCD34D" />
            </View>
          </View>
          <Text
            style={[styles.value, { color: '#FCD34D' }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {formatINR(data.payablesTotal)}
          </Text>
          <View style={styles.footerRow}>
            <Text style={styles.subText} numberOfLines={1} ellipsizeMode="tail">
              {data.payablesCount || 0} store debts
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      marginTop: 8,
      marginBottom: 4,
    },
    sectionHeader: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 10,
      letterSpacing: -0.2,
    },
    kpiRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 10,
    },
    kpiCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      minHeight: 96,
      justifyContent: 'space-between',
    },
    kpiCardPrimary: {
      borderColor: colors.borderMedium,
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
      marginBottom: 4,
    },
    label: {
      flex: 1,
      fontSize: 9.5,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
      marginRight: 4,
    },
    iconBox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      backgroundColor: colors.cardElevated,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    value: {
      fontSize: 16.5,
      fontWeight: '900',
      color: colors.text,
      letterSpacing: -0.3,
      marginVertical: 2,
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 2,
      gap: 4,
    },
    subText: {
      flex: 1,
      fontSize: 9.5,
      color: colors.textTertiary,
    },
    deltaBadge: {
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
      flexShrink: 0,
    },
    deltaBadgeUp: {
      backgroundColor: 'rgba(16, 185, 129, 0.14)',
    },
    deltaBadgeDown: {
      backgroundColor: 'rgba(239, 68, 68, 0.14)',
    },
    deltaBadgeText: {
      fontSize: 9,
      fontWeight: '800',
    },
    deltaTextUp: {
      color: '#10B981',
    },
    deltaTextDown: {
      color: '#EF4444',
    },
  });
