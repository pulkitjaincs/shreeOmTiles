import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/theme';
import { formatINR, formatDate } from '@/lib/formatters';
import { mobileApiRequest, invalidateMobileApiCache } from '@/lib/api';

interface DeleteInvoiceModalProps {
  invoice: any | null;
  visible: boolean;
  onClose: () => void;
  onSuccess: (deletedInvoiceId: string) => void;
}

export function DeleteInvoiceModal({
  invoice,
  visible,
  onClose,
  onSuccess,
}: DeleteInvoiceModalProps) {
  const [forceDelivered, setForceDelivered] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!invoice) return null;

  const hasDelivered = (invoice.deliveries || []).some(
    (d: any) => d.status === 'DELIVERED',
  );
  const hasRefunds = (invoice.refundInvoices?.length || 0) > 0;

  const handleDelete = async () => {
    if (hasDelivered && !forceDelivered) {
      setError('Please acknowledge the physical goods return/verification checkbox.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await mobileApiRequest(
        `/invoices/${invoice.id}?forceDelivered=${forceDelivered}`,
        { method: 'DELETE' },
      );
      await invalidateMobileApiCache();
      onSuccess(invoice.id);
      onClose();
      Alert.alert('Invoice Deleted', `Invoice #${invoice.invoiceNo} successfully deleted. Inventory has been restored.`);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to delete invoice';
      setError(msg);
      Alert.alert('Deletion Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Delete Invoice & Restore Stock"
      subtitle={`Invoice #${invoice.invoiceNo} • ${formatDate(invoice.createdAt)}`}
    >
      <View style={styles.container}>
        {/* Invoice Summary Card */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Customer</Text>
            <Text style={styles.summaryValue}>{invoice.party?.name || 'Walk-in Customer'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Invoice Amount</Text>
            <Text style={[styles.summaryValue, styles.amountHighlight]}>
              {formatINR(invoice.total)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Status & Mode</Text>
            <Text style={styles.summaryValue}>
              {invoice.status} ({invoice.paymentMode || 'CASH'})
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Line Items</Text>
            <Text style={styles.summaryValue}>{invoice.items?.length || 0} item(s)</Text>
          </View>
        </Card>

        {/* Warning Banner */}
        <View style={styles.warningBanner}>
          <View style={styles.warningHeader}>
            <Ionicons name="warning" size={16} color="#EF4444" />
            <Text style={styles.warningTitle}>Irreversible Action & System Effects:</Text>
          </View>
          <Text style={styles.warningBullet}>• Product quantities will be restored back to warehouse stock.</Text>
          <Text style={styles.warningBullet}>• Associated deliveries, trips, and ledger entries will be removed.</Text>
          <Text style={styles.warningBullet}>• Outstanding customer balances for this invoice will be reversed.</Text>
          <Text style={styles.warningBullet}>• An immutable audit log records this deletion.</Text>
        </View>

        {/* Refund blocker */}
        {hasRefunds && (
          <View style={styles.refundBlocker}>
            <Ionicons name="alert-circle" size={16} color="#F59E0B" />
            <Text style={styles.refundBlockerText}>
              This invoice has {invoice.refundInvoices?.length} processed credit note(s). Invoices with returns cannot be directly deleted.
            </Text>
          </View>
        )}

        {/* Delivered Goods Checkbox */}
        {hasDelivered && (
          <TouchableOpacity
            style={[styles.checkboxContainer, forceDelivered && styles.checkboxActive]}
            onPress={() => setForceDelivered(!forceDelivered)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={forceDelivered ? 'checkbox' : 'square-outline'}
              size={20}
              color={forceDelivered ? Colors.dark.primary : '#F59E0B'}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.checkboxTitle}>Goods Have Already Been Delivered</Text>
              <Text style={styles.checkboxSub}>
                I verify that physical goods from this order have either returned to warehouse stock or were explicitly written off.
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={14} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <Button
            title="Cancel"
            variant="outline"
            onPress={onClose}
            disabled={submitting}
            style={styles.cancelBtn}
          />
          <Button
            title={submitting ? 'Deleting...' : 'Delete & Restore'}
            variant="primary"
            loading={submitting}
            disabled={submitting || hasRefunds || (hasDelivered && !forceDelivered)}
            onPress={handleDelete}
            style={[
              styles.deleteBtn,
              (hasRefunds || (hasDelivered && !forceDelivered)) && styles.disabledBtn,
            ]}
            textStyle={{ color: '#FFFFFF' }}
          />
        </View>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  summaryCard: {
    padding: 12,
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  amountHighlight: {
    color: '#10B981',
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  warningBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  warningTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EF4444',
  },
  warningBullet: {
    fontSize: 11,
    color: '#FCA5A5',
    lineHeight: 16,
  },
  refundBlocker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  refundBlockerText: {
    flex: 1,
    fontSize: 11,
    color: '#FCD34D',
    lineHeight: 15,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  checkboxActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  checkboxTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FCD34D',
  },
  checkboxSub: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
    marginTop: 2,
    lineHeight: 14,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 8,
  },
  errorText: {
    fontSize: 11,
    color: '#EF4444',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
  },
  deleteBtn: {
    flex: 1.4,
    backgroundColor: '#DC2626',
  },
  disabledBtn: {
    opacity: 0.5,
  },
});
