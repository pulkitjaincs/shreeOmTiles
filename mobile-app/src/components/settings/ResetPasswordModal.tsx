import React, { useState, useEffect } from 'react';
import { View, Alert } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { mobileApiRequest } from '@/lib/api';
import { StaffUser } from './types';

interface ResetPasswordModalProps {
  user: StaffUser | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function ResetPasswordModal({
  user,
  onClose,
  onSuccess,
}: ResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setNewPassword('');
    }
  }, [user]);

  if (!user) return null;

  const handleSubmit = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Short Password', 'New password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
      await mobileApiRequest(`/users/${user.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password: newPassword }),
      });

      Alert.alert('Success', `Password reset for ${user.name}`);
      onClose();
      onSuccess();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheetModal
      visible={Boolean(user)}
      onClose={onClose}
      title="Reset Password"
      subtitle={`Set new password for ${user.name}`}
    >
      <View>
        <Input
          label="New Password"
          placeholder="Enter new staff password"
          value={newPassword}
          onChangeText={setNewPassword}
          isPassword
        />
        <Button
          title={submitting ? 'Updating...' : 'Update Password'}
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
