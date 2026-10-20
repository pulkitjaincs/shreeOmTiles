import React, { useState, useEffect } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { ThemeColors } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/lib/theme-context';
import { mobileApiRequest } from '@/lib/api';
import { formatINR } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';
import { Party } from './types';

interface RecordCreditModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  parties: Party[];
  defaultPartyId?: string;
  onPartyCreated?: (newParty: Party) => void;
}

export function RecordCreditModal({
  visible,
  onClose,
  onSuccess,
  parties,
  defaultPartyId,
  onPartyCreated,
}: RecordCreditModalProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [partyId, setPartyId] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'RECEIVABLE' | 'PAYABLE'>('RECEIVABLE');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Quick Party Creation on the spot
  const [isCreatingParty, setIsCreatingParty] = useState(false);
  const [spotName, setSpotName] = useState('');
  const [spotPhone, setSpotPhone] = useState('');
  const [spotAddress, setSpotAddress] = useState('');
  const [spotLoading, setSpotLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setPartyId(defaultPartyId || '');
      setAmount('');
      setType('RECEIVABLE');
      setDueDate('');
      setNotes('');
      setIsCreatingParty(false);
      setSpotName('');
      setSpotPhone('');
      setSpotAddress('');
    }
  }, [visible, parties, defaultPartyId]);

  const handleSetPresetDueDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setDueDate(`${yyyy}-${mm}-${dd}`);
  };

  const handleCreatePartyOnSpot = async () => {
    const cleanPhone = spotPhone.replace(/\D/g, '');
    if (!spotName.trim()) {
      Alert.alert('Required Field', 'Please enter customer / party name');
      return;
    }
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Mobile', 'Mobile number must be exactly 10 digits');
      return;
    }

    setSpotLoading(true);
    try {
      const newParty = await mobileApiRequest<Party>('/parties', {
        method: 'POST',
        body: JSON.stringify({
          name: spotName.trim(),
          phone: cleanPhone,
          address: spotAddress.trim() || undefined,
        }),
      });

      if (onPartyCreated) {
        onPartyCreated(newParty);
      }
      setPartyId(newParty.id);
      setIsCreatingParty(false);
      setSpotName('');
      setSpotPhone('');
      setSpotAddress('');
      Alert.alert('Party Created', `Added ${newParty.name} and selected for this credit entry.`);
    } catch (err: any) {
      Alert.alert('Error Creating Party', err.message || 'Could not create party');
    } finally {
      setSpotLoading(false);
    }
  };

  const submit = async () => {
    if (submitting) return;
    const numericAmount = Number(amount);
    if (!partyId || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      Alert.alert('Required Fields', 'Select a party and enter an amount greater than zero.');
      return;
    }
    setSubmitting(true);
    try {
      await mobileApiRequest('/payments/credit', {
        method: 'POST',
        body: JSON.stringify({
          partyId,
          amount: numericAmount,
          type,
          dueDate: dueDate || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      Alert.alert(
        'Credit Recorded',
        `Recorded ${type === 'RECEIVABLE' ? 'customer debt' : 'store debt'} of ${formatINR(numericAmount)} in the ledger.`,
      );
      onClose();
      onSuccess();
    } catch (error: any) {
      Alert.alert('Could Not Record Credit', error.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Record Credit / Advance"
      subtitle="Lend credit to a customer or record advance debt taken"
    >
      <View>
        {/* Direction Switcher */}
        <Text style={styles.sectionLabel}>Credit Direction *</Text>
        <View style={styles.directionToggle}>
          <TouchableOpacity
            style={[styles.dirBtn, type === 'RECEIVABLE' && styles.dirBtnActiveReceivable]}
            onPress={() => setType('RECEIVABLE')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="arrow-down-circle"
              size={15}
              color={type === 'RECEIVABLE' ? '#EF4444' : colors.textSecondary}
            />
            <View>
              <Text
                style={[
                  styles.dirTitle,
                  type === 'RECEIVABLE' && { color: '#EF4444', fontWeight: '800' },
                ]}
              >
                Credit Given (Lent)
              </Text>
              <Text style={styles.dirSub}>Party owes to store</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dirBtn, type === 'PAYABLE' && styles.dirBtnActivePayable]}
            onPress={() => setType('PAYABLE')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="arrow-up-circle"
              size={15}
              color={type === 'PAYABLE' ? '#F59E0B' : colors.textSecondary}
            />
            <View>
              <Text
                style={[
                  styles.dirTitle,
                  type === 'PAYABLE' && { color: '#F59E0B', fontWeight: '800' },
                ]}
              >
                Credit Taken (Advance)
              </Text>
              <Text style={styles.dirSub}>Store owes to party</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Party Selector or Quick Create */}
        {isCreatingParty ? (
          <View style={styles.spotPartyCard}>
            <View style={styles.spotHeader}>
              <Text style={styles.spotTitle}>Quick Add Party</Text>
              <TouchableOpacity
                onPress={() => setIsCreatingParty(false)}
                style={styles.spotCancelBtn}
              >
                <Text style={styles.spotCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <Input
              label="Party Name *"
              placeholder="e.g. Balaji Traders"
              value={spotName}
              onChangeText={setSpotName}
              icon="person-outline"
            />
            <Input
              label="Mobile Number (10 digits) *"
              placeholder="e.g. 9876543210"
              value={spotPhone}
              onChangeText={setSpotPhone}
              keyboardType="phone-pad"
              icon="call-outline"
            />
            <Input
              label="Address (Optional)"
              placeholder="e.g. Station Road"
              value={spotAddress}
              onChangeText={setSpotAddress}
              icon="location-outline"
            />
            <Button
              title={spotLoading ? 'Saving...' : 'Save & Select'}
              variant="primary"
              loading={spotLoading}
              onPress={handleCreatePartyOnSpot}
              style={{ marginTop: 4 }}
            />
          </View>
        ) : (
          <View style={{ marginBottom: 4 }}>
            <View style={styles.partySelectHeader}>
              <Text style={styles.partySelectLabel}>Select Party *</Text>
              <TouchableOpacity
                onPress={() => setIsCreatingParty(true)}
                style={styles.createPartyBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={13} color="#10B981" />
                <Text style={styles.createPartyBtnText}>+ New Party</Text>
              </TouchableOpacity>
            </View>
            <Select
              placeholder="Choose party..."
              value={partyId}
              onChange={setPartyId}
              searchable
              searchPlaceholder="Search party name or phone..."
              icon="person-outline"
              options={parties.map((party) => ({
                value: party.id,
                label: party.name,
                subLabel: party.phone,
              }))}
            />
          </View>
        )}

        {/* Amount */}
        <Input
          label="Credit Amount (₹) *"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          icon="cash-outline"
        />

        {/* Due Date with Quick Chips */}
        <View style={{ marginTop: 6 }}>
          <Input
            label="Due Date (YYYY-MM-DD, Optional)"
            value={dueDate}
            onChangeText={setDueDate}
            placeholder="e.g. 2026-11-15"
            icon="calendar-outline"
          />
          <View style={styles.presetsRow}>
            <Text style={styles.presetsLabel}>Presets:</Text>
            <TouchableOpacity
              style={styles.presetChip}
              onPress={() => handleSetPresetDueDate(7)}
              activeOpacity={0.7}
            >
              <Text style={styles.presetChipText}>+7 Days</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetChip}
              onPress={() => handleSetPresetDueDate(15)}
              activeOpacity={0.7}
            >
              <Text style={styles.presetChipText}>+15 Days</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetChip}
              onPress={() => handleSetPresetDueDate(30)}
              activeOpacity={0.7}
            >
              <Text style={styles.presetChipText}>+30 Days</Text>
            </TouchableOpacity>
            {dueDate ? (
              <TouchableOpacity
                style={[styles.presetChip, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}
                onPress={() => setDueDate('')}
                activeOpacity={0.7}
              >
                <Text style={[styles.presetChipText, { color: '#EF4444' }]}>Clear</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Notes */}
        <Input
          label="Notes / Reason (Optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. Advance paid against future delivery"
          icon="create-outline"
        />

        <Button
          title={
            submitting
              ? 'Saving Entry...'
              : `Record ${type === 'RECEIVABLE' ? 'Receivable' : 'Payable'} ${
                  amount ? formatINR(Number(amount) || 0) : ''
                }`
          }
          onPress={submit}
          loading={submitting}
          size="lg"
          variant="primary"
          style={{ marginTop: 12 }}
        />
      </View>
    </BottomSheetModal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      marginBottom: 6,
      textTransform: 'uppercase',
    },
    directionToggle: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    dirBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dirBtnActiveReceivable: {
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
      borderColor: '#EF4444',
    },
    dirBtnActivePayable: {
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
      borderColor: '#F59E0B',
    },
    dirTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    dirSub: {
      fontSize: 10,
      color: colors.textTertiary,
      marginTop: 1,
    },
    partySelectHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    partySelectLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
    },
    createPartyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 2,
      paddingHorizontal: 6,
    },
    createPartyBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#10B981',
    },
    spotPartyCard: {
      backgroundColor: 'rgba(16, 185, 129, 0.05)',
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.3)',
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
      gap: 6,
    },
    spotHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    spotTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: '#10B981',
    },
    spotCancelBtn: {
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 6,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    spotCancelText: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    presetsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
      marginBottom: 4,
    },
    presetsLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    presetChip: {
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 6,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    presetChipText: {
      fontSize: 11,
      color: colors.text,
      fontWeight: '600',
    },
  });
