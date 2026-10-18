import React, { useState, useEffect, useCallback, useMemo, useDeferredValue } from 'react';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
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
import { mobileApiRequest, cachedMobileApiRequest, subscribeToAppSync } from '@/lib/api';
import { useTheme, useThemedStyles, ThemeColors } from '@/lib/theme-context';
import { Header } from '@/components/ui/Header';
import { SearchBar } from '@/components/ui/SearchBar';
import { FilterPills } from '@/components/ui/FilterPills';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
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
  CustomerDuesCard,
  StorePayablesCard,
  TransactionHistoryCard,
  CreditLedgerCard,
  RecordSettlementModal,
  RecordCreditModal,
  SettlementSuccessModal,
  SettlementSuccessData,
} from '@/components/payments';

interface DayBookResponse {
  date: string;
  summary: {
    openingCash: number;
    cashIn: number;
    cashOut: number;
    expenseCash: number;
    netCashFlow: number;
    closingCash: number;
    digital: {
      upiIn: number;
      bankIn: number;
      cardIn?: number;
      totalDigital: number;
    };
  };
  transactions: {
    payments: {
      id: string;
      type: string;
      mode: string;
      amount: number;
      partyName: string;
      refNo: string;
      time: string;
      notes?: string;
    }[];
    expenses: {
      id: string;
      expenseNo?: string;
      category: string;
      amount: number;
      paymentMode: string;
      paidTo?: string;
      time: string;
      notes?: string;
    }[];
    purchases: {
      id: string;
      purchaseNo: string;
      partyName?: string;
      total: number;
      paymentMode: string;
      time: string;
    }[];
  };
}

export interface DayBookEntry {
  id: string;
  timestamp: number;
  timeStr: string;
  title: string;
  subTitle: string;
  mode: string;
  isCredit: boolean;
  amount: number;
}

type TransactionListItem = PendingItem | PaymentRecord | CreditLedgerRecord | DayBookEntry;

