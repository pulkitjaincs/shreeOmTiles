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
import { cleanPhoneNumber, formatINR, formatDate } from '@/lib/formatters';
import { Party, StatementInvoice, StatementCreditLedger } from './types';
import { Ionicons } from '@expo/vector-icons';
import { downloadAndSharePdf } from '@/lib/pdf';

interface PartyStatementDrawerProps {
  party: Party | null;
  onClose: () => void;
  onPartyDeleted: () => void;
  canDelete?: boolean;
  onEdit?: (party: Party) => void;
}

export function PartyStatementDrawer({
  party,
  onClose,
  onPartyDeleted,
  canDelete = false,
  onEdit,
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

  useEffect(() => {
    if (party) {
      setStatementData(null);
      setTab('orders');
      setLoading(true);
      mobileApiRequest<any>(`/parties/${party.id}`)
        .then((data) => {
          setStatementData(data);
        })
        .catch((err: any) => {
          Alert.alert('Error', err.message || 'Failed to load customer statement');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [party]);

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

  const handleShareStatement = () => {
    const clean = cleanPhoneNumber(party.phone);
    const msg =
      `*ACCOUNT STATEMENT — SHREE OM TILES*\n\n` +
      `Customer: *${party.name}*\n` +
      `Phone: ${party.phone}\n` +
      (party.gstin ? `GSTIN: ${party.gstin}\n` : '') +
      `\n*Financial Summary:*\n` +
      `• Lifetime Billing: ${formatINR(lifetimeTotal)}\n` +
      `• Total Received: ${formatINR(settledPayments)}\n` +
      (totalDues > 0
        ? `• *Current Balance Due: ${formatINR(totalDues)}*\n`
        : totalDues < 0
        ? `• *Store Credit Available: ${formatINR(Math.abs(totalDues))}*\n`
        : `• *Account Balance: ₹0.00 (All Clear)*\n`) +
      `• Total Orders: ${invoices.length}\n\n` +
      (totalDues > 0
        ? `Kindly arrange payment clearance of ${formatINR(totalDues)} at your earliest convenience.\n\n`
        : totalDues < 0
        ? `You have an advance store credit balance of ${formatINR(Math.abs(totalDues))} available.\n\n`
        : `All accounts are currently in clear standing!\n\n`) +
      `Shree Om Tiles`;

    const url = clean
      ? `https://wa.me/91${clean}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

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
  };

  return (
    <BottomSheetModal
      visible={Boolean(party)}
      onClose={onClose}
      title={party.name}
      subtitle={`Phone: ${party.phone} ${party.gstin ? '• GST: ' + party.gstin : ''}`}
      maxHeightPercent={0.92}
    >
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading complete customer history...</Text>
        </View>
      ) : (
        <View>
          {/* KPI Summary Cards */}
          <View style={styles.kpiGrid}>
            <Card style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Lifetime Billed</Text>
              <Text style={styles.kpiValue}>{formatINR(lifetimeTotal)}</Text>
              <Text style={styles.kpiSub}>{invoices.length} invoices</Text>
            </Card>

            <Card style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total Paid</Text>
              <Text style={[styles.kpiValue, { color: '#10B981' }]}>
                {formatINR(settledPayments)}
              </Text>
              <Text style={styles.kpiSub}>Confirmed receipts</Text>
            </Card>

            <Card
              style={[
                styles.kpiCard,
                totalDues > 0 ? styles.kpiDueCard : null,
              ]}
            >
              <Text style={styles.kpiLabel}>
                {totalDues < 0 ? 'Store Credit' : 'Outstanding Dues'}
              </Text>
              <Text
                style={[
                  styles.kpiValue,
                  { color: totalDues > 0 ? '#EF4444' : totalDues < 0 ? '#3B82F6' : '#10B981' },
                ]}
              >
                {formatINR(Math.abs(totalDues))}
              </Text>
              <Text style={styles.kpiSub}>
                {totalDues > 0 ? 'Pending collection' : totalDues < 0 ? 'Advance credit' : 'All clear'}
              </Text>
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
                style={[styles.drawerIconBtn, totalDues > 0 && styles.drawerIconBtnDisabled]}
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
                    color={totalDues > 0 ? Colors.dark.textTertiary : '#EF4444'}
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
                    {(inv.items || []).length} item
                    {(inv.items || []).length === 1 ? '' : 's'} • Mode:{' '}
                    {inv.paymentMode || 'UPI'}
                  </Text>
                </Card>
              ))
            ) : (
              <Text style={styles.emptyText}>No invoices generated for this customer yet</Text>
            )
          ) : null}

          {/* Tab 2: Credit Ledgers */}
          {tab === 'credits' ? (
            ledgers.length > 0 ? (
              ledgers.map((cl) => (
                <Card key={cl.id} style={styles.orderCard}>
                  <View style={styles.orderTop}>
                    <View>
                      <Text style={styles.orderNo}>
                        {cl.invoice?.invoiceNo
                          ? `Invoice #${cl.invoice.invoiceNo}`
                          : 'Credit Ledger'}
                      </Text>
                      {cl.dueDate ? (
                        <Text style={styles.orderDate}>Due: {formatDate(cl.dueDate)}</Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text
                        style={[
                          styles.orderAmount,
                          { color: cl.status === 'SETTLED' ? '#10B981' : '#EF4444' },
                        ]}
                      >
                        {formatINR(cl.amountDue)}
                      </Text>
                      <StatusBadge status={cl.status} size="sm" />
                    </View>
                  </View>
                </Card>
              ))
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
  kpiGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#16161A',
  },
  kpiDueCard: {
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
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
    marginBottom: 14,
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
  emptyText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
