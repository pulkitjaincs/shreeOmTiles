import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Colors } from '@/constants/theme';
import { formatDate, formatINR } from '@/lib/formatters';
import { InvoiceListEntry } from './types';

interface InvoiceListCardProps {
  invoice: InvoiceListEntry;
  canReturn: boolean;
  isSupervisor?: boolean;
  onOpen: (invoice: InvoiceListEntry) => void;
  onDownloadPdf: (invoice: InvoiceListEntry) => void;
  onShareWhatsApp: (invoice: InvoiceListEntry) => void;
  onReturn: (invoice: InvoiceListEntry) => void;
  onEdit?: (invoice: InvoiceListEntry) => void;
}

export const InvoiceListCard = React.memo(function InvoiceListCard({
  invoice,
  canReturn,
  isSupervisor = false,
  onOpen,
  onDownloadPdf,
  onShareWhatsApp,
  onReturn,
  onEdit,
}: InvoiceListCardProps) {
  const refundedTotal = (invoice.refundInvoices || []).reduce(
    (sum, refund) => sum + Number(refund.total || 0),
    0,
  );

  return (
    <Card elevated style={styles.invoiceCard} onPress={() => onOpen(invoice)}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
          <Text style={styles.invoiceNumber} numberOfLines={1}>#{invoice.invoiceNo}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={styles.partyName} numberOfLines={1} ellipsizeMode="tail">
              {invoice.party?.name || invoice.partyName || (invoice.isCashSale ? 'Cash Sale' : 'Counter Sale')}
            </Text>
            {invoice.isCashSale ? (
              <View style={styles.cashSalePill}>
                <Text style={styles.cashSalePillText}>Cash Sale</Text>
              </View>
            ) : null}
          </View>
          {invoice.address ? (
            <Text style={styles.addressText} numberOfLines={1} ellipsizeMode="tail">
              📍 {invoice.address}
            </Text>
          ) : null}
          {invoice.party?.phone || invoice.partyPhone ? (
            <Text style={styles.partyPhone} numberOfLines={1}>{invoice.party?.phone || invoice.partyPhone}</Text>
          ) : null}
          <Text style={styles.dateText}>{formatDate(invoice.createdAt)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', flexShrink: 0, gap: 3 }}>
          {!isSupervisor ? (
            <Text
              style={styles.totalAmount}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {formatINR(invoice.total)}
            </Text>
          ) : (
            <Text style={[styles.totalAmount, { fontSize: 12, color: Colors.dark.textSecondary }]}>
              {invoice.items?.length ? `${invoice.items.length} items` : 'Order Items'}
            </Text>
          )}
          <StatusBadge status={invoice.status} size="sm" />
          {!isSupervisor && invoice.refundInvoices && invoice.refundInvoices.length > 0 ? (
            <View style={styles.refundCountBadge}>
              <Text style={styles.refundCountText}>
                Refunded ({invoice.refundInvoices.length})
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.cardBottom}>
        <View style={styles.badgeRow}>
          {!isSupervisor ? (
            <View style={[styles.modeBadge, invoice.paymentMode === 'SPLIT' && styles.splitBadge]}>
              <Text style={[styles.modeText, invoice.paymentMode === 'SPLIT' && styles.splitText]}>
                {invoice.paymentMode || 'CASH'}
              </Text>
            </View>
          ) : null}
          {!isSupervisor && refundedTotal > 0 ? (
            <Text style={styles.refundText} numberOfLines={1}>
              −{formatINR(refundedTotal)} refunded
            </Text>
          ) : null}
          <Text style={styles.salesmanText} numberOfLines={1} ellipsizeMode="tail">
            By: {invoice.salesman?.name || 'Staff'}
          </Text>
        </View>

        <View style={styles.actionsRow}>
          {!isSupervisor ? (
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => onDownloadPdf(invoice)}
              accessibilityRole="button"
              accessibilityLabel={`Share or save invoice ${invoice.invoiceNo} PDF`}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="document-text-outline" size={18} color="#3B82F6" />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={() => onShareWhatsApp(invoice)}
            accessibilityRole="button"
            accessibilityLabel={`Share invoice ${invoice.invoiceNo} on WhatsApp`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="logo-whatsapp" size={18} color="#10B981" />
          </TouchableOpacity>
          {canReturn ? (
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => onReturn(invoice)}
              accessibilityRole="button"
              accessibilityLabel={`Return items from invoice ${invoice.invoiceNo}`}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="return-up-back-outline" size={18} color="#A1A1AA" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  invoiceCard: { padding: 16, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  invoiceNumber: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.2 },
  partyName: { fontSize: 13, color: Colors.dark.textSecondary, marginTop: 2, fontWeight: '500' },
  partyPhone: { fontSize: 11, color: Colors.dark.textTertiary, marginTop: 1, fontFamily: 'monospace' },
  dateText: { fontSize: 11, color: Colors.dark.textTertiary, marginTop: 4 },
  totalAmount: { fontSize: 16, fontWeight: '900', color: '#FFFFFF', marginBottom: 4 },
  cardDivider: { height: 1, backgroundColor: Colors.dark.border, marginVertical: 12 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' },
  modeBadge: { backgroundColor: Colors.dark.secondary, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  modeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  splitBadge: {
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.3)',
  },
  splitText: {
    color: '#A78BFA',
  },
  refundText: { color: '#F87171', fontSize: 10, fontWeight: '700' },
  salesmanText: { color: Colors.dark.textTertiary, fontSize: 11 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: 8 },
  actionIconBtn: { padding: 4 },
  refundCountBadge: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  refundCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F87171',
  },
  cashSalePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  cashSalePillText: {
    color: '#10B981',
    fontSize: 9,
    fontWeight: '800',
  },
  addressText: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
    marginTop: 2,
  },
});
