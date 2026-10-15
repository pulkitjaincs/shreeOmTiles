import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/theme';
import { formatINR } from '@/lib/formatters';
import { FinancialStats, ActiveTabType } from './types';

interface PaymentStatsRowProps {
  stats: FinancialStats;
  activeTab: ActiveTabType;
  onTabChange: (tab: ActiveTabType) => void;
}

export function PaymentStatsRow({ stats, activeTab, onTabChange }: PaymentStatsRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.statsScroll}
      contentContainerStyle={styles.scrollContent}
    >
      {/* 1. Total Billed */}
      <Card style={styles.statMiniCard}>
        <View style={styles.statCardHeader}>
          <Text style={styles.statMiniLabel}>Total Billed</Text>
          <Ionicons name="receipt-outline" size={15} color={Colors.dark.textSecondary} />
        </View>
        <Text style={styles.statMiniVal}>{formatINR(stats.totalSales || 0)}</Text>
        <Text style={styles.statMiniSub}>Across all invoices</Text>
      </Card>

      {/* 2. Total Collected (Taps switch to 'inflows') */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onTabChange('inflows')}
      >
        <Card
          style={[
            styles.statMiniCard,
            activeTab === 'inflows' && styles.statCardActiveEmerald,
            { borderColor: 'rgba(16, 185, 129, 0.3)', backgroundColor: 'rgba(16, 185, 129, 0.08)' },
          ]}
        >
          <View style={styles.statCardHeader}>
            <Text style={[styles.statMiniLabel, { color: '#10B981' }]}>Total Collected</Text>
            <Ionicons name="checkmark-circle" size={15} color="#10B981" />
          </View>
          <Text style={[styles.statMiniVal, { color: '#10B981' }]}>
            {formatINR(stats.totalCollected || 0)}
          </Text>
          <Text style={[styles.statMiniSub, { color: 'rgba(16, 185, 129, 0.75)' }]}>
            Cash + UPI Inflows
          </Text>
        </Card>
      </TouchableOpacity>

      {/* 3. Total Paid Out (Taps switch to 'all') */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onTabChange('all')}
      >
        <Card
          style={[
            styles.statMiniCard,
            activeTab === 'all' && styles.statCardActiveAmber,
            { borderColor: 'rgba(245, 158, 11, 0.3)', backgroundColor: 'rgba(245, 158, 11, 0.08)' },
          ]}
        >
          <View style={styles.statCardHeader}>
            <Text style={[styles.statMiniLabel, { color: '#F59E0B' }]}>Total Paid Out</Text>
            <Ionicons name="arrow-up-circle" size={15} color="#F59E0B" />
          </View>
          <Text style={[styles.statMiniVal, { color: '#F59E0B' }]}>
            {formatINR(stats.totalPaidOut || 0)}
          </Text>
          <Text style={[styles.statMiniSub, { color: 'rgba(245, 158, 11, 0.75)' }]}>
            Paid to vendors/parties
          </Text>
        </Card>
      </TouchableOpacity>

      {/* 4. Customer Dues (Taps switch to 'dues') */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onTabChange('dues')}
      >
        <Card
          style={[
            styles.statMiniCard,
            activeTab === 'dues' && styles.statCardActiveRose,
            { borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.08)' },
          ]}
        >
          <View style={styles.statCardHeader}>
            <Text style={[styles.statMiniLabel, { color: '#EF4444' }]}>Customer Dues</Text>
            <Ionicons name="trending-down" size={15} color="#EF4444" />
          </View>
          <Text style={[styles.statMiniVal, { color: '#EF4444' }]}>
            {formatINR(stats.pendingReceivables || 0)}
          </Text>
          <Text style={[styles.statMiniSub, { color: 'rgba(239, 68, 68, 0.75)' }]}>
            Parties owe to store
          </Text>
        </Card>
      </TouchableOpacity>

      {/* 5. Store Payables (Taps switch to 'payables') */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onTabChange('payables')}
      >
        <Card
          style={[
            styles.statMiniCard,
            activeTab === 'payables' && styles.statCardActiveAmber,
            { borderColor: 'rgba(245, 158, 11, 0.4)', backgroundColor: 'rgba(245, 158, 11, 0.1)' },
          ]}
        >
          <View style={styles.statCardHeader}>
            <Text style={[styles.statMiniLabel, { color: '#F59E0B' }]}>Store Payables</Text>
            <Ionicons name="trending-up" size={15} color="#F59E0B" />
          </View>
          <Text style={[styles.statMiniVal, { color: '#F59E0B' }]}>
            {formatINR(stats.creditsOwed || 0)}
          </Text>
          <Text style={[styles.statMiniSub, { color: 'rgba(245, 158, 11, 0.8)' }]}>
            Store owes to parties
          </Text>
        </Card>
      </TouchableOpacity>

      {/* 6. Collection Split (Cash vs UPI) */}
      <Card
        style={[
          styles.statMiniCard,
          { borderColor: 'rgba(56, 189, 248, 0.3)', backgroundColor: 'rgba(56, 189, 248, 0.08)' },
        ]}
      >
        <Text style={[styles.statMiniLabel, { color: '#38BDF8', marginBottom: 4 }]}>
          Collection Split
        </Text>
        <View style={styles.splitRow}>
          <Text style={styles.splitLabel}>Cash:</Text>
          <Text style={styles.splitValCash}>{formatINR(stats.cashCollected || 0)}</Text>
        </View>
        <View style={styles.splitRow}>
          <Text style={styles.splitLabel}>UPI:</Text>
          <Text style={styles.splitValUpi}>{formatINR(stats.upiCollected || 0)}</Text>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  statsScroll: {
    marginVertical: 10,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  statMiniCard: {
    width: 148,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.card,
    justifyContent: 'space-between',
    minHeight: 90,
  },
  statCardActiveEmerald: {
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  statCardActiveAmber: {
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  statCardActiveRose: {
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statMiniLabel: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statMiniVal: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.dark.text,
    fontFamily: 'monospace',
    marginTop: 4,
    marginBottom: 2,
  },
  statMiniSub: {
    fontSize: 9,
    color: Colors.dark.textSecondary,
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  splitLabel: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
  },
  splitValCash: {
    fontSize: 12,
    fontWeight: '800',
    color: '#10B981',
    fontFamily: 'monospace',
  },
  splitValUpi: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38BDF8',
    fontFamily: 'monospace',
  },
});
