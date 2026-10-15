import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/theme';
import { mobileApiRequest } from '@/lib/api';
import { StaffUser } from './types';

interface StaffFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  staff?: StaffUser | null;
}

export function StaffFormModal({
  visible,
  onClose,
  onSuccess,
  staff,
}: StaffFormModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'SALESMAN' | 'DRIVER' | 'ADMIN' | 'OWNER'>('SALESMAN');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(staff?.name || '');
      setPhone(staff?.phone || '');
      setPassword('');
      setRole(staff?.role || 'SALESMAN');
    }
  }, [visible, staff]);

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim() || (!staff && !password)) {
      Alert.alert('Required', staff ? 'Please fill name and phone' : 'Please fill name, phone, and password');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '').slice(0, 10);
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Phone', 'Phone must be exactly 10 digits');
      return;
    }
    if (password && password.length < 6) {
      Alert.alert('Short Password', 'Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
      await mobileApiRequest(staff ? `/users/${staff.id}` : '/users', {
        method: staff ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: name.trim(),
          phone: cleanPhone,
          ...(password ? { password } : {}),
          role,
        }),
      });

      Alert.alert('Success', staff ? `Staff member ${name} updated!` : `Staff member ${name} created!`);
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
      title={staff ? 'Edit Staff Member' : 'Create Staff Member'}
      subtitle={staff ? 'Update staff profile and access role' : 'Add a new salesman, driver, or manager'}
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
          label={staff ? 'New Password (Optional)' : 'Password'}
          placeholder={staff ? 'Leave blank to keep current password' : 'Minimum 6 characters'}
          value={password}
          onChangeText={setPassword}
          isPassword
        />
        {staff?.role !== 'OWNER' ? <>
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
        </> : null}

        <Button
          title={submitting ? 'Saving...' : staff ? 'Save Staff Changes' : 'Create Staff Member'}
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
