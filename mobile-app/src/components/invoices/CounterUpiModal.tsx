import React from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, TouchableOpacity } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Colors } from '@/constants/theme';
import { formatINR } from '@/lib/formatters';
import { UpiAccount } from './types';

interface CounterUpiModalProps {
  visible: boolean;
  onClose: () => void;
  amount: number;
  balanceDue?: number;
  upiPreviewData: {
    qrDataUrl: string;
    vpa: string;
    amount: number;
  } | null;
  upiAccounts: UpiAccount[];
  selectedUpiAccount: UpiAccount | null;
  onSelectUpiAccount: (account: UpiAccount) => void;
  loadingQr: boolean;
  submitting: boolean;
  onConfirmUpi: () => void;
  onPayCashInstead: () => void;
}

export function CounterUpiModal({
  visible,
  onClose,
  amount,
  balanceDue = 0,
  upiPreviewData,
  upiAccounts,
  selectedUpiAccount,
  onSelectUpiAccount,
  loadingQr,
  submitting,
  onConfirmUpi,
  onPayCashInstead,
}: CounterUpiModalProps) {
  if (!visible) return null;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Counter UPI Payment"
      subtitle="Customer scans with GPay, PhonePe, Paytm, or BHIM"
    >
      <View style={styles.upiModalContainer}>
        <Text style={styles.upiAmountHeader}>{formatINR(amount)}</Text>
        <Text style={styles.upiVpaSub}>
          Target VPA: {upiPreviewData?.vpa || selectedUpiAccount?.upiId || 'Configured Store UPI'}
        </Text>

        {balanceDue > 0 ? (
          <View style={styles.balanceDueBanner}>
            <Text style={styles.balanceDueText}>
              Leftover Credit / Balance Due: {formatINR(balanceDue)}
            </Text>
          </View>
        ) : null}

        {/* UPI Account Selection Dropdown */}
        {upiAccounts.length > 0 ? (
          <View style={{ width: '100%', marginBottom: 10 }}>
            <Select
              label="Receive Payment Into UPI Account"
              placeholder="Select UPI Account..."
              value={selectedUpiAccount?.id || (upiAccounts.find((a) => a.isPrimary)?.id || upiAccounts[0]?.id || '')}
              onChange={(val) => {
                const acc = upiAccounts.find((a) => a.id === val) || null;
                if (acc) onSelectUpiAccount(acc);
              }}
              icon="qr-code-outline"
              options={upiAccounts.map((acc) => ({
                value: acc.id,
                label: acc.upiId,
                subLabel: acc.merchantName || undefined,
                badge: acc.isPrimary ? 'Default' : undefined,
              }))}
            />
          </View>
        ) : null}

        <View style={styles.upiQrBox}>
          {loadingQr ? (
            <View style={styles.qrLoadingBox}>
              <ActivityIndicator size="large" color={Colors.dark.primary} />
              <Text style={styles.qrLoadingText}>Generating dynamic UPI QR...</Text>
            </View>
          ) : upiPreviewData?.qrDataUrl ? (
            <Image
              source={{ uri: upiPreviewData.qrDataUrl }}
              style={styles.qrImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.qrLoadingBox}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          )}
        </View>

        <Text style={styles.upiNotice}>
          Verify payment on customer phone screen or store bank alert before issuing tax bill.
        </Text>

        <Button
          title="Payment Received & Issue Invoice"
          icon="checkmark-circle-outline"
          variant="primary"
          size="lg"
          loading={submitting}
          disabled={loadingQr || submitting}
          onPress={onConfirmUpi}
          style={styles.confirmButton}
        />

        <Button
          title="Customer Paying Cash Instead"
          icon="cash-outline"
          variant="secondary"
          loading={submitting}
          disabled={submitting}
          onPress={onPayCashInstead}
          style={styles.cashFallbackButton}
        />

        <TouchableOpacity
          onPress={onClose}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>Back to Edit Invoice</Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  upiModalContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  upiAmountHeader: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.dark.text,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  upiVpaSub: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  balanceDueBanner: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
    marginBottom: 10,
  },
  balanceDueText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FBBF24',
  },
  upiQrBox: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  qrLoadingBox: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  qrLoadingText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  upiNotice: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  confirmButton: {
    width: '100%',
    marginTop: 12,
    backgroundColor: '#10B981',
  },
  cashFallbackButton: {
    width: '100%',
    marginTop: 8,
  },
  backButton: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  backButtonText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
});
