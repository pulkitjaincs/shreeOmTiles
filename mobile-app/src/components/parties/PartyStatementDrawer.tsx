import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
} from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { CalendarModal } from '@/components/ui/CalendarModal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { ThemeColors } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/lib/theme-context';
import { mobileApiRequest } from '@/lib/api';
import { formatINR, formatDate } from '@/lib/formatters';
import { Party, StatementInvoice, StatementCreditLedger } from './types';
import { Ionicons } from '@expo/vector-icons';
import { downloadAndSharePdf } from '@/lib/pdf';
import { buildPartyStatementShareUrl } from '@/lib/whatsapp';

interface PartyStatementDrawerProps {
  party: Party | null;
  visible?: boolean;
  onClose: () => void;
  onPartyDeleted: () => void;
  canDelete?: boolean;
  onEdit?: (party: Party) => void;
  onDelete?: (party: Party) => void;
}

export function PartyStatementDrawer({
  party,
  visible = true,
  onClose,
  onPartyDeleted,
  canDelete = false,
  onEdit,
  onDelete,
}: PartyStatementDrawerProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [statementData, setStatementData] = useState<{
    invoices: StatementInvoice[];
    purchases?: any[];
    creditLedgers: StatementCreditLedger[];
    payments?: any[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'orders' | 'purchases' | 'transactions' | 'credits'>('orders');
  const [deleting, setDeleting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [now] = useState(() => Date.now());

  const partyId = party?.id;

  useEffect(() => {
    if (!visible || !partyId) {
      setStatementData(null);
      return;
    }

    setStatementData(null);
    setTab('orders');
    setLoading(true);
    const controller = new AbortController();

    mobileApiRequest<any>(`/parties/${partyId}`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setStatementData(data);
        }
      })
      .catch((err: any) => {
        if (!controller.signal.aborted && err?.name !== 'AbortError') {
          Alert.alert('Error', err.message || 'Failed to load customer statement');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [visible, partyId]);

  if (!visible || !party || !partyId) return null;

  const invoices = statementData?.invoices || [];
  const purchases = statementData?.purchases || [];
  const ledgers = statementData?.creditLedgers || [];

  const lifetimeTotal = invoices
    .filter((inv: any) => inv.status !== 'CANCELLED' && inv.status !== 'DRAFT')
    .reduce((sum: number, inv: any) => sum + Number(inv.total || 0), 0);

  const lifetimePurchases = purchases
    .filter((p: any) => p.status !== 'CANCELLED')
    .reduce((sum: number, p: any) => sum + Number(p.total || 0), 0);

  const partyPayments = statementData?.payments || [];
  const settledPayments =
    partyPayments.length > 0
      ? Math.max(
          0,
          partyPayments
            .filter((p: any) => p.status === 'CONFIRMED')
            .reduce(
              (pSum: number, p: any) =>
                p.type === 'OUTFLOW'
                  ? pSum - Number(p.amount || 0)
                  : pSum + Number(p.amount || 0),
              0
            )
        )
      : invoices.reduce((sum: number, inv: any) => {
          const paid = (inv.payments || [])
            .filter((p: any) => p.status === 'CONFIRMED')
            .reduce(
              (pSum: number, p: any) =>
                p.type === 'OUTFLOW'
                  ? pSum - Number(p.amount || 0)
                  : pSum + Number(p.amount || 0),
              0
            );
          return sum + Math.max(0, paid);
        }, 0);

  const creditLedgerDues = ledgers
    .filter((cl) => cl.status !== 'SETTLED')
    .reduce((sum, cl) => {
      const amt = Number(cl.amountDue || 0);
      return cl.type === 'RECEIVABLE' ? sum + amt : sum - amt;
    }, 0);

  const invoiceDues = invoices
    .filter((inv: any) => inv.status !== 'CANCELLED' && inv.status !== 'DRAFT')
    .reduce((sum: number, inv: any) => {
      const hasCreditLedger = ledgers.some(
        (cl: any) => (cl.invoiceId === inv.id || cl.invoice?.id === inv.id) && cl.status !== 'SETTLED'
      );
      if (hasCreditLedger) return sum;
      const invTotal = Number(inv.total || 0);
      const paid = (inv.payments || [])
        .filter((p: any) => p.status === 'CONFIRMED')
        .reduce(
          (pSum: number, p: any) =>
            p.type === 'OUTFLOW'
              ? pSum - Number(p.amount || 0)
              : pSum + Number(p.amount || 0),
          0
        );
      return sum + Math.max(0, invTotal - paid);
    }, 0);

  const totalDues = creditLedgerDues + invoiceDues;

  const partyPayables = ledgers
    .filter((cl) => cl.status !== 'SETTLED' && cl.type === 'PAYABLE')
    .reduce((sum, cl) => sum + Number(cl.amountDue || 0), 0);

  const isDue = totalDues > 0.01;
  const isPayable = !isDue && (totalDues < -0.01 || partyPayables > 0.01);
  const payableAmt = totalDues < -0.01 ? Math.abs(totalDues) : partyPayables;
  const hasPendingLiability = isDue || isPayable;

  const handleShareStatement = () => {
    const url = buildPartyStatementShareUrl({
      phone: party.phone,
      name: party.name,
      gstin: party.gstin,
      address: party.address,
      lifetimeTotal,
      totalReceived: settledPayments,
      totalDues,
      totalOrders: invoices.length,
    });

    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open WhatsApp');
    });
  };

  const handleDownloadPdf = async (customFrom?: string, customTo?: string) => {
    if (!party || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      const from = customFrom !== undefined ? customFrom : dateRange.from;
      const to = customTo !== undefined ? customTo : dateRange.to;
      const q = [
        from ? `startDate=${from}` : '',
        to ? `endDate=${to}` : '',
      ].filter(Boolean).join('&');
      const safeName = (party.name || 'Party').replace(/[^a-zA-Z0-9_-]/g, '_');
      await downloadAndSharePdf(
        `parties/${party.id}/statement-pdf${q ? `?${q}` : ''}`,
        `Statement_${safeName}`,
      );
    } catch (err: any) {
      Alert.alert('Download Failed', err.message || 'Could not download statement PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDelete = () => {
    if (!party) return;
    if (onDelete) {
      onClose();
      onDelete(party);
    } else {
      Alert.alert(
        'Delete Customer',
        `Are you sure you want to permanently delete "${party.name}"? Customer must have 0 outstanding balance.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete Customer',
            style: 'destructive',
            onPress: async () => {
              setDeleting(true);
              try {
                await mobileApiRequest(`/parties/${party.id}`, {
                  method: 'DELETE',
                });
                Alert.alert('Success', `Customer "${party.name}" removed from directory.`);
                onClose();
                onPartyDeleted();
              } catch (err: any) {
                Alert.alert('Deletion Blocked', err.message || 'Customer has unsettled balance or pending orders.');
              } finally {
                setDeleting(false);
              }
            },
          },
        ],
      );
    }
  };

  return (
    <BottomSheetModal
      visible={visible && Boolean(party)}
      onClose={onClose}
      title={party.name}
      subtitle={`Phone: ${party.phone}${party.gstin ? ' • GST: ' + party.gstin : ''}${party.address ? ' • ' + party.address : ''}`}
      maxHeightPercent={0.92}
    >
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading complete customer history...</Text>
        </View>
      ) : !statementData ? (
        <View style={styles.centerLoading}>
          <Ionicons name="alert-circle-outline" size={32} color={colors.textTertiary} />
          <Text style={[styles.loadingText, { marginTop: 8 }]}>Unable to load customer history.</Text>
          <Button
            title="Retry"
            icon="refresh-outline"
            size="sm"
            variant="outline"
            onPress={() => {
              if (partyId) {
                setLoading(true);
                mobileApiRequest<any>(`/parties/${partyId}`)
                  .then((data) => setStatementData(data))
                  .catch((err: any) => Alert.alert('Error', err.message || 'Failed to load statement'))
                  .finally(() => setLoading(false));
              }
            }}
            style={{ marginTop: 12 }}
          />
        </View>
      ) : (
        <View>
          {/* KPI Summary Cards (4 Cards matching Web Dashboard) */}
          <View style={styles.kpiRow}>
            <Card style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>
                {purchases.length > 0 ? 'Sales / Purchases' : 'Lifetime Billed'}
              </Text>
              <Text style={styles.kpiValue}>{formatINR(lifetimeTotal)}</Text>
              <Text style={styles.kpiSub}>
                {purchases.length > 0
                  ? `Purchases: ${formatINR(lifetimePurchases)}`
                  : 'All orders'}
              </Text>
            </Card>

            <Card style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total Orders</Text>
              <Text style={styles.kpiValue}>
                {invoices.length}
                {purchases.length > 0 ? ` (+${purchases.length} pur)` : ''}
              </Text>
              <Text style={styles.kpiSub}>Recorded transactions</Text>
            </Card>
          </View>

          <View style={styles.kpiRow}>
            <Card
              style={[
                styles.kpiCard,
                isDue
                  ? styles.kpiDueCard
                  : isPayable
                  ? styles.kpiPayableCard
                  : styles.kpiClearedCard,
              ]}
            >
              <Text
                style={[
                  styles.kpiLabel,
                  isDue
                    ? { color: '#EF4444' }
                    : isPayable
                    ? { color: '#F59E0B' }
                    : { color: '#10B981' },
                ]}
              >
                {isDue ? 'Outstanding Dues' : isPayable ? 'Store Payable' : 'Account Balance'}
              </Text>
              <Text
                style={[
                  styles.kpiValue,
                  {
                    color: isDue ? '#EF4444' : isPayable ? '#F59E0B' : '#10B981',
                  },
                ]}
              >
                {formatINR(isDue ? totalDues : isPayable ? payableAmt : 0)}
              </Text>
              <Text style={styles.kpiSub}>
                {isDue ? 'Pending in ledger' : isPayable ? 'Store owes party' : 'All accounts clear'}
              </Text>
            </Card>

            <Card style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total Received</Text>
              <Text style={[styles.kpiValue, { color: '#10B981' }]}>
                {formatINR(settledPayments)}
              </Text>
              <Text style={styles.kpiSub}>Confirmed net receipts</Text>
            </Card>
          </View>

          {/* Action Buttons Row */}
          <View style={styles.actionsRow}>
            <Button
              title="Statement PDF"
              icon="document-text-outline"
              variant="outline"
              size="sm"
              loading={downloadingPdf}
              onPress={() => void handleDownloadPdf()}
              style={styles.pdfStatementBtn}
            />
            <TouchableOpacity
              style={[
                styles.drawerIconBtn,
                Boolean(dateRange.from || dateRange.to) && {
                  borderColor: colors.primary,
                  backgroundColor: colors.primary + '1A',
                },
              ]}
              onPress={() => setCalendarOpen(true)}
              activeOpacity={0.7}
              accessibilityLabel="Select statement date range"
            >
              <Ionicons
                name="calendar-outline"
                size={18}
                color={Boolean(dateRange.from || dateRange.to) ? colors.primary : colors.textSecondary}
              />
            </TouchableOpacity>
            <Button
              title="WhatsApp"
              icon="logo-whatsapp"
              variant="primary"
              size="sm"
              onPress={handleShareStatement}
              style={styles.shareStatementBtn}
              textStyle={styles.shareStatementBtnText}
            />
            {onEdit ? (
              <TouchableOpacity
                style={styles.drawerIconBtn}
                onPress={() => onEdit(party)}
                activeOpacity={0.7}
              >
                <Ionicons name="pencil-outline" size={17} color="#F59E0B" />
              </TouchableOpacity>
            ) : null}
            {canDelete ? (
              <TouchableOpacity
                style={[styles.drawerIconBtn, hasPendingLiability && styles.drawerIconBtnDisabled]}
                onPress={handleDelete}
                disabled={deleting}
                activeOpacity={0.7}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <Ionicons
                    name="trash-outline"
                    size={17}
                    color={hasPendingLiability ? colors.textTertiary : '#EF4444'}
                  />
                )}
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Tabs: Orders, Purchases, Transactions, Credits */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabToggleScroll}
            style={{ marginBottom: 10 }}
          >
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'orders' && styles.tabBtnActive]}
              onPress={() => setTab('orders')}
            >
              <Text style={[styles.tabText, tab === 'orders' && styles.tabTextActive]}>
                Orders ({invoices.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, tab === 'purchases' && styles.tabBtnActive]}
              onPress={() => setTab('purchases')}
            >
              <Text style={[styles.tabText, tab === 'purchases' && styles.tabTextActive]}>
                Purchases ({purchases.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, tab === 'transactions' && styles.tabBtnActive]}
              onPress={() => setTab('transactions')}
            >
              <Text style={[styles.tabText, tab === 'transactions' && styles.tabTextActive]}>
                Transactions ({partyPayments.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, tab === 'credits' && styles.tabBtnActive]}
              onPress={() => setTab('credits')}
            >
              <Text style={[styles.tabText, tab === 'credits' && styles.tabTextActive]}>
                Credits ({ledgers.length})
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Tab 1: Orders */}
          {tab === 'orders' ? (
            invoices.length > 0 ? (
              invoices.map((inv) => (
                <Card key={inv.id} style={styles.orderCard}>
                  <View style={styles.orderTop}>
                    <View>
                      <Text style={styles.orderNo}>#{inv.invoiceNo}</Text>
                      <Text style={styles.orderDate}>{formatDate(inv.createdAt)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.orderAmount}>{formatINR(inv.total)}</Text>
                      <StatusBadge status={inv.status} size="sm" />
                    </View>
                  </View>

                  <Text style={styles.orderItemsCount}>
                    {(inv.items || []).length} item{(inv.items || []).length === 1 ? '' : 's'}
                    {inv.paymentMode ? ` • Mode: ${inv.paymentMode}` : ''}
                  </Text>

                  {/* Itemized Line Items Breakdown */}
                  {inv.items && inv.items.length > 0 ? (
                    <View style={styles.itemsContainer}>
                      {inv.items.map((item, idx) => (
                        <View key={item.id || idx} style={styles.itemRow}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.itemName} numberOfLines={1}>
                              {item.product?.name || 'Product Item'}
                            </Text>
                            <Text style={styles.itemMeta}>
                              {Number(item.qty ?? item.quantity ?? 1)} {item.product?.unit || 'pcs'}
                              {item.unitPrice ? ` • ${formatINR(item.unitPrice)}/unit` : ''}
                            </Text>
                          </View>
                          <Text style={styles.itemTotal}>
                            {formatINR(item.total ?? (Number(item.qty ?? item.quantity ?? 1) * Number(item.unitPrice || 0)))}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {inv.salesman?.name ? (
                    <View style={styles.salesmanRow}>
                      <Ionicons name="person-outline" size={11} color={colors.textTertiary} />
                      <Text style={styles.salesmanText}>Billed by {inv.salesman.name}</Text>
                    </View>
                  ) : null}
                </Card>
              ))
            ) : (
              <Text style={styles.emptyText}>No invoices generated for this customer yet</Text>
            )
          ) : null}

          {/* Tab 2: Credit Ledgers */}
          {tab === 'credits' ? (
            ledgers.length > 0 ? (
              ledgers.map((cl) => {
                const isClPayable = cl.type === 'PAYABLE';
                const clDueAmt = Number(cl.amountDue || 0);
                const isOverdue =
                  !isClPayable &&
                  Boolean(cl.dueDate) &&
                  cl.status !== 'SETTLED' &&
                  now > 0 &&
                  new Date(cl.dueDate!).getTime() < now;

                return (
                  <Card key={cl.id} style={styles.orderCard}>
                    <View style={styles.orderTop}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={styles.orderNo}>
                            {cl.invoice?.invoiceNo
                              ? `Bill of Supply #${cl.invoice.invoiceNo}`
                              : isClPayable
                              ? 'Store Credit / Payable'
                              : 'Direct Credit'}
                          </Text>
                          {isClPayable && (
                            <View style={styles.payableBadge}>
                              <Text style={styles.payableBadgeText}>Store Payable</Text>
                            </View>
                          )}
                          {isOverdue && (
                            <View style={styles.overdueBadge}>
                              <Text style={styles.overdueBadgeText}>Overdue</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.ledgerMetaRow}>
                          {cl.createdAt ? (
                            <Text style={styles.ledgerMetaText}>Issued: {formatDate(cl.createdAt)}</Text>
                          ) : null}
                          {cl.dueDate ? (
                            <Text style={[styles.ledgerMetaText, isOverdue && { color: '#EF4444', fontWeight: '700' }]}>
                              Due: {formatDate(cl.dueDate)}
                            </Text>
                          ) : null}
                          {cl.remindersSent !== undefined ? (
                            <Text style={styles.ledgerMetaText}>• {cl.remindersSent} reminders sent</Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text
                          style={[
                            styles.orderAmount,
                            {
                              color: isClPayable
                                ? '#F59E0B'
                                : cl.status === 'SETTLED'
                                ? '#10B981'
                                : '#EF4444',
                            },
                          ]}
                        >
                          {formatINR(clDueAmt)}
                        </Text>
                        <StatusBadge status={cl.status} size="sm" />
                      </View>
                    </View>
                  </Card>
                );
              })
            ) : (
              <Text style={styles.emptyText}>No credit ledger entries found</Text>
            )
          ) : null}

          {/* Tab 3: Purchases */}
          {tab === 'purchases' ? (
            purchases.length > 0 ? (
              purchases.map((pur: any) => (
                <Card key={pur.id} style={styles.orderCard}>
                  <View style={styles.orderTop}>
                    <View>
                      <Text style={styles.orderNo}>#{pur.purchaseNo}</Text>
                      {pur.vendorBillNo ? (
                        <Text style={styles.ledgerMetaText}>Ref: {pur.vendorBillNo}</Text>
                      ) : null}
                      <Text style={styles.orderDate}>{formatDate(pur.createdAt)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.orderAmount}>{formatINR(pur.total)}</Text>
                      <StatusBadge status={pur.status} size="sm" />
                    </View>
                  </View>

                  <Text style={styles.orderItemsCount}>
                    {(pur.items || []).length} item{(pur.items || []).length === 1 ? '' : 's'}
                    {pur.paymentMode ? ` • Mode: ${pur.paymentMode}` : ''}
                  </Text>

                  {pur.items && pur.items.length > 0 ? (
                    <View style={styles.itemsContainer}>
                      {pur.items.map((item: any, idx: number) => (
                        <View key={item.id || idx} style={styles.itemRow}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.itemName} numberOfLines={1}>
                              {item.product?.name || 'Item'}
                            </Text>
                            <Text style={styles.itemMeta}>
                              {Number(item.qty || 1)} {item.product?.unit || 'Box'}
                              {item.unitPrice ? ` • ${formatINR(item.unitPrice)}/unit` : ''}
                            </Text>
                          </View>
                          <Text style={styles.itemTotal}>{formatINR(item.total)}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {pur.createdBy?.name ? (
                    <View style={styles.salesmanRow}>
                      <Ionicons name="person-outline" size={11} color={colors.textTertiary} />
                      <Text style={styles.salesmanText}>Recorded by {pur.createdBy.name}</Text>
                    </View>
                  ) : null}
                </Card>
              ))
            ) : (
              <Text style={styles.emptyText}>No purchases recorded from this party</Text>
            )
          ) : null}

          {/* Tab 4: Payments & Transactions */}
          {tab === 'transactions' ? (
            partyPayments.length > 0 ? (
              partyPayments.map((p: any) => {
                const isOutflow = p.type === 'OUTFLOW';
                const dateVal = p.paidAt || p.createdAt;
                return (
                  <Card key={p.id} style={styles.orderCard}>
                    <View style={styles.orderTop}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons
                            name={isOutflow ? 'arrow-up-circle' : 'arrow-down-circle'}
                            size={16}
                            color={isOutflow ? '#F59E0B' : '#10B981'}
                          />
                          <Text style={styles.orderNo}>
                            {isOutflow ? 'Payment Out' : 'Payment In'}
                          </Text>
                        </View>
                        <Text style={styles.orderDate}>{formatDate(dateVal)}</Text>
                        <Text style={styles.ledgerMetaText}>
                          Mode: {p.mode}
                          {p.invoice?.invoiceNo
                            ? ` • Inv #${p.invoice.invoiceNo}`
                            : p.purchase?.purchaseNo
                            ? ` • Pur #${p.purchase.purchaseNo}`
                            : p.notes
                            ? ` • ${p.notes}`
                            : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text
                          style={[
                            styles.orderAmount,
                            { color: isOutflow ? '#F59E0B' : '#10B981' },
                          ]}
                        >
                          {isOutflow ? '- ' : '+ '}{formatINR(p.amount)}
                        </Text>
                        <StatusBadge status={p.status} size="sm" />
                      </View>
                    </View>
                  </Card>
                );
              })
            ) : (
              <Text style={styles.emptyText}>No payment transactions recorded for this party</Text>
            )
          ) : null}
        </View>
      )}

      <CalendarModal
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        initialFrom={dateRange.from}
        initialTo={dateRange.to}
        mode="range"
        title="Statement Date Range"
        onApply={(from, to) => {
          setDateRange({ from, to });
          setCalendarOpen(false);
          void handleDownloadPdf(from, to);
        }}
      />
    </BottomSheetModal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    centerLoading: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 8,
    },
    kpiRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 8,
    },
    kpiCard: {
      flex: 1,
      padding: 10,
      borderRadius: 10,
      backgroundColor: colors.cardHover,
      marginBottom: 0,
    },
    kpiDueCard: {
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.35)',
      backgroundColor: 'rgba(239, 68, 68, 0.08)',
    },
    kpiPayableCard: {
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.35)',
      backgroundColor: 'rgba(245, 158, 11, 0.08)',
    },
    kpiClearedCard: {
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.35)',
      backgroundColor: 'rgba(16, 185, 129, 0.08)',
    },
    kpiLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
    },
    kpiValue: {
      fontSize: 14,
      fontWeight: '900',
      color: colors.text,
      marginVertical: 2,
    },
    kpiSub: {
      fontSize: 9.5,
      color: colors.textTertiary,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginVertical: 12,
    },
    pdfStatementBtn: {
      flex: 1.1,
      height: 40,
      borderRadius: 10,
    },
    shareStatementBtn: {
      flex: 1,
      height: 40,
      borderRadius: 10,
      backgroundColor: '#10B981',
    },
    shareStatementBtnText: {
      color: '#FFFFFF',
      fontWeight: '800',
      fontSize: 13,
    },
    drawerIconBtn: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: colors.cardElevated,
      borderWidth: 1,
      borderColor: colors.borderMedium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    drawerIconBtnDisabled: {
      opacity: 0.5,
    },
    tabToggle: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 3,
      marginBottom: 10,
    },
    tabToggleScroll: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 3,
      gap: 4,
    },
    tabBtn: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      alignItems: 'center',
      borderRadius: 8,
    },
    tabBtnActive: {
      backgroundColor: colors.primary,
    },
    tabText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    tabTextActive: {
      color: colors.primaryForeground,
    },
    orderCard: {
      padding: 12,
      marginBottom: 8,
    },
    orderTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    orderNo: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.text,
    },
    orderDate: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    orderAmount: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 2,
    },
    orderItemsCount: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 6,
    },
    itemsContainer: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 4,
    },
    itemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 3,
      backgroundColor: colors.cardHover,
      paddingHorizontal: 6,
      borderRadius: 6,
    },
    itemName: {
      fontSize: 11.5,
      fontWeight: '600',
      color: colors.text,
    },
    itemMeta: {
      fontSize: 10,
      color: colors.textSecondary,
      marginTop: 1,
    },
    itemTotal: {
      fontSize: 11.5,
      fontWeight: '700',
      color: colors.text,
      fontFamily: 'monospace',
    },
    salesmanRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    salesmanText: {
      fontSize: 10.5,
      color: colors.textSecondary,
    },
    payableBadge: {
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    payableBadgeText: {
      fontSize: 9.5,
      fontWeight: '800',
      color: '#F59E0B',
    },
    overdueBadge: {
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    overdueBadgeText: {
      fontSize: 9.5,
      fontWeight: '800',
      color: '#EF4444',
    },
    ledgerMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
      flexWrap: 'wrap',
    },
    ledgerMetaText: {
      fontSize: 10,
      color: colors.textSecondary,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 12,
      textAlign: 'center',
      paddingVertical: 20,
    },
  });
