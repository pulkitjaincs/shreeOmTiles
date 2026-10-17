import React, { useState, useEffect, useCallback, useMemo, useDeferredValue } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SearchBar } from '@/components/ui/SearchBar';
import { Colors } from '@/constants/theme';
import { cachedMobileApiRequest } from '@/lib/api';
import { formatINR, formatDate } from '@/lib/formatters';
import { CreateExpenseModal } from './CreateExpenseModal';

export function ExpensesView() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const loadExpenses = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const res = await cachedMobileApiRequest<any[]>('/expenses', {
        forceRefresh: force,
        onRevalidate: (fresh) => {
          const list = Array.isArray(fresh) ? fresh : (fresh as any)?.data || [];
          setExpenses(list);
        },
      });
      const list = Array.isArray(res) ? res : (res as any)?.data || [];
      setExpenses(list);
    } catch (err: any) {
      console.warn('Expenses load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const deferredSearch = useDeferredValue(search);

  const filteredExpenses = useMemo(() => {
    if (!deferredSearch.trim()) return expenses;
    const q = deferredSearch.toLowerCase().trim();
    return expenses.filter(
      (item) =>
        item.title?.toLowerCase().includes(q) ||
        item.notes?.toLowerCase().includes(q) ||
        item.expenseNo?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q) ||
        item.paidTo?.toLowerCase().includes(q),
    );
  }, [expenses, deferredSearch]);

  const { totalExpenseAmt, cashExpenseAmt, digitalExpenseAmt } = useMemo(() => {
    let total = 0;
    let cash = 0;
    for (const e of expenses) {
      const amt = Number(e.amount || 0);
      total += amt;
      if (e.paymentMode === 'CASH') cash += amt;
    }
    return {
      totalExpenseAmt: total,
      cashExpenseAmt: cash,
      digitalExpenseAmt: total - cash,
    };
  }, [expenses]);

  return (
    <View style={styles.container}>
      {/* Top Header Row with Refresh & Record Expense Button */}
      <View style={styles.topRow}>
        <Button
          title=""
          icon="refresh-outline"
          variant="ghost"
          size="sm"
          loading={loading && expenses.length > 0}
          onPress={() => loadExpenses(true)}
          style={styles.refreshBtn}
        />
        <Button
          title="Record Expense"
          icon="add-circle-outline"
          variant="primary"
          size="sm"
          onPress={() => setModalOpen(true)}
          style={styles.recordBtn}
        />
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiGrid}>
        <Card style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Total Outflow</Text>
          <Text style={[styles.kpiValue, { color: '#EF4444' }]}>
            {formatINR(totalExpenseAmt)}
          </Text>
          <Text style={styles.kpiSub}>{expenses.length} expenses</Text>
        </Card>

        <Card style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Cash Payouts</Text>
          <Text style={styles.kpiValue}>{formatINR(cashExpenseAmt)}</Text>
          <Text style={styles.kpiSub}>Till cash outflow</Text>
        </Card>

        <Card style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Digital / Bank</Text>
          <Text style={styles.kpiValue}>{formatINR(digitalExpenseAmt)}</Text>
          <Text style={styles.kpiSub}>UPI / NEFT outflow</Text>
        </Card>
      </View>

      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search expenses, vendors, categories..."
      />

      <View style={styles.scrollList}>
        {loading && expenses.length === 0 ? (
          <ActivityIndicator size="small" color="#FFFFFF" style={{ marginTop: 24 }} />
        ) : filteredExpenses.length === 0 ? (
          <Text style={styles.emptyText}>No expenses recorded.</Text>
        ) : (
          filteredExpenses.map((item) => (
            <Card key={item.id} style={styles.expenseCard}>
              <View style={styles.expenseTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.expenseTitle}>{item.notes || item.title || item.category}</Text>
                  <Text style={styles.expenseSub}>
                    #{item.expenseNo} • {formatDate(item.expenseDate || item.createdAt)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.expenseAmount}>-{formatINR(item.amount)}</Text>
                  <View style={styles.categoryPill}>
                    <Text style={styles.categoryPillText}>{item.category}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.expenseBottomRow}>
                <Text style={styles.paidToText}>
                  {item.paidTo ? `Paid to: ${item.paidTo} • ` : ''}Mode: {item.paymentMode}
                </Text>
                {item.notes ? (
                  <Text style={styles.notesText} numberOfLines={1}>
                    {item.notes}
                  </Text>
                ) : null}
              </View>
            </Card>
          ))
        )}
      </View>

      <CreateExpenseModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => loadExpenses(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    paddingHorizontal: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordBtn: {
    height: 38,
    paddingHorizontal: 14,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  kpiCard: {
    flex: 1,
    padding: 10,
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  kpiLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#FFFFFF',
    marginVertical: 2,
    fontFamily: 'monospace',
  },
  kpiSub: {
    fontSize: 9,
    color: Colors.dark.textTertiary,
  },
  scrollList: {
    paddingBottom: 24,
    paddingTop: 8,
  },
  expenseCard: {
    padding: 12,
    marginBottom: 8,
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  expenseTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  expenseTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  expenseSub: {
    fontSize: 10.5,
    color: Colors.dark.textTertiary,
    marginTop: 2,
  },
  expenseAmount: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#EF4444',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  categoryPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F87171',
    textTransform: 'uppercase',
  },
  expenseBottomRow: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  paidToText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
  },
  notesText: {
    fontSize: 10.5,
    color: Colors.dark.textTertiary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 24,
  },
});
