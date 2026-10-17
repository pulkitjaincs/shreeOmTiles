import React, { useState, useEffect } from 'react';
import { View, Alert } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { mobileApiRequest } from '@/lib/api';
import { cleanPhoneNumber } from '@/lib/formatters';
import { Party } from './types';

interface PartyFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  party?: Party | null;
}

const CATEGORY_OPTIONS = [
  { value: 'RETAIL', label: 'Retail Customer' },
  { value: 'CONTRACTOR', label: 'Contractor (Wholesale Tier)' },
  { value: 'ARCHITECT', label: 'Architect / Designer' },
  { value: 'WHOLESALER', label: 'Wholesaler / Dealer' },
];

export function PartyFormModal({
  visible,
  onClose,
  onSuccess,
  party,
}: PartyFormModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState<'RETAIL' | 'CONTRACTOR' | 'ARCHITECT' | 'WHOLESALER'>('RETAIL');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(party?.name || '');
      setPhone(cleanPhoneNumber(party?.phone || ''));
      setGstin(party?.gstin || '');
      setAddress(party?.address || '');
      setCategory(party?.category || 'RETAIL');
    }
  }, [visible, party]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter customer / firm name');
      return;
    }
    const cleanPhone = cleanPhoneNumber(phone);
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Phone', 'Mobile phone must be strictly 10 digits (e.g. 9876543210)');
      return;
    }

    const cleanGstin = gstin.trim().toUpperCase();
    if (cleanGstin) {
      if (cleanGstin.length !== 15) {
        Alert.alert('Invalid GSTIN', 'GSTIN must be strictly 15 alphanumeric characters (e.g. 07AAAAA0000A1Z5)');
        return;
      }
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[0-9A-Z]{2}$/;
      if (!gstinRegex.test(cleanGstin)) {
        Alert.alert(
          'Invalid GSTIN Format',
          'GSTIN should follow standard format: 2-digit state code + 10-character PAN + 3-character entity code',
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      await mobileApiRequest(party ? `/parties/${party.id}` : '/parties', {
        method: party ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: name.trim(),
          phone: cleanPhone,
          gstin: cleanGstin || undefined,
          address: address.trim() || undefined,
          category,
        }),
      });

      Alert.alert('Success', party ? `Customer "${name.trim()}" updated!` : `Customer "${name.trim()}" registered!`);
      onClose();
      onSuccess();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to register customer');
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={party ? 'Edit Party' : 'Add Party / Customer'}
      subtitle="Register party in directory for fast counter billing & procurement"
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
          onChangeText={(t) => {
            const digits = t.replace(/\D/g, '');
            setPhone(digits.length > 10 ? digits.slice(-10) : digits);
          }}
          keyboardType="phone-pad"
          maxLength={15}
        />
        <Select
          label="Customer Category / Tier"
          value={category}
          options={CATEGORY_OPTIONS}
          onChange={(val) => setCategory(val as 'RETAIL' | 'CONTRACTOR' | 'ARCHITECT' | 'WHOLESALER')}
        />
        <Input
          label="GSTIN (Optional)"
          placeholder="e.g. 07AAAAA0000A1Z5"
          value={gstin}
          onChangeText={(t) => setGstin(t.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15))}
          autoCapitalize="characters"
          maxLength={15}
        />
        <Input
          label="Address (Optional)"
          placeholder="e.g. Plot 12, Industrial Area"
          value={address}
          onChangeText={setAddress}
        />
        <Button
          title={submitting ? 'Saving...' : party ? 'Save Party Changes' : 'Register Party Profile'}
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
