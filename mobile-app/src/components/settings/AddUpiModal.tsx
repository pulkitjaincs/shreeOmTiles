import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/theme';
import { mobileApiRequest } from '@/lib/api';

interface AddUpiModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddUpiModal({
  visible,
  onClose,
  onSuccess,
}: AddUpiModalProps) {
  const [upiId, setUpiId] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setUpiId('');
      setMerchantName('');
      setIsPrimary(false);
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!upiId.trim() || !upiId.includes('@')) {
      Alert.alert('Required', 'Please enter a valid UPI ID (e.g. store@bank or 9876543210@paytm)');
      return;
    }

    setSubmitting(true);
    try {
      await mobileApiRequest('/settings/upi-accounts', {
        method: 'POST',
        body: JSON.stringify({
          upiId: upiId.trim(),
          merchantName: merchantName.trim() || 'Shree Om Tiles',
          isPrimary,
        }),
      });

      Alert.alert('Success', 'UPI payment account linked successfully!');
      onClose();
      onSuccess();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add UPI account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Add UPI Account"
      subtitle="Link a new UPI VPA for customer on-screen payments"
    >
      <View>
        <Input
          label="UPI ID / VPA *"
          placeholder="e.g. 9876543210@paytm or store@icici"
          value={upiId}
          onChangeText={setUpiId}
          autoCapitalize="none"
        />
        <Input
          label="Merchant / Counter Label"
          placeholder="e.g. Shree Om Tiles"
          value={merchantName}
          onChangeText={setMerchantName}
        />

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setIsPrimary((prev) => !prev)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isPrimary ? 'checkbox' : 'square-outline'}
            size={20}
            color={isPrimary ? '#10B981' : Colors.dark.textSecondary}
          />
          <Text style={styles.checkboxLabel}>Make this the default primary UPI ID</Text>
        </TouchableOpacity>

        <Button
          title={submitting ? 'Linking...' : 'Link UPI Account'}
          onPress={handleSubmit}
          loading={submitting}
          variant="primary"
          size="lg"
          style={{ marginTop: 14 }}
        />
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 10,
    paddingHorizontal: 2,
  },
  checkboxLabel: {
    fontSize: 13,
    color: Colors.dark.text,
    fontWeight: '600',
  },
});

