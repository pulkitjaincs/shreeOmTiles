import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { formatINR } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';
import { CategorySplitCard } from '../shared/CategorySplitCard';

interface PaymentCategoryBreakdownProps {
  paymentSplit: { name: string; value: number; count: number }[];
  categorySplit: { name: string; value: number }[];
  onViewTransactions?: () => void;
  onManageCatalog?: () => void;
}

export function PaymentCategoryBreakdown({
  paymentSplit,
  categorySplit,
  onViewTransactions,
  onManageCatalog,
}: PaymentCategoryBreakdownProps) {
  const totalPaymentRevenue = useMemo(() => {
    return paymentSplit.reduce((sum, p) => sum + Number(p.value || 0), 0) || 1;
  }, [paymentSplit]);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Payment & Category Breakdown</Text>
      <View style={styles.splitsGrid}>
        {/* Payment Methods Card */}
        <Card style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Ionicons name="qr-code-outline" size={15} color="#38BDF8" />
              <Text style={styles.headerTitle}>Payment Methods</Text>
            </View>
            {onViewTransactions ? (
              <TouchableOpacity onPress={onViewTransactions}>
                <Text style={styles.headerLink}>Transactions →</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {paymentSplit.length === 0 ? (
            <Text style={styles.emptyText}>No payments processed in this period yet.</Text>
          ) : (
            paymentSplit.map((pm, idx) => {
              const count = pm.count || 0;
              const pct = Math.round((Number(pm.value || 0) / totalPaymentRevenue) * 100);

              const getModeDetails = (mode: string) => {
                switch (mode?.toUpperCase()) {
                  case 'UPI':
                    return { label: 'UPI', color: '#38BDF8' };
                  case 'CASH':
                    return { label: 'Cash', color: '#10B981' };
                  case 'BANK_TRANSFER':
                  case 'BANK':
                    return { label: 'Bank Transfer', color: '#818CF8' };
                  case 'SPLIT':
                    return { label: 'Split Payment', color: '#A855F7' };
                  case 'CREDIT':
                    return { label: 'Credit', color: '#EF4444' };
                  default:
                    return { label: mode || 'Other', color: '#94A3B8' };
                }
              };

              const { label, color } = getModeDetails(pm.name);

              return (
                <View key={idx} style={styles.row}>
                  <View style={styles.rowMeta}>
                    <View style={styles.labelRow}>
                      <View style={[styles.dot, { backgroundColor: color }]} />
                      <Text style={styles.name} numberOfLines={1}>{label}</Text>
                      <Text style={styles.countText} numberOfLines={1}>({count} inv)</Text>
                    </View>
                    <Text style={styles.amount} numberOfLines={1}>
                      {formatINR(pm.value)} ({pct}%)
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${pct}%`, backgroundColor: color },
                      ]}
                    />
                  </View>
                </View>
              );
            })
          )}
        </Card>

        {/* Sales by Category Card */}
        {categorySplit.length > 0 && (
          <CategorySplitCard
            categories={categorySplit}
            title="Sales by Category"
            onManageCatalog={onManageCatalog}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  splitsGrid: {
    gap: 10,
  },
  card: {
    padding: 15,
    borderRadius: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  row: {
    marginBottom: 10,
  },
  rowMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
    gap: 8,
  },
  labelRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  name: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  countText: {
    fontSize: 10.5,
    color: Colors.dark.textTertiary,
  },
  amount: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    flexShrink: 0,
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
  emptyText: {
    fontSize: 11.5,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
