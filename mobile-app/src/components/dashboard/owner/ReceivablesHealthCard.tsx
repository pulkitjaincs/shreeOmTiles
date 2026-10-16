import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Colors } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { formatINR, cleanPhoneNumber } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';
import { ReceivablesHealth } from '../types';

interface ReceivablesHealthCardProps {
  receivablesHealth?: ReceivablesHealth;
  onViewCreditLedger?: () => void;
}

export function ReceivablesHealthCard({
  receivablesHealth,
  onViewCreditLedger,
}: ReceivablesHealthCardProps) {
  const data = receivablesHealth || {
    unpaid: { count: 0, total: 0 },
    partial: { count: 0, total: 0 },
    overdue: { count: 0, total: 0 },
    topPending: [],
  };

  const handleCall = (phone?: string) => {
    const clean = cleanPhoneNumber(phone);
    if (clean) {
      Linking.openURL(`tel:${clean}`).catch(() => {
        Alert.alert('Error', 'Unable to initiate phone call');
      });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Credit & Receivables Health</Text>
          <Text style={styles.sub}>Outstanding customer balances & default risk</Text>
        </View>
        {onViewCreditLedger ? (
          <TouchableOpacity onPress={onViewCreditLedger}>
            <Text style={styles.link}>Credit Ledger →</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 3 Status Mini-Cards */}
      <View style={styles.miniGrid}>
        {/* Unpaid */}
        <View style={[styles.miniCard, { borderColor: 'rgba(255, 255, 255, 0.12)' }]}>
          <Text style={styles.miniLabel} numberOfLines={1}>Unpaid</Text>
          <Text
            style={styles.miniVal}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {formatINR(data.unpaid?.total)}
          </Text>
          <Text style={styles.miniSub} numberOfLines={1}>
            {data.unpaid?.count || 0} bills
          </Text>
        </View>

        {/* Partial */}
        <View style={[styles.miniCard, { borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
          <Text style={[styles.miniLabel, { color: '#FCD34D' }]} numberOfLines={1}>Partial</Text>
          <Text
            style={[styles.miniVal, { color: '#F59E0B' }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {formatINR(data.partial?.total)}
          </Text>
          <Text style={styles.miniSub} numberOfLines={1}>
            {data.partial?.count || 0} bills
          </Text>
        </View>

        {/* Overdue */}
        <View style={[styles.miniCard, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
          <Text style={[styles.miniLabel, { color: '#FCA5A5' }]} numberOfLines={1}>Overdue</Text>
          <Text
            style={[styles.miniVal, { color: '#EF4444' }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {formatINR(data.overdue?.total)}
          </Text>
          <Text style={styles.miniSub} numberOfLines={1}>
            {data.overdue?.count || 0} overdue
          </Text>
        </View>
      </View>

      {/* Top Pending Debtor Customer Accounts */}
      {data.topPending && data.topPending.length > 0 && (
        <Card style={styles.topCard}>
          <Text style={styles.topTitle}>Top Accounts with Pending Dues</Text>
          {data.topPending.map((debtor, idx) => (
            <View key={`debtor-${debtor.partyId || 'party'}-${debtor.invoiceNo || idx}`} style={styles.debtorRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.debtorName} numberOfLines={1} ellipsizeMode="tail">
                  {debtor.partyName || 'Customer'}
                </Text>
                <View style={styles.debtorMeta}>
                  <Text style={styles.debtorPhone}>{debtor.phone || 'No Phone'}</Text>
                  {debtor.invoiceNo ? (
                    <Text style={styles.debtorInv}>• #{debtor.invoiceNo}</Text>
                  ) : null}
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <Text
                  style={styles.debtorAmount}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {formatINR(debtor.amountDue)}
                </Text>
                <View style={styles.debtorBadge}>
                  <Text style={styles.debtorBadgeText}>{debtor.status || 'PENDING'}</Text>
                </View>
              </View>
              {debtor.phone ? (
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={() => handleCall(debtor.phone)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="call" size={13} color="#10B981" />
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  sub: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  link: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#38BDF8',
  },
  miniGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  miniCard: {
    flex: 1,
    backgroundColor: '#141417',
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
  },
  miniLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  miniVal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    marginVertical: 3,
  },
  miniSub: {
    fontSize: 9,
    color: Colors.dark.textTertiary,
  },
  topCard: {
    padding: 14,
    borderRadius: 16,
  },
  topTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  debtorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    gap: 8,
  },
  debtorName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  debtorMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  debtorPhone: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
    fontFamily: 'monospace',
  },
  debtorInv: {
    fontSize: 11,
    color: '#38BDF8',
  },
  debtorAmount: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#EF4444',
  },
  debtorBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  debtorBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#EF4444',
  },
  callBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});
