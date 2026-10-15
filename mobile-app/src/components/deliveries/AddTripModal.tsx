import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { mobileApiRequest } from '@/lib/api';
import { Delivery } from './types';

interface AddTripModalProps {
  delivery: Delivery | null;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddTripModal({
  delivery,
  visible,
  onClose,
  onSuccess,
}: AddTripModalProps) {
  const [tripVehicle, setTripVehicle] = useState('');
  const [tripCost, setTripCost] = useState('');
  const [tripNotes, setTripNotes] = useState('');
  const [submittingTrip, setSubmittingTrip] = useState(false);

  useEffect(() => {
    if (visible) {
      setTripVehicle('');
      setTripCost('');
      setTripNotes('');
    }
  }, [visible]);

  if (!delivery) return null;

  const handleAddTrip = async () => {
    setSubmittingTrip(true);
    try {
      await mobileApiRequest(`/delivery/${delivery.id}/trips`, {
        method: 'POST',
        body: JSON.stringify({
          vehicle: tripVehicle.trim() || undefined,
          cost: tripCost ? Number(tripCost) : 0,
          notes: tripNotes.trim() || undefined,
        }),
      });

      Alert.alert('Trip Added', 'Internal transit trip successfully logged.');
      onClose();
      onSuccess();
    } catch (err: any) {
      Alert.alert('Trip Failed', err.message || 'Could not add vehicle trip');
    } finally {
      setSubmittingTrip(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Add Vehicle Trip"
      subtitle={`Record extra transit trip for Invoice #${delivery.invoice?.invoiceNo}`}
    >
      <View style={styles.container}>
        <Input
          label="Vehicle Type / Registration"
          placeholder="e.g. Mahindra Bolero Pickup"
          value={tripVehicle}
          onChangeText={setTripVehicle}
        />

        <Input
          label="Trip Cost (₹)"
          placeholder="0"
          value={tripCost}
          onChangeText={setTripCost}
          keyboardType="numeric"
        />

        <Input
          label="Notes"
          placeholder="e.g. Second round for remaining boxes"
          value={tripNotes}
          onChangeText={setTripNotes}
        />

        <Button
          title={submittingTrip ? 'Adding Trip...' : 'Save Vehicle Trip'}
          onPress={handleAddTrip}
          loading={submittingTrip}
          variant="primary"
          size="lg"
          style={{ marginTop: 12 }}
        />
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
});
