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
} from 'react-native';
import { mobileApiRequest, cachedMobileApiRequest } from '@/lib/api';
import { Colors } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { SearchBar } from '@/components/ui/SearchBar';
import { FilterPills } from '@/components/ui/FilterPills';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatINR } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';
import {
  Party,
  PaymentRecord,
  CreditLedgerRecord,
  PendingItem,
  PendingCreditLedger,
  FinancialStats,
  ActiveTabType,
  PaymentStatsRow,
  TransactionTabsBar,
  CustomerDuesCard,
  StorePayablesCard,
  TransactionHistoryCard,
  CreditLedgerCard,
  RecordSettlementModal,
  RecordCreditModal,
} from '@/components/payments';

type TransactionListItem = PendingItem | PaymentRecord | CreditLedgerRecord;

export default function TransactionsScreen() {
  const [activeTab, setActiveTab] = useState<ActiveTabType>('dues');

  // Data states matching web-dashboard
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [creditLedgers, setCreditLedgers] = useState<CreditLedgerRecord[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [stats, setStats] = useState<FinancialStats>({
    totalSales: 0,
    totalCollected: 0,
    totalPaidOut: 0,
    cashCollected: 0,
    upiCollected: 0,
    pendingReceivables: 0,
    creditsOwed: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('ALL');

  // Modal States
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [settleDirection, setSettleDirection] = useState<'COLLECT' | 'PAY'>('COLLECT');
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNotes, setSettleNotes] = useState('');
  const [settleInvoiceId, setSettleInvoiceId] = useState('');

  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditPartyId, setCreditPartyId] = useState('');

  // Confirming state for pending payments
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Load all data matching web-dashboard loadData()
  const loadData = useCallback(async (force = false) => {
    try {
      const [paymentsData, statsData, pendingData, creditsData, partiesData] = await Promise.all([
        cachedMobileApiRequest<PaymentRecord[]>('/payments', {
          forceRefresh: force,
          onRevalidate: (fresh) => {
            const list = Array.isArray(fresh) ? fresh : (fresh as any)?.data || [];
            setPayments(list);
          },
        }).catch(() => []),
        cachedMobileApiRequest<FinancialStats>('/payments/stats', {
          forceRefresh: force,
          onRevalidate: (fresh) => setStats(fresh),
        }).catch(() => ({
          totalSales: 0,
          totalCollected: 0,
          totalPaidOut: 0,
          cashCollected: 0,
          upiCollected: 0,
          pendingReceivables: 0,
          creditsOwed: 0,
        })),
        cachedMobileApiRequest<{ invoices: PendingItem[]; ledgers: PendingCreditLedger[] }>(
          '/payments/pending',
          { forceRefresh: force },
        ).catch(() => ({
          invoices: [],
          ledgers: [],
        })),
        cachedMobileApiRequest<CreditLedgerRecord[]>('/payments/credits', {
          forceRefresh: force,
          onRevalidate: (fresh) => setCreditLedgers(fresh || []),
        }).catch(() => []),
        cachedMobileApiRequest<Party[]>('/parties', {
          forceRefresh: force,
          onRevalidate: (fresh) => setParties(fresh || []),
        }).catch(() => []),
      ]);

      const pList = Array.isArray(paymentsData) ? paymentsData : (paymentsData as any)?.data || [];
      setPayments(pList);
      setStats(statsData);
      setCreditLedgers(creditsData || []);
      setParties(partiesData || []);

      // Unify pending items: pending invoices + unsettled credit ledgers
      const formattedPending: PendingItem[] = [
        ...(pendingData?.invoices || []).map((inv) => ({
          id: inv.id,
          invoiceNo: inv.invoiceNo,
          partyId: inv.partyId,
          partyName: inv.partyName,
          partyPhone: inv.partyPhone,
          total: inv.total,
          paid: inv.paid,
          remainingDue: inv.remainingDue,
          createdAt: inv.createdAt,
          status: inv.status,
          isCreditLedger: false,
          creditType: 'RECEIVABLE' as const,
        })),
        ...(pendingData?.ledgers || [])
          .filter(
            (cl) =>
              cl.type === 'PAYABLE' ||
              (!cl.invoiceId &&
                !(pendingData?.invoices || []).some(
                  (inv) => inv.id === cl.invoiceId || (cl.invoiceNo && inv.invoiceNo === cl.invoiceNo),
                )),
          )
          .map((cl) => ({
            id: cl.id,
            invoiceNo: cl.invoiceNo || (cl.type === 'PAYABLE' ? 'Store Payable' : 'Direct Party Credit'),
            partyId: cl.partyId,
            partyName: cl.partyName || 'Party',
            partyPhone: cl.partyPhone || '',
            total: cl.amountDue,
            paid: 0,
            remainingDue: cl.amountDue,
            createdAt: cl.createdAt,
            status: cl.status,
            isCreditLedger: true,
            creditType: cl.type as 'RECEIVABLE' | 'PAYABLE',
          })),
      ];
      setPendingItems(formattedPending);
    } catch (err: any) {
      console.warn('Transactions load error:', err.message);
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

  // Open Modal from a Pending Due or Payable Row
  const handleOpenActionForPending = (item: PendingItem) => {
    const isPayable = item.creditType === 'PAYABLE';
    setSettleDirection(isPayable ? 'PAY' : 'COLLECT');
    setSelectedPartyId(item.partyId);
    setSettleInvoiceId(item.isCreditLedger ? '' : item.id);
    setSettleAmount(item.remainingDue.toFixed(2));
    setSettleNotes(
      isPayable
        ? `Payment made to ${item.partyName} to settle payable debt`
        : item.invoiceNo
        ? `Payment received for ${item.invoiceNo}`
        : `Payment received from ${item.partyName}`,
    );
    setSettleModalOpen(true);
  };

  // Open Collect Modal from Header (Customer paying store)
  const handleOpenGeneralCollect = () => {
    setSettleDirection('COLLECT');
    setSelectedPartyId(parties[0]?.id || '');
    setSettleInvoiceId('');
    setSettleAmount('');
    setSettleNotes('');
    setSettleModalOpen(true);
  };

  // Open Pay Modal from Header (Store paying vendor/party)
  const handleOpenGeneralPay = () => {
    setSettleDirection('PAY');
    setSelectedPartyId(parties[0]?.id || '');
    setSettleInvoiceId('');
    setSettleAmount('');
    setSettleNotes('');
    setSettleModalOpen(true);
  };

  // Open Record Credit Modal
  const handleOpenRecordCredit = (partyId?: string) => {
    setCreditPartyId(partyId || parties[0]?.id || '');
    setCreditModalOpen(true);
  };

  // Separated Dues vs Payables
  const customerDues = useMemo(
    () => pendingItems.filter((item) => item.creditType === 'RECEIVABLE'),
    [pendingItems],
  );
  const storePayables = useMemo(
    () => pendingItems.filter((item) => item.creditType === 'PAYABLE'),
    [pendingItems],
  );

  const filteredDues = useMemo(() => {
    const q = search.toLowerCase().trim();
    return customerDues.filter(
      (item) =>
        item.partyName.toLowerCase().includes(q) ||
        item.partyPhone.includes(q) ||
        (item.invoiceNo && item.invoiceNo.toLowerCase().includes(q)),
    );
  }, [customerDues, search]);

  const filteredPayables = useMemo(() => {
    const q = search.toLowerCase().trim();
    return storePayables.filter(
      (item) =>
        item.partyName.toLowerCase().includes(q) ||
        item.partyPhone.includes(q) ||
        (item.invoiceNo && item.invoiceNo.toLowerCase().includes(q)),
    );
  }, [storePayables, search]);

  const filteredPayments = useMemo(() => {
    const q = search.toLowerCase().trim();
    return payments.filter((p) => {
      const partyName = p.invoice?.party?.name || p.party?.name || '';
      const invNo = p.invoice?.invoiceNo || '';
      const utr = p.upiUtr || p.upiTxnRef || '';
      const matchesSearch =
        partyName.toLowerCase().includes(q) || invNo.toLowerCase().includes(q) || utr.toLowerCase().includes(q);
      const matchesMode = modeFilter === 'ALL' || p.mode === modeFilter;
      return matchesSearch && matchesMode;
    });
  }, [payments, search, modeFilter]);

  const filteredInflows = useMemo(() => {
    return filteredPayments.filter(
      (p) => p.status === 'CONFIRMED' && p.type !== 'OUTFLOW',
    );
  }, [filteredPayments]);

  const filteredCredits = useMemo(() => {
    const q = search.toLowerCase().trim();
    return creditLedgers.filter((cl) => {
      const partyName = cl.party?.name || '';
      const invNo = cl.invoice?.invoiceNo || '';
      const notes = cl.notes || '';
      return partyName.toLowerCase().includes(q) || invNo.toLowerCase().includes(q) || notes.toLowerCase().includes(q);
    });
  }, [creditLedgers, search]);

  return (
    <View style={styles.screen}>
      <Header
        title="Transactions & Ledger"
        subtitle="Sales, Dues, Store Payables & UPI Inflows"
        rightAction={{
          icon: 'wallet-outline',
          onPress: handleOpenGeneralCollect,
        }}
      />

      <FlatList<TransactionListItem>
        data={
          activeTab === 'dues'
            ? filteredDues
            : activeTab === 'payables'
            ? filteredPayables
            : activeTab === 'all'
            ? filteredPayments
            : activeTab === 'inflows'
            ? filteredInflows
            : filteredCredits
        }
        keyExtractor={(item, idx) => item.id || String(idx)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {/* Quick Action Buttons Row (Matching Web Actions) */}
            <View style={styles.headerActionRow}>
              <TouchableOpacity
                style={styles.headerBtnCollect}
                onPress={handleOpenGeneralCollect}
                activeOpacity={0.8}
              >
                <Ionicons name="cash-outline" size={15} color="#FFFFFF" />
                <Text style={styles.headerBtnText}>Collect</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.headerBtnPay}
                onPress={handleOpenGeneralPay}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-up-circle-outline" size={15} color="#FFFFFF" />
                <Text style={styles.headerBtnText}>Pay Party</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.headerBtnCredit}
                onPress={() => handleOpenRecordCredit()}
                activeOpacity={0.8}
              >
                <Ionicons name="card-outline" size={15} color="#F59E0B" />
                <Text style={styles.headerBtnCreditText}>Record Credit</Text>
              </TouchableOpacity>
            </View>

            {/* Financial KPI Summary Cards (6 Cards matching PaymentStatsGrid) */}
            <PaymentStatsRow
              stats={stats}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />

            {/* 5-Tab Navigation Bar matching Web Dashboard */}
            <TransactionTabsBar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              duesCount={customerDues.length}
              payablesCount={storePayables.length}
              allCount={payments.length}
              inflowsCount={filteredInflows.length}
              creditsCount={creditLedgers.length}
            />

            {/* Search Input */}
            <View style={styles.searchContainer}>
              <SearchBar
                value={search}
                onChangeText={setSearch}
                placeholder={
                  activeTab === 'dues'
                    ? 'Search customer dues by name or phone...'
                    : activeTab === 'payables'
                    ? 'Search store payables by party...'
                    : activeTab === 'credits'
                    ? 'Search party in credit ledger...'
                    : 'Search party, invoice #, UTR ref...'
                }
              />
            </View>

            {/* Mode Filter Pills (Only on All Transactions tab) */}
            {activeTab === 'all' ? (
              <View style={styles.filterPillsContainer}>
                <FilterPills
                  options={[
                    { label: 'All Modes', value: 'ALL' },
                    { label: 'UPI', value: 'UPI' },
                    { label: 'Cash', value: 'CASH' },
                    { label: 'Credit', value: 'CREDIT' },
                    { label: 'Cheque', value: 'CHEQUE' },
                  ]}
                  selected={modeFilter}
                  onSelect={setModeFilter}
                />
              </View>
            ) : null}

            {/* Total Balance Banner for Customer Dues */}
            {activeTab === 'dues' && filteredDues.length > 0 ? (
              <View style={styles.duesHeaderBanner}>
                <Ionicons name="time" size={16} color="#EF4444" />
                <Text style={styles.duesBannerText}>
                  Total Pending to Collect:{' '}
                  <Text style={styles.duesAmountHighlight}>
                    {formatINR(filteredDues.reduce((s, i) => s + (i.remainingDue || 0), 0))}
                  </Text>
                </Text>
              </View>
            ) : null}

            {/* Total Balance Banner for Store Payables */}
            {activeTab === 'payables' && filteredPayables.length > 0 ? (
              <View style={styles.payablesHeaderBanner}>
                <Ionicons name="arrow-up-circle" size={16} color="#F59E0B" />
                <Text style={styles.payablesBannerText}>
                  Total Store Debts Owed:{' '}
                  <Text style={styles.payablesAmountHighlight}>
                    {formatINR(filteredPayables.reduce((s, i) => s + (i.remainingDue || 0), 0))}
                  </Text>
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading && !refreshing ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.loadingText}>Loading transactions data...</Text>
            </View>
          ) : activeTab === 'dues' ? (
            <EmptyState
              icon="checkmark-circle-outline"
              title="Zero Customer Dues"
              description="All customer invoices and credit ledgers are fully cleared!"
            />
          ) : activeTab === 'payables' ? (
            <EmptyState
              icon="shield-checkmark-outline"
              title="Zero Store Payables"
              description="No outstanding debts owed by the business to any vendors."
            />
          ) : activeTab === 'inflows' ? (
            <EmptyState
              icon="cash-outline"
              title="No Inflows Found"
              description="No settled payments found matching your filter."
            />
          ) : activeTab === 'credits' ? (
            <EmptyState
              icon="book-outline"
              title="Clean Ledger"
              description="No party credit ledger entries recorded."
            />
          ) : (
            <EmptyState
              icon="swap-horizontal-outline"
              title="No Transactions Found"
              description="No transaction records found matching your search."
            />
          )
        }
        renderItem={({ item }) => {
          if (activeTab === 'dues') {
            return (
              <CustomerDuesCard
                item={item as PendingItem}
                onCollect={handleOpenActionForPending}
              />
            );
          }

          if (activeTab === 'payables') {
            return (
              <StorePayablesCard
                item={item as PendingItem}
                onPay={handleOpenActionForPending}
              />
            );
          }

          if (activeTab === 'all' || activeTab === 'inflows') {
            return (
              <TransactionHistoryCard
                payment={item as PaymentRecord}
                confirmingId={confirmingId}
                onConfirm={handleConfirmPayment}
              />
            );
          }

          return (
            <CreditLedgerCard
              credit={item as CreditLedgerRecord}
              onSettle={handleOpenActionForPending}
            />
          );
        }}
      />

      {/* Settlement / Disbursement Modal (Inflow & Outflow) */}
      <RecordSettlementModal
        visible={settleModalOpen}
        onClose={() => setSettleModalOpen(false)}
        onSuccess={() => {
          setSettleModalOpen(false);
          loadData(true);
        }}
        parties={parties}
        onPartyCreated={(newParty) => setParties((prev) => [newParty, ...prev])}
        initialDirection={settleDirection}
        initialPartyId={selectedPartyId}
        initialAmount={settleAmount}
        initialNotes={settleNotes}
        initialInvoiceId={settleInvoiceId}
      />

      {/* Credit / Advance Ledger Modal */}
      <RecordCreditModal
        visible={creditModalOpen}
        onClose={() => setCreditModalOpen(false)}
        onSuccess={() => {
          setCreditModalOpen(false);
          loadData(true);
        }}
        parties={parties}
        onPartyCreated={(newParty) => setParties((prev) => [newParty, ...prev])}
        defaultPartyId={creditPartyId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  listContent: {
    paddingBottom: 40,
  },
  headerActionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 8,
  },
  headerBtnCollect: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 11,
    paddingVertical: 10,
    gap: 5,
  },
  headerBtnPay: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    borderRadius: 11,
    paddingVertical: 10,
    gap: 5,
  },
  headerBtnCredit: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderRadius: 11,
    paddingVertical: 10,
    gap: 5,
  },
  headerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerBtnCreditText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F59E0B',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  filterPillsContainer: {
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  duesHeaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  duesBannerText: {
    fontSize: 12,
    color: Colors.dark.text,
    fontWeight: '600',
  },
  duesAmountHighlight: {
    fontWeight: '900',
    color: '#EF4444',
  },
  payablesHeaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  payablesBannerText: {
    fontSize: 12,
    color: Colors.dark.text,
    fontWeight: '600',
  },
  payablesAmountHighlight: {
    fontWeight: '900',
    color: '#F59E0B',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 8,
  },
});