export default function TransactionsScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const params = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<ActiveTabType>(
    params.tab === 'daybook' ? 'daybook' : 'all',
  );
  const [todayStr] = useState(() => new Date().toISOString().slice(0, 10));
  const [yesterdayStr] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [selectedDate, setSelectedDate] = useState(() => todayStr);
  const [dateFilterMode, setDateFilterMode] = useState<'all' | 'specific'>('specific');

  useEffect(() => {
    if (params.tab === 'daybook') {
      setActiveTab('daybook');
      setDateFilterMode('specific');
    }
  }, [params.tab]);
  const [dayBookData, setDayBookData] = useState<DayBookResponse | null>(null);
  const [dayBookLoading, setDayBookLoading] = useState(false);

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
    bankCollected: 0,
    cardCollected: 0,
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
  const [settleInvoiceNo, setSettleInvoiceNo] = useState('');
  const [settlementSuccessData, setSettlementSuccessData] = useState<SettlementSuccessData | null>(null);

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
          bankCollected: 0,
          cardCollected: 0,
          pendingReceivables: 0,
          creditsOwed: 0,
        })),
        cachedMobileApiRequest<{ invoices: PendingItem[]; ledgers: PendingCreditLedger[] }>(
          '/payments/pending',
          {
            forceRefresh: force,
            onRevalidate: (fresh) => {
              if (fresh) {
                const updated: PendingItem[] = [
                  ...(fresh.invoices || []).map((inv) => ({
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
                  ...(fresh.ledgers || [])
                    .filter(
                      (cl) =>
                        cl.type === 'PAYABLE' ||
                        (!cl.invoiceId &&
                          !(fresh.invoices || []).some(
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
                setPendingItems(updated);
              }
            },
          },
        ).catch(() => ({
          invoices: [],
          ledgers: [],
        })),
        cachedMobileApiRequest<CreditLedgerRecord[]>('/payments/credits', {
          forceRefresh: force,
          onRevalidate: (fresh) => {
            const list = Array.isArray(fresh) ? fresh : (fresh as any)?.data || [];
            setCreditLedgers(list);
          },
        }).catch(() => []),
        cachedMobileApiRequest<any>('/parties', {
          forceRefresh: force,
          onRevalidate: (fresh) => {
            const list = Array.isArray(fresh) ? fresh : (fresh as any)?.data || [];
            setParties(list);
          },
        }).catch(() => []),
      ]);

      const pList = Array.isArray(paymentsData) ? paymentsData : (paymentsData as any)?.data || [];
      const cList = Array.isArray(creditsData) ? creditsData : (creditsData as any)?.data || [];
      const partList = Array.isArray(partiesData) ? partiesData : (partiesData as any)?.data || [];
      setPayments(pList);
      setStats(statsData);
      setCreditLedgers(cList);
      setParties(partList);

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

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  useEffect(() => {
    const unsubscribe = subscribeToAppSync(() => {
      void loadData();
    });
    return () => unsubscribe();
  }, [loadData]);

  const loadDayBook = useCallback(async (date: string, force = false) => {
    setDayBookLoading(true);
    try {
      const res = await cachedMobileApiRequest<DayBookResponse>(
        `/analytics/day-book?date=${date}`,
        {
          forceRefresh: force,
          onRevalidate: (fresh) => {
            if (fresh) setDayBookData(fresh);
          },
        },
      );
      if (res) {
        setDayBookData(res);
      }
    } catch (err: any) {
      console.warn('Day book load error:', err.message);
    } finally {
      setDayBookLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'daybook' || dateFilterMode === 'specific') {
      loadDayBook(selectedDate);
    }
  }, [selectedDate, activeTab, dateFilterMode, loadDayBook]);

  const handleShiftDay = (days: number) => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() + days);
    setSelectedDate(cur.toISOString().slice(0, 10));
    setDateFilterMode('specific');
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().slice(0, 10));
    setDateFilterMode('specific');
  };

  const handleYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().slice(0, 10));
    setDateFilterMode('specific');
  };

  const handleAllTime = () => {
    setDateFilterMode('all');
    if (activeTab === 'daybook') {
      setActiveTab('all');
    }
  };

  const combinedDayBookEntries = useMemo(() => {
    if (!dayBookData) return [];
    const list: DayBookEntry[] = [];

    (dayBookData.transactions.payments || []).forEach((p) => {
      list.push({
        id: `pay-${p.id}`,
        timestamp: new Date(p.time).getTime(),
        timeStr: p.time,
        title: p.type === 'INFLOW' ? `Payment Received: ${p.partyName}` : `Payout: ${p.partyName}`,
        subTitle: `Ref: #${p.refNo}${p.notes ? ` • ${p.notes}` : ''}`,
        mode: p.mode,
        isCredit: p.type === 'INFLOW',
        amount: p.amount,
      });
    });

    (dayBookData.transactions.expenses || []).forEach((e) => {
      list.push({
        id: `exp-${e.id}`,
        timestamp: new Date(e.time).getTime(),
        timeStr: e.time,
        title: `Expense: ${e.category.replace(/_/g, ' ')}`,
        subTitle: `${e.paidTo ? `Paid to: ${e.paidTo} • ` : ''}${e.notes || ''}`,
        mode: e.paymentMode,
        isCredit: false,
        amount: e.amount,
      });
    });

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [dayBookData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
    if (activeTab === 'daybook' || dateFilterMode === 'specific') {
      loadDayBook(selectedDate, true);
    }
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
    setSettleInvoiceNo(item.invoiceNo || '');
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



  // Open General Collect / Pay
  const handleOpenGeneralCollect = () => {
    setSettleDirection('COLLECT');
    setSelectedPartyId(parties[0]?.id || '');
    setSettleInvoiceId('');
    setSettleInvoiceNo('');
    setSettleAmount('');
    setSettleNotes('Counter payment collection');
    setSettleModalOpen(true);
  };

  const handleOpenGeneralPay = () => {
    setSettleDirection('PAY');
    setSelectedPartyId(parties[0]?.id || '');
    setSettleInvoiceId('');
    setSettleInvoiceNo('');
    setSettleAmount('');
    setSettleNotes('Store payout / disbursement');
    setSettleModalOpen(true);
  };

  // Open Record Credit Modal
  const handleOpenRecordCredit = (partyId?: string) => {
    setCreditPartyId(partyId || '');
    setCreditModalOpen(true);
  };

  // Deferred search keeps all filter memos from running synchronously on each keystroke
  const deferredSearch = useDeferredValue(search);

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
    const q = deferredSearch.toLowerCase().trim();
    return customerDues.filter(
      (item) =>
        item.partyName.toLowerCase().includes(q) ||
        item.partyPhone.includes(q) ||
        (item.invoiceNo && item.invoiceNo.toLowerCase().includes(q)),
    );
  }, [customerDues, deferredSearch]);

  const filteredPayables = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    return storePayables.filter(
      (item) =>
        item.partyName.toLowerCase().includes(q) ||
        item.partyPhone.includes(q) ||
        (item.invoiceNo && item.invoiceNo.toLowerCase().includes(q)),
    );
  }, [storePayables, deferredSearch]);

  const filteredPayments = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    let base = payments;
    if (dateFilterMode === 'specific' && selectedDate) {
      base = base.filter((p) => {
        const pDate = p.paidAt || p.createdAt;
        return pDate && pDate.slice(0, 10) === selectedDate;
      });
    }
    return base.filter((p) => {
      const partyName = p.invoice?.party?.name || p.party?.name || '';
      const invNo = p.invoice?.invoiceNo || '';
      const utr = p.upiUtr || p.upiTxnRef || '';
      const matchesSearch =
        partyName.toLowerCase().includes(q) || invNo.toLowerCase().includes(q) || utr.toLowerCase().includes(q);
      const normalizedMode = p.mode?.toUpperCase();
      const matchesMode =
        modeFilter === 'ALL' ||
        normalizedMode === modeFilter ||
        (modeFilter === 'BANK_TRANSFER' && normalizedMode === 'BANK');
      return matchesSearch && matchesMode;
    });
  }, [payments, deferredSearch, modeFilter, dateFilterMode, selectedDate]);

  const filteredInflows = useMemo(() => {
    return filteredPayments.filter(
      (p) => p.status === 'CONFIRMED' && p.type !== 'OUTFLOW',
    );
  }, [filteredPayments]);

  const filteredCredits = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    return creditLedgers.filter((cl) => {
      const partyName = cl.party?.name || '';
      const invNo = cl.invoice?.invoiceNo || '';
      const notes = cl.notes || '';
      return partyName.toLowerCase().includes(q) || invNo.toLowerCase().includes(q) || notes.toLowerCase().includes(q);
    });
  }, [creditLedgers, deferredSearch]);

  return (
    <View style={styles.screen}>
      <Header
        title="Transactions & Ledger"
        subtitle="Sales, Dues, Store Payables & Multi-Method Inflows"
        rightAction={{
          icon: 'add',
          onPress: () => handleOpenRecordCredit(),
        }}
      />

      <FlatList<TransactionListItem>
        data={
          activeTab === 'daybook'
            ? combinedDayBookEntries
            : activeTab === 'dues'
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {/* Date-wise Navigation Toolbar */}
            <View style={styles.dateToolbar}>
              <TouchableOpacity
                onPress={handleAllTime}
                style={[
                  styles.dateModePill,
                  dateFilterMode === 'all' && styles.dateModePillActive,
                ]}
              >
                <Text
                  style={[
                    styles.dateModePillText,
                    dateFilterMode === 'all' && styles.dateModePillTextActive,
                  ]}
                >
                  All Dates
                </Text>
              </TouchableOpacity>

              <View style={styles.datePickerBox}>
                <TouchableOpacity onPress={() => handleShiftDay(-1)} style={styles.dateArrowBtn}>
                  <Ionicons name="chevron-back" size={16} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.selectedDateText}>{selectedDate}</Text>
                <TouchableOpacity onPress={() => handleShiftDay(1)} style={styles.dateArrowBtn}>
                  <Ionicons name="chevron-forward" size={16} color={colors.text} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleYesterday}
                style={[
                  styles.quickDateBtn,
                  dateFilterMode === 'specific' &&
                    selectedDate === yesterdayStr &&
                    styles.quickDateBtnActive,
                ]}
              >
                <Text style={styles.quickDateText}>Yest</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleToday}
                style={[
                  styles.quickDateBtn,
                  dateFilterMode === 'specific' &&
                    selectedDate === todayStr &&
                    styles.quickDateBtnActive,
                ]}
              >
                <Text style={styles.quickDateText}>Today</Text>
              </TouchableOpacity>
            </View>

            {/* Daily Till Drawer Summary Card */}
            {(dateFilterMode === 'specific' || activeTab === 'daybook') && (
              <Card elevated style={styles.tillCard}>
                <View style={styles.tillHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="wallet-outline" size={16} color="#10B981" />
                    <Text style={styles.tillTitle}>
                      Till Drawer Reconciliation ({selectedDate})
                    </Text>
                  </View>
                  {dayBookLoading && !dayBookData && (
                    <ActivityIndicator size="small" color="#10B981" />
                  )}
                </View>

                <View style={styles.tillGrid}>
                  <View style={styles.tillGridCol}>
                    <Text style={styles.tillMiniLabel}>Opening Cash</Text>
                    <Text style={styles.tillMiniVal}>
                      {formatINR(dayBookData?.summary.openingCash || 0)}
                    </Text>
                  </View>
                  <View style={styles.tillGridCol}>
                    <Text style={[styles.tillMiniLabel, { color: '#10B981' }]}>Cash In</Text>
                    <Text style={[styles.tillMiniVal, { color: '#10B981' }]}>
                      +{formatINR(dayBookData?.summary.cashIn || 0)}
                    </Text>
                  </View>
                  <View style={styles.tillGridCol}>
                    <Text style={[styles.tillMiniLabel, { color: '#EF4444' }]}>Cash Out</Text>
                    <Text style={[styles.tillMiniVal, { color: '#EF4444' }]}>
                      -{formatINR(dayBookData?.summary.cashOut || 0)}
                    </Text>
                  </View>
                  <View style={styles.tillGridCol}>
                    <Text style={[styles.tillMiniLabel, { color: '#F59E0B' }]}>Expenses</Text>
                    <Text style={[styles.tillMiniVal, { color: '#F59E0B' }]}>
                      -{formatINR(dayBookData?.summary.expenseCash || 0)}
                    </Text>
                  </View>
                </View>

                {/* Closing Cash Till Highlight Box */}
                <View style={styles.closingTillBox}>
                  <View>
                    <Text style={styles.closingTillLabel}>Closing Cash (Till Drawer)</Text>
                    <Text style={styles.closingTillSub}>Target physical cash in till</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.closingTillAmount}>
                      {formatINR(dayBookData?.summary.closingCash || 0)}
                    </Text>
                    <Text style={styles.netFlowText}>
                      Net: {(dayBookData?.summary.netCashFlow || 0) >= 0 ? '+' : ''}
                      {formatINR(dayBookData?.summary.netCashFlow || 0)}
                    </Text>
                  </View>
                </View>

                <View style={styles.digitalSplitRow}>
                  <Text style={styles.digitalSplitLabel}>Digital Collections:</Text>
                  <Text style={styles.digitalSplitVal}>
                    UPI: {formatINR(dayBookData?.summary.digital.upiIn || 0)} • Bank: {formatINR(dayBookData?.summary.digital.bankIn || 0)} • Card: {formatINR(dayBookData?.summary.digital.cardIn || 0)}
                  </Text>
                </View>
              </Card>
            )}

            {/* Financial KPI Summary Cards (6 Cards matching PaymentStatsGrid) */}
            <PaymentStatsRow
              stats={stats}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />

            {/* View Selector Dropdown & + Record Credit Row */}
            <View style={styles.viewSelectorRow}>
              <FilterDropdown
                label="View"
                value={activeTab}
                onSelect={(val) => setActiveTab(val as ActiveTabType)}
                options={[
                  {
                    label: 'Till & Day Book',
                    value: 'daybook',
                    count: combinedDayBookEntries.length,
                    icon: 'wallet-outline',
                    color: '#10B981',
                  },
                  {
                    label: 'All Transactions',
                    value: 'all',
                    count: payments.length,
                    icon: 'swap-horizontal-outline',
                    color: '#FFFFFF',
                  },
                  {
                    label: 'Customer Dues',
                    value: 'dues',
                    count: customerDues.length,
                    icon: 'time-outline',
                    color: '#EF4444',
                  },
                  {
                    label: 'Store Payables',
                    value: 'payables',
                    count: storePayables.length,
                    icon: 'arrow-up-circle-outline',
                    color: '#F59E0B',
                  },
                  {
                    label: 'Settled Inflows',
                    value: 'inflows',
                    count: filteredInflows.length,
                    icon: 'checkmark-circle-outline',
                    color: '#10B981',
                  },
                  {
                    label: 'Credit Ledger',
                    value: 'credits',
                    count: creditLedgers.length,
                    icon: 'book-outline',
                    color: '#F59E0B',
                  },
                ]}
                hideLabelPrefix
                showCountOnTrigger
                containerStyle={{ flex: 1 }}
              />

              <TouchableOpacity
                style={styles.collectBtn}
                onPress={handleOpenGeneralCollect}
                activeOpacity={0.8}
              >
                <Ionicons name="wallet-outline" size={14} color="#10B981" />
                <Text style={styles.collectBtnText}>Collect</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.makePaymentBtn}
                onPress={handleOpenGeneralPay}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-up-circle-outline" size={14} color="#F59E0B" />
                <Text style={styles.makePaymentBtnText}>Pay</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.recordCreditBtn}
                onPress={() => handleOpenRecordCredit()}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle" size={14} color="#A78BFA" />
                <Text style={styles.recordCreditBtnText}>Credit</Text>
              </TouchableOpacity>
            </View>

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
                    { label: 'Card (POS)', value: 'CARD' },
                    { label: 'Bank Transfer', value: 'BANK_TRANSFER' },
                    { label: 'Split', value: 'SPLIT' },
                    { label: 'Credit', value: 'CREDIT' },
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
          ) : activeTab === 'daybook' ? (
            <EmptyState
              icon="wallet-outline"
              title="No Journal Transactions"
              description={`No cash, bank, or UPI transactions recorded on ${selectedDate}.`}
            />
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
          if (activeTab === 'daybook') {
            const entry = item as DayBookEntry;
            return (
              <Card style={styles.dayBookRowCard}>
                <View style={styles.dayBookRowHeader}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.dayBookTitle}>{entry.title}</Text>
                    <Text style={styles.dayBookSub}>{entry.subTitle}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      style={[
                        styles.dayBookAmount,
                        { color: entry.isCredit ? '#10B981' : '#EF4444' },
                      ]}
                    >
                      {entry.isCredit ? '+' : '-'}
                      {formatINR(entry.amount)}
                    </Text>
                    <View style={styles.dayBookBadge}>
                      <Text style={styles.dayBookBadgeText}>{entry.mode}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.dayBookTimeRow}>
                  <Ionicons name="time-outline" size={12} color={colors.textTertiary} />
                  <Text style={styles.dayBookTimeText}>
                    {new Date(entry.timeStr).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                  <View style={{ flex: 1 }} />
                  <View style={styles.settledPill}>
                    <Ionicons name="checkmark-done" size={11} color="#10B981" />
                    <Text style={styles.settledPillText}>Settled</Text>
                  </View>
                </View>
              </Card>
            );
          }

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
        onSuccess={(data) => {
          setSettleModalOpen(false);
          loadData(true);
          if (data) {
            setSettlementSuccessData(data);
          }
        }}
        parties={parties}
        onPartyCreated={(newParty) => setParties((prev) => [newParty, ...prev])}
        initialDirection={settleDirection}
        initialPartyId={selectedPartyId}
        initialAmount={settleAmount}
        initialNotes={settleNotes}
        initialInvoiceId={settleInvoiceId}
        initialInvoiceNo={settleInvoiceNo}
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

      {/* Themed Settlement Success Feedback Modal */}
      <SettlementSuccessModal
        visible={Boolean(settlementSuccessData)}
        data={settlementSuccessData}
        onClose={() => setSettlementSuccessData(null)}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    listContent: {
      paddingBottom: 90,
    },
    viewSelectorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginTop: 2,
      marginBottom: 8,
      gap: 6,
    },
    collectBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(16, 185, 129, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.35)',
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 9,
      minHeight: 38,
      gap: 5,
    },
    collectBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#10B981',
    },
    makePaymentBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.35)',
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 9,
      minHeight: 38,
      gap: 5,
    },
    makePaymentBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#F59E0B',
    },
    recordCreditBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.35)',
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 9,
      minHeight: 38,
      gap: 6,
    },
    recordCreditBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#F59E0B',
    },
    searchContainer: {
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    filterPillsContainer: {
      paddingHorizontal: 16,
      marginBottom: 8,
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
      color: colors.text,
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
      color: colors.text,
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
      color: colors.textSecondary,
      marginTop: 8,
    },
    dateToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginTop: 4,
      marginBottom: 8,
      gap: 6,
    },
    dateModePill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.cardElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dateModePillActive: {
      backgroundColor: '#3B82F6',
      borderColor: '#60A5FA',
    },
    dateModePillText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    dateModePillTextActive: {
      color: '#FFFFFF',
    },
    datePickerBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.cardElevated,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    dateArrowBtn: {
      padding: 4,
    },
    selectedDateText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
      marginHorizontal: 4,
    },
    quickDateBtn: {
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.cardElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickDateBtnActive: {
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      borderColor: '#3B82F6',
    },
    quickDateText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text,
    },
    tillCard: {
      marginHorizontal: 16,
      marginBottom: 12,
      padding: 14,
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.05)' : 'rgba(16, 185, 129, 0.08)',
      borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.2)',
      borderWidth: 1,
      borderRadius: 12,
    },
    tillHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    tillTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    tillGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    tillGridCol: {
      alignItems: 'center',
      flex: 1,
    },
    tillMiniLabel: {
      fontSize: 10,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    tillMiniVal: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    closingTillBox: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.15)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.35)',
      borderRadius: 10,
      padding: 10,
      marginBottom: 8,
    },
    closingTillLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: '#10B981',
    },
    closingTillSub: {
      fontSize: 10,
      color: colors.textSecondary,
    },
    closingTillAmount: {
      fontSize: 15,
      fontWeight: '900',
      color: '#10B981',
    },
    netFlowText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 1,
    },
    digitalSplitRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    digitalSplitLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    digitalSplitVal: {
      fontSize: 11,
      color: colors.text,
      fontWeight: '600',
    },
    dayBookRowCard: {
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 12,
      borderRadius: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dayBookRowHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 6,
    },
    dayBookTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    dayBookSub: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    dayBookAmount: {
      fontSize: 14,
      fontWeight: '800',
    },
    dayBookBadge: {
      backgroundColor: colors.cardElevated,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginTop: 4,
      alignSelf: 'flex-end',
    },
    dayBookBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    dayBookTimeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    dayBookTimeText: {
      fontSize: 10,
      color: colors.textTertiary,
    },
    settledPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    settledPillText: {
      fontSize: 10,
      fontWeight: '600',
      color: '#10B981',
    },
  });
