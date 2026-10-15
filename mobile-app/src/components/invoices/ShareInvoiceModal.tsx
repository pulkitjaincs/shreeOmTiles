import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/theme';
import { formatINR, formatDate } from '@/lib/formatters';
import { downloadAndSharePdf } from '@/lib/pdf';
import { Invoice } from './types';

interface ShareInvoiceModalProps {
  invoice: Invoice | null;
  visible: boolean;
  onClose: () => void;
  onShareWhatsApp: (invoice: Invoice) => void;
  onViewDetails?: (invoice: Invoice) => void;
}

export function ShareInvoiceModal({
  invoice,
  visible,
  onClose,
  onShareWhatsApp,
  onViewDetails,
}: ShareInvoiceModalProps) {
  const [downloading, setDownloading] = useState(false);

  if (!invoice) return null;

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      await downloadAndSharePdf(
        `invoices/${invoice.id}/pdf`,
        invoice.invoiceNo || `Invoice_${invoice.id}`,
      );
    } finally {
      setDownloading(false);
    }
  };

  const customerName = invoice.party?.name || invoice.partyName || 'Walk-in Customer';
  const customerPhone = invoice.party?.phone || invoice.partyPhone;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Invoice Generated!"
      subtitle="Counter sale recorded successfully"
    >
      <View style={styles.container}>
        {/* Success Icon */}
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark-circle" size={48} color="#10B981" />
        </View>

        {/* Invoice Summary Box */}
        <View style={styles.summaryCard}>
          <Text style={styles.invoiceNoText}>#{invoice.invoiceNo}</Text>
          <Text style={styles.totalText}>{formatINR(invoice.total)}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="person-outline" size={13} color={Colors.dark.textSecondary} />
              <Text style={styles.metaText} numberOfLines={1}>
                {customerName}
              </Text>
            </View>

            {customerPhone ? (
              <View style={styles.metaItem}>
                <Ionicons name="call-outline" size={13} color={Colors.dark.textSecondary} />
                <Text style={styles.metaText}>{customerPhone}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.badgeRow}>
            <View style={styles.modeBadge}>
              <Text style={styles.modeText}>{invoice.paymentMode || 'CASH'}</Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{invoice.status || 'PAID'}</Text>
            </View>
            <Text style={styles.dateText}>{formatDate(invoice.createdAt)}</Text>
          </View>
        </View>

        {/* Primary Action Buttons */}
        <View style={styles.actionsContainer}>
          {/* Share on WhatsApp */}
          <Button
            title="Share via WhatsApp"
            icon="logo-whatsapp"
            variant="primary"
            size="lg"
            onPress={() => onShareWhatsApp(invoice)}
            style={styles.whatsAppButton}
          />

          {/* Download / Share PDF */}
          <Button
            title={downloading ? 'Preparing PDF...' : 'Download / Share PDF'}
            icon="document-text-outline"
            variant="outline"
            size="md"
            loading={downloading}
            disabled={downloading}
            onPress={handleDownloadPdf}
          />

          {/* View Full Details (Optional) */}
          {onViewDetails ? (
            <Button
              title="View Invoice Details"
              icon="eye-outline"
              variant="secondary"
              size="md"
              onPress={() => {
                onClose();
                onViewDetails(invoice);
              }}
            />
          ) : null}

          {/* Done / Next Customer */}
          <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.doneBtnText}>Done / Next Customer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    alignItems: 'center',
    gap: 16,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    backgroundColor: Colors.dark.cardElevated,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    gap: 6,
  },
  invoiceNoText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#818CF8',
    fontFamily: 'monospace',
    letterSpacing: -0.3,
  },
  totalText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: '500',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Colors.dark.secondary,
  },
  modeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
  },
  dateText: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
  },
  actionsContainer: {
    width: '100%',
    gap: 10,
    marginTop: 4,
  },
  whatsAppButton: {
    backgroundColor: '#16A34A',
  },
  doneBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
});
