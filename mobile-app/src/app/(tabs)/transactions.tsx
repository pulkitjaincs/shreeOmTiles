import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
} from 'react-native';
import { mobileApiRequest, cachedMobileApiRequest } from '@/lib/api';
import { Colors } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SearchBar } from '@/components/ui/SearchBar';
import { FilterPills } from '@/components/ui/FilterPills';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatINR, formatDate, formatDateTime } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';
import { Party, PaymentRecord } from '@/components/payments/types';
import { RecordSettlementModal } from '@/components/payments/RecordSettlementModal';

export default function TransactionsScreen() {
  const [activeTab, setActiveTab] = useState<'PAYMENTS' | 'CREDITS'>('PAYMENTS');

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [credits, setCredits] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [parties, setParties] = useState<Party[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('ALL');

  // Settlement Modal State
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [settleDirection, setSettleDirection] = useState<'COLLECT' | 'PAY'>('COLLECT');
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [settleAmount, setSettleAmount] = useState('');

  // Confirming state
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const loadData = useCallback(async (force = false) => {
    try {
      const [paymentsData, creditsData, statsData, partiesData] = await Promise.all([
        cachedMobileApiRequest<any[]>('/payments', {
          forceRefresh: force,
          onRevalidate: (fresh) => {
            const pList = Array.isArray(fresh) ? fresh : (fresh as any)?.data || [];
            setPayments(pList);
          },
        }),
        cachedMobileApiRequest<any[]>('/payments/credits', {
          forceRefresh: force,
          onRevalidate: (fresh) => setCredits(fresh || []),
        }).catch(() => []),
        cachedMobileApiRequest<any>('/payments/stats', {
          forceRefresh: force,
          onRevalidate: (fresh) => setStats(fresh),
        }).catch(() => null),
        cachedMobileApiRequest<Party[]>('/parties', {
          forceRefresh: force,
          onRevalidate: (fresh) => setParties(fresh || []),
        }).catch(() => []),
      ]);

      const pList = Array.isArray(paymentsData) ? paymentsData : (paymentsData as any)?.data || [];
      setPayments(pList);
      setCredits(creditsData || []);
      setStats(statsData);
      setParties(partiesData || []);
    } catch (err: any) {
      console.warn('Transactions load error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  // Confirm Pending Payment
  const handleConfirmPayment = async (paymentId: string) => {
    setConfirmingId(paymentId);
    try {
      await mobileApiRequest(`/payments/${paymentId}/confirm`, {
        method: 'PATCH',
      });
      Alert.alert('Confirmed', 'Payment marked as confirmed in ERP!');
      loadData(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to confirm payment');
    } finally {
      setConfirmingId(null);
    }
  };

  // Filtered payments
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch =
        p.party?.name?.toLowerCase().includes(q) ||
        p.invoice?.invoiceNumber?.toLowerCase().includes(q) ||
        (p.upiTxnRef && p.upiTxnRef.toLowerCase().includes(q)) ||
        (p.upiUtr && p.upiUtr.toLowerCase().includes(q));

      const matchesMode = modeFilter === 'ALL' || p.mode === modeFilter;
      return matchesSearch && matchesMode;
    });
  }, [payments, search, modeFilter]);

  // Filtered credits
  const filteredCredits = useMemo(() => {
    return credits.filter((c) => {
      const q = search.toLowerCase();
      return (
        c.party?.name?.toLowerCase().includes(q) ||
        c.invoice?.invoiceNo?.toLowerCase().includes(q) ||
        c.partyName?.toLowerCase().includes(q)
      );
    });
  }, [credits, search]);

  return (
    <View style={styles.screen}>
      <Header
        title="Transactions & Ledger"
        subtitle="Cashflow, UPI Inflows & Credit Ledger"
        rightAction={{
          icon: 'add',
          onPress: () => {
            setSelectedPartyId(parties[0]?.id || '');
            setSettleAmount('');
            setSettleDirection('COLLECT');
            setSettleModalOpen(true);
          },
        }}
      />

      {/* Financial Summary Cards */}
      {stats ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll}>
          <Card style={styles.statMiniCard}>
            <Text style={styles.statMiniLabel}>Total Collected</Text>
            <Text style={styles.statMiniVal}>{formatINR(stats.totalCollected || stats.todayInflow || 0)}</Text>
            <Text style={styles.statMiniSub}>Lifetime Inflows</Text>
          </Card>

          <Card style={styles.statMiniCard}>
            <Text style={styles.statMiniLabel}>Credit Receivables</Text>
            <Text style={[styles.statMiniVal, { color: '#F59E0B' }]}>
              {formatINR(stats.creditReceivables || stats.totalOutstandingCredit || 0)}
            </Text>
            <Text style={styles.statMiniSub}>Due from Customers</Text>
          </Card>

          <Card style={styles.statMiniCard}>
            <Text style={styles.statMiniLabel}>Pending UPI</Text>
            <Text style={[styles.statMiniVal, { color: '#38BDF8' }]}>
              {stats.pendingUpiCount || 0}
            </Text>
            <Text style={styles.statMiniSub}>Awaiting UTR check</Text>
          </Card>

          <Card style={styles.statMiniCard}>
            <Text style={styles.statMiniLabel}>Supplier Payables</Text>
            <Text style={[styles.statMiniVal, { color: '#EF4444' }]}>
              {formatINR(stats.creditPayables || stats.todayOutflow || 0)}
            </Text>
            <Text style={styles.statMiniSub}>Outflows owed</Text>
          </Card>
        </ScrollView>
      ) : null}

      {/* View Switcher */}
      <View style={styles.viewToggleBar}>
        <TouchableOpacity
          style={[styles.toggleTab, activeTab === 'PAYMENTS' && styles.toggleTabActive]}
          onPress={() => setActiveTab('PAYMENTS')}
        >
          <Ionicons
            name="swap-horizontal"
            size={16}
            color={activeTab === 'PAYMENTS' ? '#09090B' : Colors.dark.textSecondary}
          />
          <Text
            style={[styles.toggleTabText, activeTab === 'PAYMENTS' && styles.toggleTabTextActive]}
          >
            Payments Stream ({payments.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleTab, activeTab === 'CREDITS' && styles.toggleTabActive]}
          onPress={() => setActiveTab('CREDITS')}
        >
          <Ionicons
            name="book-outline"
            size={16}
            color={activeTab === 'CREDITS' ? '#09090B' : Colors.dark.textSecondary}
          />
          <Text
            style={[styles.toggleTabText, activeTab === 'CREDITS' && styles.toggleTabTextActive]}
          >
            Credit Ledger ({credits.length})
          </Text>
        </TouchableOpacity>
      </View>

      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder={
          activeTab === 'PAYMENTS'
            ? 'Search party, invoice #, UTR ref...'
            : 'Search customer name in ledger...'
        }
      />

      {activeTab === 'PAYMENTS' ? (
        <FilterPills
          options={[
            { label: 'All Modes', value: 'ALL' },
            { label: 'UPI', value: 'UPI' },
            { label: 'Cash', value: 'CASH' },
            { label: 'Credit', value: 'CREDIT' },
          ]}
          selected={modeFilter}
          onSelect={setModeFilter}
        />
      ) : null}

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading transactions...</Text>
        </View>
      ) : activeTab === 'PAYMENTS' ? (
        <FlatList
          data={filteredPayments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
          }
          ListEmptyComponent={
            <EmptyState
              icon="swap-horizontal-outline"
              title="No Payments Found"
              description="No transaction records found matching your filter."
            />
          }
          renderItem={({ item }) => {
            const isInflow = item.type !== 'OUTFLOW';
            return (
              <Card elevated style={styles.paymentCard}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.typeBadgeRow}>
                      <View
                        style={[
                          styles.typeBadge,
                          isInflow ? styles.typeInflow : styles.typeOutflow,
                        ]}
                      >
                        <Ionicons
                          name={isInflow ? 'arrow-down-outline' : 'arrow-up-outline'}
                          size={12}
                          color={isInflow ? '#10B981' : '#EF4444'}
                        />
                        <Text
                          style={[
                            styles.typeText,
                            { color: isInflow ? '#10B981' : '#EF4444' },
                          ]}
                        >
                          {isInflow ? 'INFLOW' : 'OUTFLOW'}
                        </Text>
                      </View>
                      <View style={styles.modeBadge}>
                        <Text style={styles.modeBadgeText}>{item.mode}</Text>
                      </View>
                    </View>

                    <Text style={styles.partyTitle}>{item.party?.name || 'Counter Customer'}</Text>
                    {item.invoice ? (
                      <Text style={styles.invoiceRef}>Invoice #{item.invoice.invoiceNumber}</Text>
                    ) : null}
                    <Text style={styles.timestamp}>{formatDateTime(item.createdAt)}</Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      style={[
                        styles.paymentAmount,
                        { color: isInflow ? '#FFFFFF' : '#EF4444' },
                      ]}
                    >
                      {isInflow ? `+${formatINR(item.amount)}` : `-${formatINR(item.amount)}`}
                    </Text>
                    <StatusBadge status={item.status} size="sm" />
                  </View>
                </View>

                {item.upiTxnRef || item.upiUtr ? (
                  <View style={styles.utrBox}>
                    <Text style={styles.utrText}>UPI Ref / UTR: {item.upiTxnRef || item.upiUtr}</Text>
                  </View>
                ) : null}

                {item.status === 'PENDING' ? (
                  <Button
                    title="Confirm Receipt"
                    size="sm"
                    variant="primary"
                    loading={confirmingId === item.id}
                    onPress={() => handleConfirmPayment(item.id)}
                    style={{ marginTop: 10 }}
                  />
                ) : null}
              </Card>
            );
          }}
        />
      ) : (
        <FlatList
          data={filteredCredits}
          keyExtractor={(item, index) => item.id || item.partyId || String(index)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
          }
          ListEmptyComponent={
            <EmptyState
              icon="book-outline"
              title="Clean Ledger"
              description="No outstanding customer credit balances found."
            />
          }
          renderItem={({ item }) => (
            <Card elevated style={styles.creditCard}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.partyTitle}>{item.party?.name || item.partyName}</Text>
                  <Text style={styles.invoiceRef}>
                    Ref: {item.invoice?.invoiceNo ? `Invoice #${item.invoice.invoiceNo}` : 'Credit Balance'}
                  </Text>
                  <Text style={styles.timestamp}>
                    {item.dueDate ? `Due Date: ${formatDate(item.dueDate)}` : `Invoices: ${item.invoiceCount || 1}`}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.creditDueAmount, { color: '#F59E0B' }]}>
                    {formatINR(item.amountDue || item.totalDue || 0)}
                  </Text>
                  <StatusBadge status={item.status || 'UNPAID'} size="sm" />
                </View>
              </View>

              <View style={styles.cardActionsRow}>
                <Button
                  title="Settle Credit"
                  size="sm"
                  variant="primary"
                  onPress={() => {
                    setSelectedPartyId(item.partyId || item.party?.id);
                    setSettleAmount(String(item.amountDue || item.totalDue || ''));
                    setSettleDirection(item.type === 'PAYABLE' ? 'PAY' : 'COLLECT');
                    setSettleModalOpen(true);
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          )}
        />
      )}

      {/* RECORD SETTLEMENT MODAL */}
      <RecordSettlementModal
        visible={settleModalOpen}
        onClose={() => setSettleModalOpen(false)}
        onSuccess={() => loadData(true)}
        parties={parties}
        initialDirection={settleDirection}
        initialPartyId={selectedPartyId}
        initialAmount={settleAmount}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  statsScroll: {
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
  },
  statMiniCard: {
    padding: 12,
    marginRight: 10,
    minWidth: 130,
    borderRadius: 12,
  },
  statMiniLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
  },
  statMiniVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    marginVertical: 4,
  },
  statMiniSub: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
  },
  viewToggleBar: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 3,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 4,
  },
  toggleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  toggleTabActive: {
    backgroundColor: '#FFFFFF',
  },
  toggleTabText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  toggleTabTextActive: {
    color: '#09090B',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 10,
  },
  paymentCard: {
    padding: 14,
    marginBottom: 10,
  },
  creditCard: {
    padding: 14,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  typeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
  },
  typeInflow: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  typeOutflow: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  typeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  modeBadge: {
    backgroundColor: Colors.dark.secondary,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  partyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  invoiceRef: {
    fontSize: 11.5,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  timestamp: {
    fontSize: 10.5,
    color: Colors.dark.textTertiary,
    marginTop: 4,
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  creditDueAmount: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  utrBox: {
    backgroundColor: '#16161A',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
  utrText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontFamily: 'monospace',
  },
  cardActionsRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
});
