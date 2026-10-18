import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/lib/theme-context';
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
  const styles = useThemedStyles(createStyles);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'SALESMAN' | 'DRIVER' | 'ACCOUNTANT' | 'ADMIN' | 'OWNER' | 'DIRECTOR' | 'SUPERVISOR'>('SALESMAN');
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(staff?.name || '');
      setPhone(staff?.phone || '');
      setPassword('');
      setRole(staff?.role || 'SALESMAN');
      setWarehouseId(staff?.scope || '');
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
          scope: warehouseId || undefined,
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
        {staff?.role !== 'OWNER' && (staff?.role as any) !== 'DIRECTOR' ? (
          <>
            <Text style={styles.fieldLabel}>Role Designation</Text>
            <View style={styles.roleToggleRow}>
              {(['SALESMAN', 'ACCOUNTANT', 'SUPERVISOR', 'DRIVER', 'ADMIN'] as const).map((r) => (
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
                    {r === 'SUPERVISOR' ? 'SUPERVISOR' : r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <View style={{ marginTop: 14, padding: 12, backgroundColor: 'rgba(217, 119, 6, 0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(217, 119, 6, 0.25)' }}>
            <Text style={{ color: '#D97706', fontSize: 13, fontWeight: '700' }}>
              Role: DIRECTOR (Protected)
            </Text>
          </View>
        )}

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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    fieldLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      marginBottom: 4,
      marginTop: 8,
      textTransform: 'uppercase',
    },
    roleToggleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 10,
      marginTop: 4,
    },
    roleSelectChip: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    roleSelectChipActive: {
      backgroundColor: colors.text,
      borderColor: colors.text,
    },
    roleSelectChipText: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '700',
    },
    roleSelectChipTextActive: {
      color: colors.background,
      fontWeight: '800',
    },
    warehouseChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: colors.cardElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    warehouseChipActive: {
      backgroundColor: '#A855F7',
      borderColor: '#C084FC',
    },
    warehouseChipText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    warehouseChipTextActive: {
      color: '#FFFFFF',
    },
  });
