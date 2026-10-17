import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/theme';
import { formatINR } from '@/lib/formatters';
import { buildPaymentReceiptShareUrl } from '@/lib/whatsapp';

export interface SettlementSuccessData {
  direction: 'COLLECT' | 'PAY';
  amount: number;
  partyName: string;
  partyPhone?: string;
  mode: string;
  invoiceNo?: string;
  utr?: string;
  notes?: string;
  date?: string;
}

interface SettlementSuccessModalProps {
  visible: boolean;
  data: SettlementSuccessData | null;
  onClose: () => void;
}

export function SettlementSuccessModal({
  visible,
  data,
  onClose,
}: SettlementSuccessModalProps) {
  if (!data) return null;

  const isCollect = data.direction === 'COLLECT';
  const themeColor = isCollect ? '#10B981' : '#F59E0B';

  const handleShareWhatsApp = () => {
    try {
      const url = buildPaymentReceiptShareUrl({
        phone: data.partyPhone,
        customerName: data.partyName,
        amount: data.amount,
        mode: data.mode,
        invoiceNo: data.invoiceNo,
        utr: data.utr,
        date: data.date || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      });

      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Unable to open WhatsApp. Please ensure WhatsApp is installed.');
      });
    } catch {
      Alert.alert('Error', 'Failed to generate WhatsApp share message');
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Settlement Recorded"
      subtitle={
        isCollect
          ? 'Customer receipt successfully logged in ERP'
          : 'Store disbursement successfully recorded'
      }
    >
      <View style={styles.container}>
        {/* Glow Success Icon */}
        <View
          style={[
            styles.iconWrapper,
            { backgroundColor: isCollect ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)' },
          ]}
        >
          <View
            style={[
              styles.iconInner,
              { backgroundColor: isCollect ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)' },
            ]}
          >
            <Ionicons
              name={isCollect ? 'checkmark-circle' : 'arrow-up-circle'}
              size={44}
              color={themeColor}
            />
          </View>
        </View>

        {/* Amount Display */}
        <View style={styles.amountContainer}>
          <Text style={[styles.amountText, { color: themeColor }]}>
            {isCollect ? `+${formatINR(data.amount)}` : `-${formatINR(data.amount)}`}
          </Text>
          <View
            style={[
              styles.directionBadge,
              {
                backgroundColor: isCollect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                borderColor: isCollect ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)',
              },
            ]}
          >
            <Ionicons
              name={isCollect ? 'arrow-down' : 'arrow-up'}
              size={12}
              color={themeColor}
            />
            <Text style={[styles.directionBadgeText, { color: themeColor }]}>
              {isCollect ? 'INFLOW SETTLED' : 'OUTFLOW DISBURSED'}
            </Text>
          </View>
        </View>

        {/* Receipt Details Card */}
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Party</Text>
            <View style={styles.partyInfoCol}>
              <Text style={styles.detailValue} numberOfLines={1}>
                {data.partyName}
              </Text>
              {data.partyPhone ? (
                <Text style={styles.partyPhone}>{data.partyPhone}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment Mode</Text>
            <View style={styles.modeBadge}>
              <Ionicons
                name={
                  data.mode === 'CASH'
                    ? 'cash-outline'
                    : data.mode === 'UPI'
                    ? 'qr-code-outline'
                    : data.mode === 'SPLIT'
                    ? 'git-merge-outline'
                    : 'business-outline'
                }
                size={12}
                color={Colors.dark.text}
              />
              <Text style={styles.modeBadgeText}>
                {data.mode === 'CASH'
                  ? 'Cash in Hand'
                  : data.mode === 'UPI'
                  ? 'UPI Transfer'
                  : data.mode === 'SPLIT'
                  ? 'Split Payment'
                  : data.mode}
              </Text>
            </View>
          </View>

          {data.invoiceNo ? (
            <>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Invoice Ref</Text>
                <Text style={styles.detailValueMono}>#{data.invoiceNo}</Text>
              </View>
            </>
          ) : null}

          {data.utr ? (
            <>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>UTR / Ref</Text>
                <Text style={styles.detailValueMono}>{data.utr}</Text>
              </View>
            </>
          ) : null}

          {data.notes ? (
            <>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Note</Text>
                <Text style={styles.detailValue} numberOfLines={2}>
                  {data.notes}
                </Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {isCollect && (
            <Button
              title="Share Receipt on WhatsApp"
              icon="logo-whatsapp"
              variant="primary"
              size="lg"
              onPress={handleShareWhatsApp}
              style={styles.waButton}
            />
          )}

          <TouchableOpacity
            style={styles.doneButton}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  amountText: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: 'monospace',
    letterSpacing: -0.5,
  },
  directionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
  },
  directionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  detailsCard: {
    width: '100%',
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 13,
    color: Colors.dark.text,
    fontWeight: '700',
    maxWidth: '65%',
    textAlign: 'right',
  },
  detailValueMono: {
    fontSize: 12,
    color: Colors.dark.text,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  partyInfoCol: {
    alignItems: 'flex-end',
    maxWidth: '65%',
  },
  partyPhone: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontFamily: 'monospace',
    marginTop: 1,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.dark.cardElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  modeBadgeText: {
    fontSize: 11,
    color: Colors.dark.text,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  actionButtons: {
    width: '100%',
    gap: 10,
  },
  waButton: {
    backgroundColor: '#10B981',
  },
  doneButton: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: Colors.dark.cardElevated,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  doneButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.text,
  },
});
