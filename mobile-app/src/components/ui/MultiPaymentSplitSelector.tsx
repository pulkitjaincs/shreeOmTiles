import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { formatINR } from '@/lib/formatters';
import { PaymentMethodType, PaymentSplitItem } from '@/components/invoices/types';

export type { PaymentMethodType, PaymentSplitItem };

export interface MultiPaymentSplitSelectorProps {
  totalAmount: number;
  splits: PaymentSplitItem[];
  onChange: (splits: PaymentSplitItem[]) => void;
  allowCredit?: boolean;
  creditLabel?: string;
  balanceLabel?: string;
  allowZero?: boolean;
  onPreviewUpi?: (amount: number) => void;
  previewUpiLoading?: boolean;
}

export function MultiPaymentSplitSelector({
  totalAmount,
  splits,
  onChange,
  allowCredit = true,
  creditLabel,
  balanceLabel,
  allowZero,
  onPreviewUpi,
  previewUpiLoading = false,
}: MultiPaymentSplitSelectorProps) {
  const effectiveCreditLabel = balanceLabel || creditLabel || 'Due:';
  const effectiveAllowCredit = allowCredit ?? allowZero ?? true;
  const modeConfigs: Record<
    PaymentMethodType,
    { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bgColor: string }
  > = {
    CASH: {
      label: 'Cash in Hand',
      icon: 'cash-outline',
      color: '#10B981',
      bgColor: 'rgba(16, 185, 129, 0.12)',
    },
    UPI: {
      label: 'UPI / Live QR',
      icon: 'qr-code-outline',
      color: '#6366F1',
      bgColor: 'rgba(99, 102, 241, 0.12)',
    },
    BANK_TRANSFER: {
      label: 'Bank Transfer',
      icon: 'business-outline',
      color: '#0EA5E9',
      bgColor: 'rgba(14, 165, 233, 0.12)',
    },
  };

  const totalPaidNow = splits.reduce((sum, s) => {
    const parsed = parseFloat(s.amount);
    return sum + (isNaN(parsed) || parsed < 0 ? 0 : parsed);
  }, 0);

  const roundedTotal = Math.round(totalAmount * 100) / 100;
  const roundedPaid = Math.round(totalPaidNow * 100) / 100;
  const balanceDue = Math.max(0, Math.round((roundedTotal - roundedPaid) * 100) / 100);
  const isOverpaid = roundedPaid > roundedTotal && roundedTotal > 0;

  const handleAddMode = (mode: PaymentMethodType) => {
    if (splits.some((s) => s.mode === mode)) return;
    const remaining = balanceDue > 0 ? balanceDue.toFixed(2) : '';
    onChange([...splits, { mode, amount: remaining }]);
  };

  const handleRemoveMode = (mode: PaymentMethodType) => {
    onChange(splits.filter((s) => s.mode !== mode));
  };

  const handleAmountChange = (index: number, newAmount: string) => {
    const updated = [...splits];
    updated[index] = { ...updated[index], amount: newAmount };
    onChange(updated);
  };

  const handleFillRemaining = (index: number) => {
    const otherSum = splits.reduce((sum, s, idx) => {
      if (idx === index) return sum;
      const parsed = parseFloat(s.amount);
      return sum + (isNaN(parsed) ? 0 : parsed);
    }, 0);
    const needed = Math.max(0, roundedTotal - otherSum);
    const updated = [...splits];
    updated[index] = { ...updated[index], amount: needed > 0 ? needed.toFixed(2) : '0' };
    onChange(updated);
  };

  const handleSplitEvenly = () => {
    if (splits.length === 0) return;
    const share = Math.floor((roundedTotal / splits.length) * 100) / 100;
    const remainder = Math.round((roundedTotal - share * splits.length) * 100) / 100;
    const updated = splits.map((s, idx) => ({
      ...s,
      amount: (idx === 0 ? share + remainder : share).toFixed(2),
    }));
    onChange(updated);
  };

  return (
    <View style={styles.container}>
      {/* Header with Title and Split Evenly */}
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.label}>Payment Breakdown</Text>
          <Text style={styles.subLabel}>Multi-method split</Text>
        </View>

        {splits.length > 1 && roundedTotal > 0 && (
          <TouchableOpacity
            style={styles.splitEvenlyButton}
            onPress={handleSplitEvenly}
            activeOpacity={0.7}
          >
            <Text style={styles.splitEvenlyText}>Split Evenly</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Mode Chips Selector */}
      <View style={styles.chipsContainer}>
        {(['CASH', 'UPI', 'BANK_TRANSFER'] as const).map((mode) => {
          const isSelected = splits.some((s) => s.mode === mode);
          const config = modeConfigs[mode];
          return (
            <TouchableOpacity
              key={mode}
              style={[
                styles.chip,
                isSelected && {
                  backgroundColor: config.bgColor,
                  borderColor: config.color,
                },
              ]}
              onPress={() => {
                if (isSelected) {
                  handleRemoveMode(mode);
                } else {
                  handleAddMode(mode);
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={config.icon}
                size={14}
                color={isSelected ? config.color : Colors.dark.textSecondary}
              />
              <Text
                style={[
                  styles.chipText,
                  isSelected && { color: config.color, fontWeight: '700' },
                ]}
              >
                {config.label}
              </Text>
              {isSelected ? (
                <Ionicons name="checkmark-circle" size={14} color={config.color} />
              ) : (
                <Ionicons name="add" size={14} color={Colors.dark.textTertiary} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Rows of allocated payment amounts */}
      {splits.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>
            No upfront payment method selected.{' '}
            {allowCredit ? 'Full amount will be booked as Credit / Pay Later.' : 'Select at least one payment method.'}
          </Text>
        </View>
      ) : (
        <View style={styles.rowsList}>
          {splits.map((row, idx) => {
            const config = modeConfigs[row.mode];
            const parsed = parseFloat(row.amount);
            const canPreviewQr = row.mode === 'UPI' && onPreviewUpi && !isNaN(parsed) && parsed > 0;

            return (
              <View key={row.mode} style={styles.rowCard}>
                <View style={styles.rowHeader}>
                  <View style={[styles.modeIconWrap, { backgroundColor: config.bgColor }]}>
                    <Ionicons name={config.icon} size={16} color={config.color} />
                  </View>
                  <Text style={styles.modeName}>{config.label}</Text>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleRemoveMode(row.mode)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color={Colors.dark.statusCancelled} />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputActionRow}>
                  <View style={styles.amountInputWrap}>
                    <Text style={styles.currencyPrefix}>₹</Text>
                    <TextInput
                      style={styles.amountInput}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={Colors.dark.textTertiary}
                      value={row.amount}
                      onChangeText={(val) => handleAmountChange(idx, val)}
                    />
                  </View>

                  {roundedTotal > 0 && (
                    <TouchableOpacity
                      style={styles.fillButton}
                      onPress={() => handleFillRemaining(idx)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.fillButtonText}>Fill Bal</Text>
                    </TouchableOpacity>
                  )}

                  {canPreviewQr && (
                    <TouchableOpacity
                      style={styles.qrButton}
                      onPress={() => onPreviewUpi(parsed)}
                      disabled={previewUpiLoading}
                      activeOpacity={0.7}
                    >
                      {previewUpiLoading ? (
                        <ActivityIndicator size="small" color="#6366F1" />
                      ) : (
                        <>
                          <Ionicons name="qr-code-outline" size={14} color="#6366F1" />
                          <Text style={styles.qrButtonText}>QR</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Summary Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Text style={styles.footerText}>
            Paid: <Text style={styles.footerPaidAmount}>{formatINR(roundedPaid)}</Text>
          </Text>
        </View>

        {effectiveAllowCredit && (
          <View>
            {balanceDue > 0 ? (
              <Text style={styles.balanceDueText}>
                {effectiveCreditLabel}{' '}
                <Text style={styles.balanceDueBold}>{formatINR(balanceDue)}</Text>
              </Text>
            ) : (
              <Text style={styles.fullyPaidText}>✓ Fully Settled</Text>
            )}
          </View>
        )}

        {isOverpaid && (
          <Text style={styles.overpaidText}>
            Exceeds total by {formatINR(roundedPaid - roundedTotal)}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.cardElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.borderMedium,
    padding: 14,
    marginVertical: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  subLabel: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
  },
  splitEvenlyButton: {
    backgroundColor: Colors.dark.cardHover,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  splitEvenlyText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.dark.textSecondary,
  },
  emptyWrap: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: Colors.dark.textTertiary,
    textAlign: 'center',
    lineHeight: 16,
  },
  rowsList: {
    gap: 8,
  },
  rowCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 10,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modeIconWrap: {
    padding: 5,
    borderRadius: 6,
    marginRight: 8,
  },
  modeName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.text,
    flex: 1,
  },
  deleteButton: {
    padding: 4,
  },
  inputActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amountInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.inputBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.inputBorder,
    paddingHorizontal: 10,
  },
  currencyPrefix: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.text,
    paddingVertical: 7,
  },
  fillButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.dark.cardHover,
    borderWidth: 1,
    borderColor: Colors.dark.borderMedium,
  },
  fillButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  qrButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366F1',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  footerPaidAmount: {
    fontWeight: '700',
    color: Colors.dark.text,
  },
  balanceDueText: {
    fontSize: 12,
    color: Colors.dark.statusPending,
  },
  balanceDueBold: {
    fontWeight: '700',
  },
  fullyPaidText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.statusPaid,
  },
  overpaidText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.dark.statusCancelled,
  },
});
