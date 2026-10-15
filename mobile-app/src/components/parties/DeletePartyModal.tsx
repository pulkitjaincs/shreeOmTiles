import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/theme';
import { mobileApiRequest } from '@/lib/api';
import { formatINR } from '@/lib/formatters';
import { Party } from './types';

interface DeletePartyModalProps {
  party: Party | null;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeletePartyModal({
  party,
  visible,
  onClose,
  onSuccess,
}: DeletePartyModalProps) {
  const [submitting, setSubmitting] = useState(false);

  if (!party) return null;

  const totalDue = (party.creditLedgers || [])
    .filter((cl) => cl.status !== 'SETTLED')
    .reduce((sum, cl) => {
      const amt = Number(cl.amountDue || 0);
      return cl.type === 'RECEIVABLE' ? sum + amt : sum - amt;
    }, 0);

  const hasPendingDues = totalDue > 0.01;

  const handleConfirmDelete = async () => {
    setSubmitting(true);
    try {
      await mobileApiRequest(`/parties/${party.id}`, { method: 'DELETE' });
      Alert.alert('Customer Removed', `"${party.name}" was successfully removed.`);
      onClose();
      onSuccess();
    } catch (err: any) {
      Alert.alert('Deletion Blocked', err.message || 'Failed to remove customer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={hasPendingDues ? 'Deletion Prohibited' : 'Remove Customer'}
      subtitle={`Party: ${party.name} (${party.phone})`}
    >
      {hasPendingDues ? (
        /* CASE A: DUES PENDING - CANNOT DELETE */
        <View style={styles.content}>
          <View style={styles.prohibitedBanner}>
            <Ionicons name="shield-outline" size={20} color="#EF4444" />
            <View style={{ flex: 1 }}>
              <Text style={styles.prohibitedTitle}>
                Pending Dues: {formatINR(totalDue)}
              </Text>
              <Text style={styles.prohibitedDesc}>
                Customer accounts cannot be deleted or removed while dues are pending. Under store safety policy, neither can the customer owe money to the shop, nor can the shop owe money to the customer.
              </Text>
            </View>
          </View>

          <Button
            title="Understood, Close"
            variant="secondary"
            size="lg"
            onPress={onClose}
            style={{ marginTop: 8 }}
          />
        </View>
      ) : (
        /* CASE B: ZERO DUES - SAFE TO REMOVE */
        <View style={styles.content}>
          <View style={styles.verifiedBanner}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#10B981" />
            <Text style={styles.verifiedText}>
              Zero dues verified: No pending balance or credit liabilities.
            </Text>
          </View>

          <Text style={styles.confirmText}>
            Are you sure you want to permanently remove customer{' '}
            <Text style={{ fontWeight: '700', color: Colors.dark.text }}>{party.name}</Text>? This will remove them from the active customer directory.
          </Text>

          <View style={styles.btnRow}>
            <Button
              title="Cancel"
              variant="secondary"
              size="lg"
              onPress={onClose}
              style={{ flex: 1 }}
            />
            <Button
              title={submitting ? 'Removing...' : 'Confirm Remove'}
              variant="danger"
              size="lg"
              loading={submitting}
              onPress={handleConfirmDelete}
              style={{ flex: 1.2 }}
            />
          </View>
        </View>
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: 4,
    gap: 12,
  },
  prohibitedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    padding: 14,
  },
  prohibitedTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#EF4444',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  prohibitedDesc: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
  },
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    padding: 12,
  },
  verifiedText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    flex: 1,
  },
  confirmText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
    marginTop: 4,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
});
