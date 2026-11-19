import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { ThemeColors } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/lib/theme-context';
import { formatINR, formatDate, getInvoicePaidAmount } from '@/lib/formatters';
import { downloadAndSharePdf } from '@/lib/pdf';
import { useAuth } from '@/lib/auth-context';

interface InvoiceDetailsModalProps {
  invoice: any | null;
  visible: boolean;
  onClose: () => void;
  onShareWhatsApp: (invoice: any) => void;
  onDownloadRefundPdf?: (refundId: string, refundNo: string) => Promise<void> | void;
  onInitiateReturn?: (invoice: any) => void;
  onEditRefund?: (invoice: any, refund: any) => void;
  onDeleteRefund?: (invoice: any, refund: any) => void;
  onEdit?: (invoice: any) => void;
  canDelete?: boolean;
  onDeleteInvoice?: (invoice: any) => void;
  isSupervisor?: boolean;
}

export function InvoiceDetailsModal({
  invoice,
  visible,
  onClose,
  onShareWhatsApp,
  onDownloadRefundPdf,
  onInitiateReturn,
  onEditRefund,
  onDeleteRefund,
  onEdit,
  canDelete,
  onDeleteInvoice,
  isSupervisor = false,
}: InvoiceDetailsModalProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();
  const [downloading, setDownloading] = useState(false);
  if (!invoice) return null;

  const isSalesman = user?.role === 'SALESMAN';
  const canEditInvoice = !isSupervisor && Boolean(onEdit) && (!isSalesman || invoice.salesmanId === user?.id || (invoice.createdBy as any)?.id === user?.id);
  const canDeleteRefund = Boolean(canDelete && onDeleteRefund);

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      await downloadAndSharePdf(`invoices/${invoice.id}/pdf`, invoice.invoiceNo || `Invoice_${invoice.id}`);
    } finally {
      setDownloading(false);
    }
  };
  const refundedTotal = (invoice.refundInvoices || []).reduce(
    (sum: number, refund: any) => sum + Number(refund.total || 0),
    0,
  );
  const netTotal = Math.max(0, Number(invoice.total || 0) - refundedTotal);
  const subtotal = Number(invoice.subtotal || 0);
  const tax = Number(invoice.tax ?? invoice.taxAmount ?? 0);
  const taxRate = invoice.taxBreakup?.rate ?? (subtotal > 0 ? Math.round((tax / subtotal) * 100) : 18);
  const paid = getInvoicePaidAmount(invoice);
  const transportCost = Number(invoice.transportCost || 0);
  const transportTax = Number(invoice.transportTax || 0);
  const itemTax = Math.max(0, tax - transportTax);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={`Invoice #${invoice.invoiceNo}`}
      subtitle={`Billed to ${invoice.party?.name || 'Counter Sale'}`}
    >
      <View>
        <View style={styles.detailsHeaderRow}>
          <View>
            {!isSupervisor ? (
              <Text style={styles.detailTotalAmount}>{formatINR(invoice.total)}</Text>
            ) : (
              <Text style={[styles.detailTotalAmount, { fontSize: 18, color: colors.text }]}>
                {invoice.items?.length || 0} Line Items
              </Text>
            )}
            <Text style={styles.detailDateText}>{formatDate(invoice.invoiceDate || invoice.createdAt)}</Text>
          </View>
          <StatusBadge status={invoice.status} />
        </View>

        <Card style={styles.detailMetaCard}>
          {invoice.isCashSale ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Sale Type</Text>
              <Text style={[styles.summaryVal, { color: '#10B981', fontWeight: '700' }]}>
                Cash Sale (Counter Pickup)
              </Text>
            </View>
          ) : null}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Customer</Text>
            <Text style={styles.summaryVal}>
              {invoice.party?.name || (invoice.isCashSale ? 'Cash Sale' : 'Walk-in Customer')}
            </Text>
          </View>
          {invoice.party?.phone ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Phone</Text>
              <Text style={styles.summaryVal}>{invoice.party.phone}</Text>
            </View>
          ) : null}
          {invoice.address ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Bill Address</Text>
              <Text style={[styles.summaryVal, styles.wrapValue]}>{invoice.address}</Text>
            </View>
          ) : invoice.party?.address ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Address</Text>
              <Text style={[styles.summaryVal, styles.wrapValue]}>{invoice.party.address}</Text>
            </View>
          ) : null}
          {Number(invoice.previousBalance || 0) > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Prior Balance Context</Text>
              <Text style={[styles.summaryVal, { color: '#F59E0B' }]}>
                {formatINR(Number(invoice.previousBalance))}
              </Text>
            </View>
          ) : null}
          {!isSupervisor ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Payment Mode</Text>
              <Text style={styles.summaryVal}>
                {(invoice.payments || []).length > 0
                  ? (invoice.payments || [])
                      .map((p: any) => `${p.mode === 'CARD' ? 'Card (POS)' : p.mode === 'BANK_TRANSFER' ? 'Bank' : p.mode}: ${formatINR(p.amount)}`)
                      .join(' • ')
                  : invoice.paymentMode === 'CARD'
                  ? 'Card (POS Machine)'
                  : invoice.paymentMode === 'BANK_TRANSFER'
                  ? 'Bank Transfer'
                  : invoice.paymentMode || 'CASH'}
              </Text>
            </View>
          ) : null}
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Billed By</Text><Text style={styles.summaryVal}>{invoice.salesman?.name || 'Staff'}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Line Items</Text><Text style={styles.summaryVal}>{invoice.items?.length || 0}</Text></View>
          {invoice.notes ? <View style={styles.notesBox}><Text style={styles.summaryLabel}>Note</Text><Text style={styles.noteValue}>{invoice.notes}</Text></View> : null}
        </Card>

        {!isSupervisor ? (
          <Card elevated style={styles.financialCard}>
            <Text style={styles.financialTitle}>Invoice Summary</Text>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal</Text><Text style={styles.summaryVal}>{formatINR(subtotal)}</Text></View>
            {Number((invoice as any).discountAmount || 0) > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Bill Discount</Text>
                <Text style={styles.summaryVal}>−{formatINR(Number((invoice as any).discountAmount))}</Text>
              </View>
            ) : null}
            {transportCost > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Transport / Cartage</Text>
                <Text style={styles.summaryVal}>{formatINR(transportCost)}</Text>
              </View>
            ) : null}
            {invoice.taxBreakup ? (
              invoice.taxBreakup.isInterState ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>IGST ({invoice.taxBreakup.rate || taxRate}%)</Text>
                  <Text style={styles.summaryVal}>{formatINR(invoice.taxBreakup.items?.igst ?? itemTax)}</Text>
                </View>
              ) : (
                <>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>CGST ({((invoice.taxBreakup.rate || taxRate) / 2).toFixed(1)}%)</Text>
                    <Text style={styles.summaryVal}>{formatINR(invoice.taxBreakup.items?.cgst ?? itemTax / 2)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>SGST ({((invoice.taxBreakup.rate || taxRate) / 2).toFixed(1)}%)</Text>
                    <Text style={styles.summaryVal}>{formatINR(invoice.taxBreakup.items?.sgst ?? itemTax / 2)}</Text>
                  </View>
                </>
              )
            ) : itemTax > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>GST on Taxable Bill ({taxRate}%)</Text>
                <Text style={styles.summaryVal}>{formatINR(itemTax)}</Text>
              </View>
            ) : null}
            {transportTax > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Transport GST</Text>
                <Text style={styles.summaryVal}>{formatINR(transportTax)}</Text>
              </View>
            ) : null}
            {invoice.roundOffEnabled ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Round-off</Text>
                <Text style={styles.summaryVal}>
                  {Number(invoice.roundOffAmount || 0) >= 0 ? '+' : '−'}
                  {formatINR(Math.abs(Number(invoice.roundOffAmount || 0)))}
                </Text>
              </View>
            ) : null}
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Original total</Text><Text style={styles.summaryVal}>{formatINR(invoice.total)}</Text></View>
            {refundedTotal > 0 ? <View style={styles.summaryRow}><Text style={styles.refundAmountLabel}>Total refunded</Text><Text style={styles.refundAmountLabel}>−{formatINR(refundedTotal)}</Text></View> : null}
            <View style={[styles.summaryRow, styles.netTotalRow]}><Text style={styles.netTotalLabel}>Net payable total</Text><Text style={styles.netTotalValue}>{formatINR(netTotal)}</Text></View>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Paid</Text><Text style={styles.summaryVal}>{formatINR(paid)}</Text></View>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Balance due</Text><Text style={styles.summaryVal}>{formatINR(Math.max(0, netTotal - paid))}</Text></View>
          </Card>
        ) : null}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.modalSectionTitle}>Items Breakdown ({invoice.items?.length || 0})</Text>
          {(invoice.items || []).length > 0 ? (
            <Text style={styles.totalUnitsText}>
              Total: {(invoice.items || []).reduce((acc: number, it: any) => acc + Number(it.qty || 0), 0)} units
            </Text>
          ) : null}
        </View>
        {(invoice.items || []).length === 0 ? <Text style={styles.emptyText}>No line items found for this invoice.</Text> : null}
        {(invoice.items || []).map((it: any, index: number) => {
          const isReturned = Number(it.returnedQty || 0) > 0;
          return (
            <View key={it.id || index} style={styles.itemDetailRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.itemDetailName}>{it.product?.name || 'Item'}</Text>
                {!isSupervisor && Number(it.discount || 0) > 0 ? <Text style={styles.itemDetailSub}>Discount: {formatINR(it.discount)}</Text> : null}
                {isReturned ? (
                  <View style={styles.returnedBadge}>
                    <Text style={styles.returnedBadgeText}>
                      Returned: {it.returnedQty} {it.product?.unit || 'units'}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.itemDetailQty}>
                  {it.qty} {it.product?.unit || 'units'}{!isSupervisor ? ` × ₹${it.unitPrice}` : ''}
                </Text>
                {!isSupervisor ? (
                  <Text style={styles.itemDetailTotal}>{formatINR(it.total ?? (Number(it.qty || 0) * Number(it.unitPrice || 0)))}</Text>
                ) : null}
              </View>
            </View>
          );
        })}

        {!isSupervisor && (invoice.payments || []).length > 0 ? (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.modalSectionTitle}>Payment Receipts ({invoice.payments.length})</Text>
            </View>
            {(invoice.payments || []).map((pm: any, idx: number) => (
              <View key={pm.id || idx} style={styles.itemDetailRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.itemDetailName}>
                    {pm.mode === 'CARD'
                      ? 'Card (POS Machine)'
                      : pm.mode === 'BANK_TRANSFER' || pm.mode === 'BANK'
                      ? 'Bank Transfer'
                      : pm.mode === 'CASH'
                      ? 'Cash in Hand'
                      : pm.mode}{' '}
                    {pm.status && pm.status !== 'CONFIRMED' ? `(${pm.status})` : ''}
                  </Text>
                  <Text style={styles.itemDetailSub}>
                    {pm.referenceNo ? `Ref: ${pm.referenceNo} · ` : ''}{formatDate(pm.createdAt)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.itemDetailTotal, { color: colors.statusPaid }]}>
                    {formatINR(pm.amount)}
                  </Text>
                </View>
              </View>
            ))}
          </>
        ) : null}

        {(invoice.refundInvoices || []).length > 0 ? (
          <>
            <Text style={styles.modalSectionTitle}>Attached Credit Notes ({invoice.refundInvoices.length})</Text>
            {invoice.refundInvoices.map((refund: any) => (
              <Card key={refund.id} style={styles.refundCard}>
                <View style={styles.refundHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.refundNo}>#{refund.refundNo}</Text>
                    <Text style={styles.itemDetailSub}>{refund.refundMode} · {formatDate(refund.createdAt)}</Text>
                    <Text style={styles.refundAmountLabel}>Refund: {formatINR(refund.total)}</Text>
                  </View>
                  <Button
                    title={downloading ? 'Loading…' : 'Invoice PDF'}
                    icon="document-text-outline"
                    size="sm"
                    variant="outline"
                    loading={downloading}
                    disabled={downloading}
                    onPress={handleDownloadPdf}
                  />
                  {onEditRefund && (!isSalesman || invoice.salesmanId === user?.id || refund.createdById === user?.id) ? (
                    <Button
                      title="Edit"
                      icon="create-outline"
                      size="sm"
                      variant="outline"
                      onPress={() => onEditRefund(invoice, refund)}
                    />
                  ) : null}
                  {canDeleteRefund ? (
                    <Button
                      title="Delete"
                      icon="trash-outline"
                      size="sm"
                      variant="outline"
                      onPress={() => onDeleteRefund && onDeleteRefund(invoice, refund)}
                      style={{ borderColor: 'rgba(239, 68, 68, 0.4)', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                    />
                  ) : null}
                </View>
                {refund.reason ? (
                  <Text style={styles.itemDetailSub}>
                    Reason: {refund.reason}
                    {refund.createdBy?.name ? ` • Processed by ${refund.createdBy.name}` : ''}
                  </Text>
                ) : refund.createdBy?.name ? (
                  <Text style={styles.itemDetailSub}>Processed by {refund.createdBy.name}</Text>
                ) : null}
                {(refund.items || []).map((item: any, index: number) => (
                  <Text key={item.id || index} style={styles.refundItemText}>
                    {item.product?.name || 'Item'} · {item.qty} {item.product?.unit || ''} · {formatINR(item.total)}
                  </Text>
                ))}
              </Card>
            ))}
          </>
        ) : null}

        <View style={{ gap: 10, marginTop: 16 }}>
          {canEditInvoice && (
            <Button
              title="Edit Bill Details"
              icon="create-outline"
              variant="outline"
              onPress={() => {
                onClose();
                onEdit && onEdit(invoice);
              }}
              style={{
                borderColor: 'rgba(245, 158, 11, 0.4)',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
              }}
              textStyle={{ color: '#F59E0B' }}
            />
          )}
          {!isSupervisor ? (
            <Button
              title={downloading ? 'Downloading PDF...' : 'Download Official PDF'}
              icon="document-text-outline"
              variant="primary"
              loading={downloading}
              disabled={downloading}
              onPress={handleDownloadPdf}
            />
          ) : null}
          <Button
            title="Share on WhatsApp"
            icon="logo-whatsapp"
            variant="secondary"
            onPress={() => onShareWhatsApp(invoice)}
          />
          {invoice.status !== 'CANCELLED' && onInitiateReturn && (
            <Button
              title="Return Items / Credit Note"
              icon="return-up-back-outline"
              variant="outline"
              onPress={() => {
                onClose();
                onInitiateReturn(invoice);
              }}
            />
          )}
          {canDelete && invoice.status !== 'CANCELLED' && onDeleteInvoice && (
            <Button
              title="Delete Invoice & Restore Stock"
              icon="trash-outline"
              variant="outline"
              onPress={() => {
                onClose();
                onDeleteInvoice(invoice);
              }}
              style={{
                borderColor: 'rgba(239, 68, 68, 0.4)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
              }}
              textStyle={{ color: '#EF4444' }}
            />
          )}
        </View>
      </View>
    </BottomSheetModal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    detailsHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    detailTotalAmount: {
      fontSize: 24,
      fontWeight: '900',
      color: '#10B981',
      fontFamily: 'monospace',
    },
    detailDateText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
      marginBottom: 8,
    },
    modalSectionTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
    },
    totalUnitsText: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    itemDetailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    itemDetailName: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    itemDetailSub: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
    },
    itemDetailQty: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    itemDetailTotal: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      marginTop: 2,
    },
    detailMetaCard: {
      padding: 12,
      backgroundColor: colors.card,
      borderRadius: 12,
      marginVertical: 4,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginVertical: 3,
    },
    summaryLabel: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    summaryVal: {
      fontSize: 12,
      color: colors.text,
      fontWeight: '600',
    },
    financialCard: { padding: 12, marginTop: 10, backgroundColor: colors.card },
    financialTitle: { color: colors.text, fontSize: 13, fontWeight: '800', marginBottom: 7 },
    netTotalRow: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 8, marginTop: 6 },
    netTotalLabel: { color: colors.text, fontSize: 13, fontWeight: '800' },
    netTotalValue: { color: '#34D399', fontSize: 15, fontWeight: '900' },
    refundAmountLabel: { color: '#F87171', fontSize: 11, fontWeight: '700' },
    wrapValue: { maxWidth: '65%', textAlign: 'right' },
    notesBox: { marginTop: 5, paddingTop: 7, borderTopWidth: 1, borderTopColor: colors.border },
    noteValue: { color: colors.text, fontSize: 12, marginTop: 3 },
    emptyText: { color: colors.textTertiary, fontSize: 12, paddingVertical: 10 },
    refundCard: { padding: 12, marginBottom: 8, borderColor: 'rgba(248,113,113,0.25)' },
    refundHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 7 },
    refundNo: { color: '#F87171', fontSize: 14, fontWeight: '900' },
    refundItemText: { color: colors.textSecondary, fontSize: 11, paddingTop: 5 },
    returnedBadge: {
      alignSelf: 'flex-start',
      marginTop: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: 'rgba(239, 68, 68, 0.14)',
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.25)',
    },
    returnedBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#EF4444',
    },
  });
