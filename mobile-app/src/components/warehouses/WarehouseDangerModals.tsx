import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/theme';
import { mobileApiRequest } from '@/lib/api';
import { Warehouse } from './types';

// ============================================================================
// DELETE WAREHOUSE MODAL (STRICT SAFEGUARD)
// ============================================================================
interface DeleteWarehouseModalProps {
  warehouse: Warehouse | null;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  totalUnits?: number;
}

export function DeleteWarehouseModal({
  warehouse,
  visible,
  onClose,
  onSuccess,
  totalUnits = 0,
}: DeleteWarehouseModalProps) {
  const [submitting, setSubmitting] = useState(false);

  if (!warehouse) return null;

  const hasStock = totalUnits > 0;

  const handleConfirmDelete = async () => {
    setSubmitting(true);
    try {
      await mobileApiRequest(`/warehouses/${warehouse.id}`, { method: 'DELETE' });
      Alert.alert('Warehouse Removed', `Location "${warehouse.name}" was successfully deleted.`);
      onClose();
      onSuccess();
    } catch (err: any) {
      Alert.alert(
        'Deletion Blocked',
        err.message || 'Warehouse could not be removed. Ensure it has 0 stock and no active delivery trips.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={hasStock ? 'Deletion Blocked' : 'Remove Warehouse'}
      subtitle={`Location: ${warehouse.name} (${warehouse.type})`}
    >
      {hasStock ? (
        /* CASE A: INVENTORY STILL PRESENT - BLOCK DELETION */
        <View style={styles.content}>
          <View style={styles.blockedBanner}>
            <Ionicons name="alert-circle" size={28} color="#EF4444" />
            <View style={{ flex: 1 }}>
              <Text style={styles.blockedTitle}>Location Has Active Stock</Text>
              <Text style={styles.blockedDesc}>
                This location currently holds{' '}
                <Text style={{ fontWeight: 'bold', color: '#FFFFFF' }}>{totalUnits} units</Text> of
                stock. Warehouses can only be deleted once all inventory is cleared or transferred.
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>How to remove this location:</Text>
            <Text style={styles.infoStep}>1. Transfer remaining stock to another warehouse, OR</Text>
            <Text style={styles.infoStep}>
              2. Use &quot;Set Stock to 0&quot; to audit and empty the godown inventory.
            </Text>
            <Text style={styles.infoStep}>
              3. Once verified at 0 units, this delete action will be enabled.
            </Text>
          </View>

          <Button
            title="Understood"
            variant="outline"
            size="lg"
            onPress={onClose}
            style={{ marginTop: 16 }}
          />
        </View>
      ) : (
        /* CASE B: EMPTY WAREHOUSE - CONFIRM DELETION */
        <View style={styles.content}>
          <View style={styles.warningBanner}>
            <Ionicons name="trash-outline" size={28} color="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.warningTitle}>Permanent Action</Text>
              <Text style={styles.warningDesc}>
                Verified empty with{' '}
                <Text style={{ fontWeight: 'bold', color: '#10B981' }}>0 units</Text>.
                Are you sure you want to permanently remove{' '}
                <Text style={{ fontWeight: 'bold', color: '#FFFFFF' }}>{`"${warehouse.name}"`}</Text>?
              </Text>
            </View>
          </View>

          {warehouse.address ? (
            <View style={styles.addressBox}>
              <Ionicons name="location-outline" size={16} color={Colors.dark.textSecondary} />
              <Text style={styles.addressText}>{warehouse.address}</Text>
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <Button
              title="Cancel"
              variant="outline"
              size="md"
              onPress={onClose}
              style={{ flex: 1 }}
              disabled={submitting}
            />
            <Button
              title={submitting ? 'Removing...' : 'Confirm Remove'}
              variant="danger"
              size="md"
              loading={submitting}
              onPress={handleConfirmDelete}
              style={{ flex: 1.3 }}
            />
          </View>
        </View>
      )}
    </BottomSheetModal>
  );
}

// ============================================================================
// ZERO-OUT WAREHOUSE MODAL
// ============================================================================
interface ZeroOutWarehouseModalProps {
  warehouse: Warehouse | null;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  totalUnits?: number;
}

export function ZeroOutWarehouseModal({
  warehouse,
  visible,
  onClose,
  onSuccess,
  totalUnits = 0,
}: ZeroOutWarehouseModalProps) {
  const [submitting, setSubmitting] = useState(false);

  if (!warehouse) return null;

  const handleConfirmZeroOut = async () => {
    setSubmitting(true);
    try {
      await mobileApiRequest('/stock/zero-out', {
        method: 'POST',
        body: JSON.stringify({ warehouseId: warehouse.id }),
      });
      Alert.alert(
        'Inventory Cleared',
        `All stock records in "${warehouse.name}" have been reset to 0.`,
      );
      onClose();
      onSuccess();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not zero-out warehouse stock.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Empty Warehouse (Set to 0)"
      subtitle={`Location: ${warehouse.name}`}
    >
      <View style={styles.content}>
        <View style={styles.amberWarningBanner}>
          <Ionicons name="refresh-outline" size={28} color="#F59E0B" />
          <View style={{ flex: 1 }}>
            <Text style={styles.amberWarningTitle}>Clear All Stock to 0</Text>
            <Text style={styles.amberWarningDesc}>
              This will reset all{' '}
              <Text style={{ fontWeight: 'bold', color: '#FFFFFF' }}>{totalUnits} units</Text> of
              inventory in this location to 0 across all batches.
            </Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoDesc}>
            Once the warehouse is emptied (0 units remaining), you will be able to delete this
            location if it is no longer in use.
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <Button
            title="Cancel"
            variant="outline"
            size="md"
            onPress={onClose}
            style={{ flex: 1 }}
            disabled={submitting}
          />
          <Button
            title={submitting ? 'Clearing...' : 'Confirm Set to 0'}
            variant="secondary"
            size="md"
            loading={submitting}
            onPress={handleConfirmZeroOut}
            style={{ flex: 1.4, backgroundColor: '#D97706' }}
          />
        </View>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 8,
    gap: 14,
  },
  blockedBanner: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
  },
  blockedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
  blockedDesc: {
    fontSize: 12,
    color: '#D4D4D8',
    marginTop: 3,
    lineHeight: 17,
  },
  warningBanner: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    alignItems: 'center',
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F59E0B',
  },
  warningDesc: {
    fontSize: 12,
    color: '#D4D4D8',
    marginTop: 3,
    lineHeight: 17,
  },
  amberWarningBanner: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(217, 119, 6, 0.14)',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.35)',
    alignItems: 'center',
  },
  amberWarningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FBBF24',
  },
  amberWarningDesc: {
    fontSize: 12,
    color: '#E4E4E7',
    marginTop: 3,
    lineHeight: 17,
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dark.cardElevated,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  addressText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    flex: 1,
  },
  infoCard: {
    backgroundColor: Colors.dark.cardElevated,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 6,
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  infoDesc: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
  },
  infoStep: {
    fontSize: 11.5,
    color: Colors.dark.textSecondary,
    lineHeight: 17,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
});
