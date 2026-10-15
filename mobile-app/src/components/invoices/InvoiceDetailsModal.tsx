import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Colors } from '@/constants/theme';
import { formatINR, formatDate } from '@/lib/formatters';
import { downloadAndSharePdf } from '@/lib/pdf';

interface InvoiceDetailsModalProps {
  invoice: any | null;
  visible: boolean;
  onClose: () => void;
  onShareWhatsApp: (invoice: any) => void;
  onInitiateReturn?: (invoice: any) => void;
}

export function InvoiceDetailsModal({
  invoice,
  visible,
  onClose,
  onShareWhatsApp,
  onInitiateReturn,
}: InvoiceDetailsModalProps) {
  const [downloading, setDownloading] = useState(false);
  if (!invoice) return null;

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      await downloadAndSharePdf(`invoices/${invoice.id}/pdf`, invoice.invoiceNo || `Invoice_${invoice.id}`);
    } finally {
      setDownloading(false);
    }
  };

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
            <Text style={styles.detailTotalAmount}>{formatINR(invoice.total)}</Text>
            <Text style={styles.detailDateText}>{formatDate(invoice.createdAt)}</Text>
          </View>
          <StatusBadge status={invoice.status} />
        </View>

        <Text style={styles.modalSectionTitle}>Items Breakdown</Text>
        {(invoice.items || []).map((it: any) => (
          <View key={it.id} style={styles.itemDetailRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemDetailName}>{it.product?.name || 'Item'}</Text>
              <Text style={styles.itemDetailSub}>
                {it.warehouse?.name} • Batch: {it.batchNo || 'N/A'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.itemDetailQty}>
                {it.qty} {it.product?.unit || 'units'} × ₹{it.unitPrice}
              </Text>
              <Text style={styles.itemDetailTotal}>{formatINR(it.total)}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.modalSectionTitle}>Payment & Details</Text>
        <Card style={styles.detailMetaCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Payment Mode</Text>
            <Text style={styles.summaryVal}>{invoice.paymentMode || 'UPI'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Billed By</Text>
            <Text style={styles.summaryVal}>{invoice.salesman?.name || 'Staff'}</Text>
          </View>
          {invoice.notes ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Notes</Text>
              <Text style={[styles.summaryVal, { maxWidth: 200 }]}>{invoice.notes}</Text>
            </View>
          ) : null}
        </Card>

        <View style={{ gap: 10, marginTop: 16 }}>
          <Button
            title={downloading ? 'Downloading PDF...' : 'Download Official PDF'}
            icon="document-text-outline"
            variant="primary"
            loading={downloading}
            disabled={downloading}
            onPress={handleDownloadPdf}
          />
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
        </View>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  detailsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  detailTotalAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: '#10B981',
    fontFamily: 'monospace',
  },
  detailDateText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 12,
    marginBottom: 8,
  },
  itemDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  itemDetailName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  itemDetailSub: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
    marginTop: 2,
  },
  itemDetailQty: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  itemDetailTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.text,
    marginTop: 2,
  },
  detailMetaCard: {
    padding: 12,
    backgroundColor: Colors.dark.card,
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
    color: Colors.dark.textSecondary,
  },
  summaryVal: {
    fontSize: 12,
    color: Colors.dark.text,
    fontWeight: '600',
  },
});
