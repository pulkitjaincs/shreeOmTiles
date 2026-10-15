import React, { useState, useEffect } from 'react';
import { View, Alert } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { mobileApiRequest } from '@/lib/api';

interface PartyFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PartyFormModal({
  visible,
  onClose,
  onSuccess,
}: PartyFormModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setName('');
      setPhone('');
      setGstin('');
      setAddress('');
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter customer / firm name');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '').slice(0, 10);
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Phone', 'Mobile phone must be exactly 10 digits');
      return;
    }

    setSubmitting(true);
    try {
      await mobileApiRequest('/parties', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          phone: cleanPhone,
          gstin: gstin.trim().toUpperCase() || undefined,
          address: address.trim() || undefined,
        }),
      });

      Alert.alert('Success', `Customer "${name.trim()}" registered!`);
      onClose();
      onSuccess();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to register customer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Add Customer / Party"
      subtitle="Register customer in directory for fast counter billing"
    >
      <View>
        <Input
          label="Party / Customer Name"
          placeholder="e.g. Mahadev Marble & Granite"
          value={name}
          onChangeText={setName}
        />
        <Input
          label="Mobile Phone (10 digits)"
          placeholder="e.g. 9876543210"
          value={phone}
          onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
          keyboardType="phone-pad"
          maxLength={10}
        />
        <Input
          label="GSTIN (Optional)"
          placeholder="e.g. 07AAAAA0000A1Z5"
          value={gstin}
          onChangeText={setGstin}
          autoCapitalize="characters"
        />
        <Input
          label="Address (Optional)"
          placeholder="e.g. Plot 12, Industrial Area"
          value={address}
          onChangeText={setAddress}
        />
        <Button
          title={submitting ? 'Saving...' : 'Add Customer Profile'}
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
