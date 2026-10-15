import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/theme';
import { mobileApiRequest } from '@/lib/api';

interface StaffFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function StaffFormModal({
  visible,
  onClose,
  onSuccess,
}: StaffFormModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'SALESMAN' | 'DRIVER' | 'ADMIN'>('SALESMAN');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setName('');
      setPhone('');
      setPassword('');
      setRole('SALESMAN');
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim() || !password) {
      Alert.alert('Required', 'Please fill name, phone, and password');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '').slice(0, 10);
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Phone', 'Phone must be exactly 10 digits');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Short Password', 'Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
      await mobileApiRequest('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          phone: cleanPhone,
          password,
          role,
        }),
      });

      Alert.alert('Success', `Staff member ${name} created!`);
      onClose();
      onSuccess();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create staff');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Create Staff Member"
      subtitle="Add a new salesman, driver, or manager"
    >
      <View>
        <Input
          label="Full Name"
          placeholder="e.g. Amit Kumar"
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
          label="Password"
          placeholder="Minimum 6 characters"
          value={password}
          onChangeText={setPassword}
          isPassword
        />
        <Text style={styles.fieldLabel}>Role Designation</Text>
        <View style={styles.roleToggleRow}>
          {(['SALESMAN', 'DRIVER', 'ADMIN'] as const).map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.roleSelectChip, role === r && styles.roleSelectChipActive]}
              onPress={() => setRole(r)}
            >
              <Text
                style={[
                  styles.roleSelectChipText,
                  role === r && styles.roleSelectChipTextActive,
                ]}
              >
                {r}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Button
          title={submitting ? 'Creating...' : 'Create Staff Member'}
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
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    marginBottom: 4,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  roleToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    marginTop: 4,
  },
  roleSelectChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
  },
  roleSelectChipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  roleSelectChipText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: '700',
  },
  roleSelectChipTextActive: {
    color: '#09090B',
    fontWeight: '800',
  },
});
