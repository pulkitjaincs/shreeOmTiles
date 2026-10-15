import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatINR } from '@/lib/formatters';
import { mobileApiRequest } from '@/lib/api';
import { Delivery } from './types';

interface CollectCashModalProps {
  delivery: Delivery | null;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CollectCashModal({
  delivery,
  visible,
  onClose,
  onSuccess,
}: CollectCashModalProps) {
  const [cashAmountInput, setCashAmountInput] = useState('');
  const [cashNotesInput, setCashNotesInput] = useState('');
  const [submittingCash, setSubmittingCash] = useState(false);

  useEffect(() => {
    if (visible && delivery) {
      setCashAmountInput(String(delivery.amountToCollect || ''));
      setCashNotesInput('');
    }
  }, [visible, delivery]);

  if (!delivery) return null;

  const handleCollectCash = async () => {
    const amt = parseFloat(cashAmountInput);
    if (isNaN(amt) || amt < 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid cash amount');
      return;
    }

    setSubmittingCash(true);
    try {
      await mobileApiRequest(`/delivery/${delivery.id}/collect-cash`, {
        method: 'PATCH',
        body: JSON.stringify({
          amount: amt,
          notes: cashNotesInput.trim() || undefined,
        }),
      });

      Alert.alert(
        'Delivery Complete',
        `₹${amt.toLocaleString('en-IN')} cash collected. Order marked as DELIVERED!`,
      );
      onClose();
      onSuccess();
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update delivery status');
    } finally {
      setSubmittingCash(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Collect Cash & Complete Run"
      subtitle={`Invoice #${delivery.invoice?.invoiceNo} • ${delivery.invoice?.party?.name || 'Counter Sale'}`}
    >
      <View>
        <View style={styles.cashNoticeBox}>
          <Text style={styles.cashNoticeLabel}>Expected Amount to Collect</Text>
          <Text style={styles.cashNoticeVal}>{formatINR(delivery.amountToCollect)}</Text>
        </View>

        <Input
          label="Actual Cash Collected (₹)"
          placeholder="0"
          value={cashAmountInput}
          onChangeText={setCashAmountInput}
          keyboardType="numeric"
        />

        <Input
          label="Collection Notes"
          placeholder="e.g. Received full amount in cash, given receipt"
          value={cashNotesInput}
          onChangeText={setCashNotesInput}
        />

        <Button
          title={submittingCash ? 'Recording...' : 'Confirm Cash & Complete Delivery'}
          onPress={handleCollectCash}
          loading={submittingCash}
          variant="primary"
          size="lg"
          style={{ marginTop: 14 }}
        />
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  cashNoticeBox: {
    padding: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 14,
  },
  cashNoticeLabel: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cashNoticeVal: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
    fontFamily: 'monospace',
  },
});
