import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/theme';
import { mobileApiRequest } from '@/lib/api';
import { Product } from './types';

interface AddProductModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null;
}

export function AddProductModal({
  visible,
  onClose,
  onSuccess,
  product,
}: AddProductModalProps) {
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState('');
  const [prodUnit, setProdUnit] = useState('box');
  const [prodHsn, setProdHsn] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      if (product) {
        setProdName(product.name);
        setProdCategory(product.category);
        setProdUnit(product.unit || 'box');
        setProdHsn(product.hsnCode || '');
      } else {
        setProdName('');
        setProdCategory('');
        setProdUnit('box');
        setProdHsn('');
      }
    }
  }, [visible, product]);

  const handleSave = async () => {
    if (!prodName.trim() || !prodCategory.trim()) {
      Alert.alert('Required Fields', 'Product name and category are required');
      return;
    }

    setSubmitting(true);
    try {
      if (product) {
        await mobileApiRequest(`/products/${product.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: prodName.trim(),
            category: prodCategory.trim(),
            unit: prodUnit,
            hsnCode: prodHsn.trim() || undefined,
          }),
        });
        Alert.alert('Success', 'Product updated successfully!');
      } else {
        await mobileApiRequest('/products', {
          method: 'POST',
          body: JSON.stringify({
            name: prodName.trim(),
            category: prodCategory.trim(),
            unit: prodUnit,
            hsnCode: prodHsn.trim() || undefined,
          }),
        });
        Alert.alert('Success', 'New product added to catalog!');
      }

      onClose();
      onSuccess();
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save product');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={product ? 'Edit Catalog Product' : 'Add New Product'}
      subtitle="Configure tile size, category, and standard units"
    >
      <View>
        <Input
          label="Product Name"
          placeholder="e.g. 600x1200 Glossy Glazed Vitrified Tiles"
          value={prodName}
          onChangeText={setProdName}
        />

        <Input
          label="Category"
          placeholder="e.g. GVT Tiles, Wall Tiles, Sanitaryware"
          value={prodCategory}
          onChangeText={setProdCategory}
        />

        <Text style={styles.fieldLabel}>Unit of Measure</Text>
        <View style={styles.unitRow}>
          {['box', 'sqft', 'piece', 'set'].map((u) => (
            <TouchableOpacity
              key={u}
              onPress={() => setProdUnit(u)}
              style={[styles.taxChip, prodUnit === u && styles.taxChipActive]}
            >
              <Text style={[styles.taxChipText, prodUnit === u && styles.taxChipTextActive]}>
                {u}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Input
          label="HSN Code (Optional)"
          placeholder="e.g. 6907"
          value={prodHsn}
          onChangeText={setProdHsn}
          keyboardType="numeric"
        />

        <Button
          title={submitting ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
          onPress={handleSave}
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
  unitRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    marginTop: 4,
  },
  taxChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
  },
  taxChipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  taxChipText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  taxChipTextActive: {
    color: '#09090B',
    fontWeight: '800',
  },
});
