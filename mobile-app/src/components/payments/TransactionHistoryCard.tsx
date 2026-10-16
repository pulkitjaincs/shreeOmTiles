import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Colors } from '@/constants/theme';
import { formatINR, formatDateTime, cleanPhoneNumber } from '@/lib/formatters';
import { buildPaymentReceiptShareUrl } from '@/lib/whatsapp';
import { PaymentRecord } from './types';

interface TransactionHistoryCardProps {
  payment: PaymentRecord;
  confirmingId: string | null;
  onConfirm: (paymentId: string) => void;
}

export function TransactionHistoryCard({
  payment,
  confirmingId,
  onConfirm,
}: TransactionHistoryCardProps) {
  const isInflow = payment.type !== 'OUTFLOW';
  const partyName = payment.invoice?.party?.name || payment.party?.name || 'Walk-in Customer';
  const partyPhone = payment.invoice?.party?.phone || payment.party?.phone;
  const cleanPhone = cleanPhoneNumber(partyPhone);
  const invNo = payment.invoice?.invoiceNo;

  const handleCall = () => {
    if (cleanPhone) {
      Linking.openURL(`tel:${cleanPhone}`).catch(() => {
        Alert.alert('Error', 'Unable to initiate call');
      });
    }
  };

  const handleShareReceipt = () => {
    const url = buildPaymentReceiptShareUrl({
      phone: cleanPhone,
      customerName: partyName,
      amount: payment.amount,
      mode: payment.mode,
      invoiceNo: invNo,
      utr: payment.upiTxnRef || payment.upiUtr,
      date: formatDateTime(payment.createdAt),
    });

    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open WhatsApp. Please ensure WhatsApp is installed.');
    });
  };

  return (
    <Card elevated style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <View style={styles.typeBadgeRow}>
            <View
              style={[
                styles.typeBadge,
                isInflow ? styles.typeInflow : styles.typeOutflow,
              ]}
            >
              <Ionicons
                name={isInflow ? 'arrow-down-outline' : 'arrow-up-outline'}
                size={12}
                color={isInflow ? '#10B981' : '#EF4444'}
              />
              <Text
                style={[
                  styles.typeText,
                  { color: isInflow ? '#10B981' : '#EF4444' },
                ]}
              >
                {isInflow ? 'INFLOW' : 'OUTFLOW'}
              </Text>
            </View>
            <View style={styles.modeBadge}>
              <Text style={styles.modeBadgeText}>{payment.mode}</Text>
            </View>
          </View>

          <Text style={styles.partyTitle} numberOfLines={1}>
            {partyName}
          </Text>
          {partyPhone ? (
            <TouchableOpacity onPress={handleCall} style={styles.phoneTouch} activeOpacity={0.7}>
              <Ionicons name="call-outline" size={11} color="#38BDF8" />
              <Text style={styles.phoneText}>{partyPhone}</Text>
            </TouchableOpacity>
          ) : null}
          {invNo ? <Text style={styles.invoiceRef}>Invoice #{invNo}</Text> : null}
          <Text style={styles.timestamp}>{formatDateTime(payment.createdAt)}</Text>
        </View>

        <View style={styles.amountCol}>
          <Text
            style={[
              styles.paymentAmount,
              { color: isInflow ? '#10B981' : '#F59E0B' },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {isInflow ? `+${formatINR(payment.amount)}` : `-${formatINR(payment.amount)}`}
          </Text>
          <StatusBadge status={payment.status} size="sm" />
          {payment.confirmedBy?.name ? (
            <Text style={styles.confirmedByText}>By: {payment.confirmedBy.name}</Text>
          ) : null}
        </View>
      </View>

      {payment.upiTxnRef || payment.upiUtr ? (
        <View style={styles.utrBox}>
          <Ionicons name="barcode-outline" size={13} color={Colors.dark.textSecondary} />
          <Text style={styles.utrText}>
            UTR / Ref: {payment.upiTxnRef || payment.upiUtr}
          </Text>
        </View>
      ) : null}

      {payment.notes ? (
        <Text style={styles.notesText}>Note: {payment.notes}</Text>
      ) : null}

      {/* Action Row */}
      <View style={styles.actionRow}>
        {isInflow && (
          <TouchableOpacity
            style={styles.shareReceiptBtn}
            onPress={handleShareReceipt}
            activeOpacity={0.7}
          >
            <Ionicons name="logo-whatsapp" size={13} color="#10B981" />
            <Text style={styles.shareReceiptText}>Share Receipt</Text>
          </TouchableOpacity>
        )}

        {payment.status === 'PENDING' ? (
          <Button
            title="Confirm Receipt"
            icon="checkmark-circle-outline"
            size="sm"
            variant="primary"
            loading={confirmingId === payment.id}
            onPress={() => onConfirm(payment.id)}
            style={styles.confirmBtn}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.card,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  typeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 4,
  },
  typeInflow: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  typeOutflow: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modeBadge: {
    backgroundColor: Colors.dark.cardElevated,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    fontFamily: 'monospace',
  },
  partyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  phoneTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  phoneText: {
    fontSize: 11,
    color: '#38BDF8',
    fontFamily: 'monospace',
  },
  invoiceRef: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  timestamp: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
    marginTop: 3,
  },
  amountCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  confirmedByText: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
    fontStyle: 'italic',
  },
  utrBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dark.cardElevated,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  utrText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: Colors.dark.textSecondary,
  },
  notesText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontStyle: 'italic',
    marginTop: 6,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  shareReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  shareReceiptText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  confirmBtn: {
    backgroundColor: '#10B981',
  },
});
