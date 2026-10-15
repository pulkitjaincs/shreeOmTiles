import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/theme';
import { mobileApiRequest } from '@/lib/api';
import { Warehouse } from './types';

interface WarehouseFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  warehouse?: Warehouse | null;
}

export function WarehouseFormModal({
  visible,
  onClose,
  onSuccess,
  warehouse,
}: WarehouseFormModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'WAREHOUSE' | 'SHOWROOM'>('WAREHOUSE');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      if (warehouse) {
        setName(warehouse.name);
        setType(warehouse.type);
        setAddress(warehouse.address || '');
      } else {
        setName('');
        setType('WAREHOUSE');
        setAddress('');
      }
    }
  }, [visible, warehouse]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Location name is required');
      return;
    }

    setSubmitting(true);
    try {
      if (warehouse) {
        await mobileApiRequest(`/warehouses/${warehouse.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: name.trim(),
            type,
            address: address.trim() || undefined,
          }),
        });
        Alert.alert('Success', 'Warehouse updated successfully');
      } else {
        await mobileApiRequest('/warehouses', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            type,
            address: address.trim() || undefined,
          }),
        });
        Alert.alert('Success', 'New warehouse / showroom created');
      }

      onClose();
      onSuccess();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save warehouse');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={warehouse ? 'Edit Warehouse' : 'Add Warehouse / Showroom'}
      subtitle="Manage inventory distribution locations"
    >
      <View>
        <Input
          label="Location Name"
          placeholder="e.g. Main Showroom or Warehouse B"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.fieldLabel}>Location Type</Text>
        <View style={styles.roleToggleRow}>
          {(['WAREHOUSE', 'SHOWROOM'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.roleSelectChip, type === t && styles.roleSelectChipActive]}
              onPress={() => setType(t)}
            >
              <Text
                style={[
                  styles.roleSelectChipText,
                  type === t && styles.roleSelectChipTextActive,
                ]}
              >
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Input
          label="Physical Address (Optional)"
          placeholder="e.g. Industrial Area Phase 1"
          value={address}
          onChangeText={setAddress}
        />

        <Button
          title={
            submitting
              ? 'Saving...'
              : warehouse
              ? 'Update Warehouse'
              : 'Create Location'
          }
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
