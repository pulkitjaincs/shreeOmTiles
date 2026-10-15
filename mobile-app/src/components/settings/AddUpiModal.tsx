import React, { useState, useEffect } from 'react';
import { View, Alert } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setUpiId('');
      setMerchantName('');
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!upiId.trim() || !upiId.includes('@')) {
      Alert.alert('Required', 'Please enter a valid UPI ID (e.g. store@bank)');
      return;
    }

    setSubmitting(true);
    try {
      await mobileApiRequest('/settings/upi-accounts', {
        method: 'POST',
        body: JSON.stringify({
          upiId: upiId.trim(),
          merchantName: merchantName.trim() || 'Shree Om Tiles',
        }),
      });

      Alert.alert('Success', 'UPI payment account linked!');
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
          label="UPI ID / VPA"
          placeholder="e.g. 9876543210@paytm or store@icici"
          value={upiId}
          onChangeText={setUpiId}
          autoCapitalize="none"
        />
        <Input
          label="Merchant Display Name"
          placeholder="e.g. Shree Om Tiles & Sanitary"
          value={merchantName}
          onChangeText={setMerchantName}
        />
        <Button
          title={submitting ? 'Linking...' : 'Link UPI Account'}
          onPress={handleSubmit}
          loading={submitting}
          variant="primary"
          size="lg"
          style={{ marginTop: 12 }}
        />
      </View>
    </BottomSheetModal>
  );
}
