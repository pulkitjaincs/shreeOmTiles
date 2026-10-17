import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/theme';
import { cachedMobileApiRequest } from '@/lib/api';
import { formatINR, formatDate } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';

export function DayBookView() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [filter, setFilter] = useState<'ALL' | 'PAYMENTS' | 'EXPENSES' | 'PURCHASES'>('ALL');

  const loadDayBook = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const res = await cachedMobileApiRequest<any>('/analytics/day-book', {
        forceRefresh: force,
        onRevalidate: (fresh) => {
          if (fresh) setData(fresh);
        },
      });
      if (res) setData(res);
    } catch (err: any) {
      console.warn('Day-book load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDayBook();
  }, [loadDayBook]);

  const summary = data?.summary || {
    openingCash: 0,
    cashIn: 0,
    cashOut: 0,
    expenseCash: 0,
    netCashFlow: 0,
    closingCash: 0,
    digital: { upiIn: 0, bankIn: 0, totalDigital: 0 },
  };

  const payments = data?.transactions?.payments || [];
  const expenses = data?.transactions?.expenses || [];
  const purchases = data?.transactions?.purchases || [];

  return (
    <View style={styles.container}>
      {/* Top Header Row with Refresh */}
      <View style={styles.headerRow}>
        <View style={styles.dateBadge}>
          <Ionicons name="calendar-outline" size={13} color="#FFFFFF" />
          <Text style={styles.dateBadgeText}>
            {data?.date ? formatDate(data.date) : 'Today'}
          </Text>
        </View>
        <Button
          title="Refresh Book"
          icon="refresh-outline"
          variant="secondary"
          size="sm"
          loading={loading && !data}
          onPress={() => loadDayBook(true)}
          style={{ height: 32, paddingHorizontal: 10 }}
        />
      </View>

      {/* Till Cash KPI Header */}
      <View style={styles.kpiGrid}>
        <Card style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Opening Till Cash</Text>
          <Text style={styles.kpiValue}>{formatINR(summary.openingCash)}</Text>
          <Text style={styles.kpiSub}>Morning carry-over</Text>
        </Card>

        <Card style={[styles.kpiCard, { borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
          <Text style={styles.kpiLabel}>Cash Inflow</Text>
          <Text style={[styles.kpiValue, { color: '#10B981' }]}>
            +{formatINR(summary.cashIn)}
          </Text>
          <Text style={styles.kpiSub}>Counter & deliveries</Text>
        </Card>

        <Card style={[styles.kpiCard, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
          <Text style={styles.kpiLabel}>Cash Outflow</Text>
          <Text style={[styles.kpiValue, { color: '#EF4444' }]}>
            -{formatINR(summary.cashOut + summary.expenseCash)}
          </Text>
          <Text style={styles.kpiSub}>Expenses & payables</Text>
        </Card>

        <Card style={[styles.kpiCard, { borderColor: 'rgba(56, 189, 248, 0.3)' }]}>
          <Text style={styles.kpiLabel}>Net Closing Cash</Text>
          <Text style={[styles.kpiValue, { color: '#38BDF8' }]}>
            {formatINR(summary.closingCash)}
          </Text>
          <Text style={styles.kpiSub}>Current till balance</Text>
        </Card>
      </View>

      {/* Digital UPI / Bank Summary Card */}
      <Card style={styles.digitalCard}>
        <View style={styles.digitalRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="qr-code-outline" size={16} color="#A855F7" />
            <Text style={styles.digitalTitle}>Digital Collections</Text>
          </View>
          <Text style={styles.digitalValue}>
            {formatINR(summary.digital?.totalDigital || 0)}
          </Text>
        </View>
        <Text style={styles.digitalSub}>
          UPI: {formatINR(summary.digital?.upiIn || 0)} • Bank Transfer:{' '}
          {formatINR(summary.digital?.bankIn || 0)}
        </Text>
      </Card>

      {/* Filter Tabs */}
      <View style={styles.tabToggle}>
        <TouchableOpacity
          style={[styles.tabBtn, filter === 'ALL' && styles.tabBtnActive]}
          onPress={() => setFilter('ALL')}
        >
          <Text style={[styles.tabText, filter === 'ALL' && styles.tabTextActive]}>
            All ({payments.length + expenses.length + purchases.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, filter === 'PAYMENTS' && styles.tabBtnActive]}
          onPress={() => setFilter('PAYMENTS')}
        >
          <Text style={[styles.tabText, filter === 'PAYMENTS' && styles.tabTextActive]}>
            Inflows ({payments.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, filter === 'EXPENSES' && styles.tabBtnActive]}
          onPress={() => setFilter('EXPENSES')}
        >
          <Text style={[styles.tabText, filter === 'EXPENSES' && styles.tabTextActive]}>
            Expenses ({expenses.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Transaction List */}
      {loading && !data ? (
        <ActivityIndicator size="small" color="#FFFFFF" style={{ marginTop: 24 }} />
      ) : (
        <View style={{ paddingBottom: 24 }}>
          {/* Payments / Inflows */}
          {(filter === 'ALL' || filter === 'PAYMENTS') &&
            payments.map((p: any) => (
              <Card key={`p-${p.id}`} style={styles.txCard}>
                <View style={styles.txRow}>
                  <View style={styles.txIconWrapIn}>
                    <Ionicons name="arrow-down" size={14} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txParty}>{p.partyName}</Text>
                    <Text style={styles.txSub}>
                      Ref: #{p.refNo} • {p.mode}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.txAmount, { color: '#10B981' }]}>
                      +{formatINR(p.amount)}
                    </Text>
                    <Text style={styles.txTime}>{formatDate(p.time)}</Text>
                  </View>
                </View>
              </Card>
            ))}

          {/* Expenses */}
          {(filter === 'ALL' || filter === 'EXPENSES') &&
            expenses.map((e: any) => (
              <Card key={`e-${e.id}`} style={styles.txCard}>
                <View style={styles.txRow}>
                  <View style={styles.txIconWrapOut}>
                    <Ionicons name="receipt-outline" size={14} color="#EF4444" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txParty}>{e.paidTo || e.category}</Text>
                    <Text style={styles.txSub}>
                      {e.expenseNo} • {e.category} ({e.paymentMode})
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.txAmount, { color: '#EF4444' }]}>
                      -{formatINR(e.amount)}
                    </Text>
                    <Text style={styles.txTime}>{formatDate(e.time)}</Text>
                  </View>
                </View>
              </Card>
            ))}

          {/* Purchases */}
          {filter === 'ALL' &&
            purchases.map((pu: any) => (
              <Card key={`pu-${pu.id}`} style={styles.txCard}>
                <View style={styles.txRow}>
                  <View style={styles.txIconWrapPur}>
                    <Ionicons name="cart-outline" size={14} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txParty}>{pu.supplierName || 'Supplier'}</Text>
                    <Text style={styles.txSub}>
                      {pu.purchaseNo} • Inward Purchase
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.txAmount, { color: '#F59E0B' }]}>
                      {formatINR(pu.amount)}
                    </Text>
                    <Text style={styles.txTime}>{formatDate(pu.time)}</Text>
                  </View>
                </View>
              </Card>
            ))}

          {payments.length === 0 && expenses.length === 0 && purchases.length === 0 ? (
            <Text style={styles.emptyText}>No cash transactions recorded for today.</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dark.cardElevated,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  dateBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  kpiCard: {
    width: '48.5%',
    padding: 10,
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    marginVertical: 2,
    fontFamily: 'monospace',
  },
  kpiSub: {
    fontSize: 9.5,
    color: Colors.dark.textTertiary,
  },
  digitalCard: {
    padding: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
    borderColor: 'rgba(168, 85, 247, 0.25)',
    borderWidth: 1,
    borderRadius: 10,
  },
  digitalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  digitalTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#E9D5FF',
  },
  digitalValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  digitalSub: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 4,
  },
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 3,
    marginBottom: 10,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  tabTextActive: {
    color: '#09090B',
  },
  txCard: {
    padding: 11,
    marginBottom: 7,
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  txIconWrapIn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIconWrapOut: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIconWrapPur: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txParty: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  txSub: {
    fontSize: 10.5,
    color: Colors.dark.textTertiary,
    marginTop: 1,
  },
  txAmount: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  txTime: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
    marginTop: 1,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 20,
  },
});
