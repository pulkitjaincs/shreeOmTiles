import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { formatINR, formatDate } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';
import { TransactionItem } from '../types';

interface RecentTransactionsStreamProps {
  recentTransactions?: TransactionItem[];
  onViewLedger?: () => void;
}

export function RecentTransactionsStream({
  recentTransactions = [],
  onViewLedger,
}: RecentTransactionsStreamProps) {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <View style={styles.titleRow}>
            <View style={styles.liveDot} />
            <Text style={styles.title}>Recent Confirmed Transactions</Text>
          </View>
          <Text style={styles.sub}>Verified physical cash & digital UPI credits</Text>
        </View>
        {onViewLedger ? (
          <TouchableOpacity onPress={onViewLedger}>
            <Text style={styles.link}>Full Ledger →</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {recentTransactions.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No confirmed transactions recorded yet.</Text>
        </Card>
      ) : (
        recentTransactions.slice(0, 8).map((tx) => {
          const isOutflow = tx.type === 'OUTFLOW';
          const isDriverHandover = Boolean(tx.driverName);
          const isCash = tx.mode === 'CASH';

          return (
            <Card key={tx.id} style={styles.card}>
              <View style={styles.row}>
                {/* Icon */}
                <View
                  style={[
                    styles.iconCircle,
                    isOutflow && { borderColor: 'rgba(245, 158, 11, 0.4)' },
                  ]}
                >
                  <Ionicons
                    name={
                      isOutflow
                        ? 'arrow-up-circle-outline'
                        : tx.mode === 'UPI'
                        ? 'qr-code-outline'
                        : 'cash-outline'
                    }
                    size={17}
                    color={isOutflow ? '#F59E0B' : '#FFFFFF'}
                  />
                </View>

                {/* Content */}
                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={styles.partyRow}>
                    <Text style={styles.partyName} numberOfLines={1} ellipsizeMode="tail">
                      {tx.partyName}
                    </Text>
                    {tx.invoiceNo && tx.invoiceNo !== 'Direct' && (
                      <Text style={styles.invoiceTag} numberOfLines={1}>
                        #{tx.invoiceNo}
                      </Text>
                    )}
                  </View>

                  {/* Badges & Date */}
                  <View style={styles.metaRow}>
                    {isOutflow ? (
                      <View style={[styles.sourceBadge, styles.badgeAmber]}>
                        <Text style={[styles.sourceText, { color: '#FCD34D' }]} numberOfLines={1}>
                          Store Paid Out ({tx.mode})
                        </Text>
                      </View>
                    ) : isDriverHandover ? (
                      <View style={[styles.sourceBadge, styles.badgeEmerald]}>
                        <Ionicons name="bicycle-outline" size={11} color="#10B981" />
                        <Text style={[styles.sourceText, { color: '#10B981' }]} numberOfLines={1}>
                          Handed by {tx.driverName}
                        </Text>
                      </View>
                    ) : isCash ? (
                      <View style={[styles.sourceBadge, styles.badgeMuted]}>
                        <Text style={styles.sourceText} numberOfLines={1}>Counter Cash</Text>
                      </View>
                    ) : (
                      <View style={[styles.sourceBadge, styles.badgeSky]}>
                        <Text style={[styles.sourceText, { color: '#38BDF8' }]} numberOfLines={1}>
                          {tx.mode} Inflow
                        </Text>
                      </View>
                    )}

                    <Text style={styles.dateText}>{formatDate(tx.paidAt)}</Text>
                  </View>

                  {tx.confirmedByName ? (
                    <Text style={styles.confirmedBy} numberOfLines={1}>
                      Confirmed by {tx.confirmedByName}
                    </Text>
                  ) : null}
                </View>

                {/* Amount */}
                <View style={{ alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                  <Text
                    style={[
                      styles.amount,
                      isOutflow ? { color: '#F59E0B' } : { color: '#10B981' },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {isOutflow ? `- ${formatINR(tx.amount)}` : `+ ${formatINR(tx.amount)}`}
                  </Text>
                  <View style={styles.confirmedBadge}>
                    <Text style={styles.confirmedBadgeText}>✓ CONFIRMED</Text>
                  </View>
                </View>
              </View>
            </Card>
          );
        })
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
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
  card: {
    padding: 12,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.dark.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.borderMedium,
  },
  partyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  partyName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.text,
    flexShrink: 1,
  },
  invoiceTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
    flexShrink: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  sourceBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sourceText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  badgeMuted: {
    backgroundColor: Colors.dark.secondary,
  },
  badgeEmerald: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  badgeSky: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  badgeAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  dateText: {
    fontSize: 10.5,
    color: Colors.dark.textTertiary,
  },
  confirmedBy: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
    marginTop: 2,
  },
  amount: {
    fontSize: 13.5,
    fontWeight: '800',
    flexShrink: 0,
  },
  confirmedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  confirmedBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#10B981',
  },
  emptyCard: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 11.5,
    color: Colors.dark.textSecondary,
  },
});
