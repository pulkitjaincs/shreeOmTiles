import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Colors } from '@/constants/theme';
import { mobileApiRequest } from '@/lib/api';
import { formatINR, formatDate, getWhatsAppUrl } from '@/lib/formatters';
import { Party, StatementInvoice, StatementCreditLedger } from './types';
import { Ionicons } from '@expo/vector-icons';
import { downloadAndSharePdf } from '@/lib/pdf';

interface PartyStatementDrawerProps {
  party: Party | null;
  onClose: () => void;
  onPartyDeleted: () => void;
  canDelete?: boolean;
  onEdit?: (party: Party) => void;
  onDelete?: (party: Party) => void;
}

export function PartyStatementDrawer({
  party,
  onClose,
  onPartyDeleted,
  canDelete = false,
  onEdit,
  onDelete,
}: PartyStatementDrawerProps) {
  const [statementData, setStatementData] = useState<{
    invoices: StatementInvoice[];
    creditLedgers: StatementCreditLedger[];
    payments?: any[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'orders' | 'credits'>('orders');
  const [deleting, setDeleting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [now] = useState(() => Date.now());

  const partyId = party?.id;

  useEffect(() => {
    if (!partyId) {
      setStatementData(null);
      return;
    }

    setStatementData(null);
    setTab('orders');
    setLoading(true);
    let ignore = false;

    mobileApiRequest<any>(`/parties/${partyId}`)
      .then((data) => {
        if (!ignore) {
          setStatementData(data);
        }
      })
      .catch((err: any) => {
        if (!ignore) {
          Alert.alert('Error', err.message || 'Failed to load customer statement');
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [partyId]);

  if (!party) return null;

  const invoices = statementData?.invoices || [];
  const ledgers = statementData?.creditLedgers || [];

  const lifetimeTotal = invoices
    .filter((inv: any) => inv.status !== 'CANCELLED' && inv.status !== 'DRAFT')
    .reduce((sum: number, inv: any) => sum + Number(inv.total || 0), 0);

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

  const totalDues = ledgers
    .filter((cl) => cl.status !== 'SETTLED')
    .reduce((sum, cl) => {
      const amt = Number(cl.amountDue || 0);
      return cl.type === 'RECEIVABLE' ? sum + amt : sum - amt;
    }, 0);

  const partyPayables = ledgers
    .filter((cl) => cl.status !== 'SETTLED' && cl.type === 'PAYABLE')
    .reduce((sum, cl) => sum + Number(cl.amountDue || 0), 0);

  const isDue = totalDues > 0.01;
  const isPayable = !isDue && (totalDues < -0.01 || partyPayables > 0.01);
  const payableAmt = totalDues < -0.01 ? Math.abs(totalDues) : partyPayables;
  const hasPendingLiability = isDue || isPayable;

  const handleShareStatement = () => {
    const msg =
      `*ACCOUNT STATEMENT — SHREE OM TILES*\n\n` +
      `Customer: *${party.name}*\n` +
      `Phone: ${party.phone}\n` +
      (party.gstin ? `GSTIN: ${party.gstin}\n` : '') +
      (party.address ? `Address: ${party.address}\n` : '') +
      `\n*Financial Summary:*\n` +
      `• Lifetime Billing: ${formatINR(lifetimeTotal)}\n` +
      `• Total Received: ${formatINR(settledPayments)}\n` +
      (isDue
        ? `• *Current Balance Due: ${formatINR(totalDues)}*\n`
        : isPayable
        ? `• *Store Credit / Payable Available: ${formatINR(payableAmt)}*\n`
        : `• *Account Balance: ₹0.00 (All Clear)*\n`) +
      `• Total Orders: ${invoices.length}\n\n` +
      (isDue
        ? `Kindly arrange payment clearance of ${formatINR(totalDues)} at your earliest convenience.\n\n`
        : isPayable
        ? `You have an available store credit / payable balance of ${formatINR(payableAmt)} with Shree Om Tiles.\n\n`
        : `All accounts are currently in clear standing!\n\n`) +
      `Shree Om Tiles`;

    const url = getWhatsAppUrl(party.phone, msg);

    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open WhatsApp');
    });
  };

  const handleDownloadPdf = async () => {
    if (!party) return;
    setDownloadingPdf(true);
    try {
      const safeName = (party.name || 'Party').replace(/[^a-zA-Z0-9_-]/g, '_');
      await downloadAndSharePdf(`parties/${party.id}/statement-pdf`, `Statement_${safeName}`);
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
      visible={Boolean(party)}
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
          <Ionicons name="alert-circle-outline" size={32} color={Colors.dark.textTertiary} />
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
              <Text style={styles.kpiLabel}>Lifetime Billed</Text>
              <Text style={styles.kpiValue}>{formatINR(lifetimeTotal)}</Text>
              <Text style={styles.kpiSub}>All orders</Text>
            </Card>

            <Card style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total Orders</Text>
              <Text style={styles.kpiValue}>{invoices.length}</Text>
              <Text style={styles.kpiSub}>Invoices generated</Text>
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
              <Text style={styles.kpiSub}>Confirmed receipts</Text>
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
              onPress={handleDownloadPdf}
              style={styles.pdfStatementBtn}
            />
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
                    color={hasPendingLiability ? Colors.dark.textTertiary : '#EF4444'}
                  />
                )}
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Tabs: Orders vs Credit Ledgers */}
          <View style={styles.tabToggle}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'orders' && styles.tabBtnActive]}
              onPress={() => setTab('orders')}
            >
              <Text style={[styles.tabText, tab === 'orders' && styles.tabTextActive]}>
                Orders ({invoices.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, tab === 'credits' && styles.tabBtnActive]}
              onPress={() => setTab('credits')}
            >
              <Text style={[styles.tabText, tab === 'credits' && styles.tabTextActive]}>
                Credit Ledgers ({ledgers.length})
              </Text>
            </TouchableOpacity>
          </View>

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
                      <Ionicons name="person-outline" size={11} color={Colors.dark.textTertiary} />
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
                              ? `Invoice #${cl.invoice.invoiceNo}`
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
        </View>
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  centerLoading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.dark.textSecondary,
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
    backgroundColor: '#16161A',
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
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    marginVertical: 2,
  },
  kpiSub: {
    fontSize: 9.5,
    color: Colors.dark.textTertiary,
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
    backgroundColor: Colors.dark.cardElevated,
    borderWidth: 1,
    borderColor: Colors.dark.borderMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerIconBtnDisabled: {
    opacity: 0.5,
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
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  tabTextActive: {
    color: '#09090B',
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
    color: '#FFFFFF',
  },
  orderDate: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  orderAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  orderItemsCount: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 6,
  },
  itemsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    gap: 4,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  itemName: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  itemMeta: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
    marginTop: 1,
  },
  itemTotal: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.dark.text,
    fontFamily: 'monospace',
  },
  salesmanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
  },
  salesmanText: {
    fontSize: 10.5,
    color: Colors.dark.textSecondary,
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
    color: Colors.dark.textSecondary,
  },
  emptyText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
