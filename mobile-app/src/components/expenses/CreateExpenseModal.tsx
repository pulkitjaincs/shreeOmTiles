import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/theme';
import { mobileApiRequest } from '@/lib/api';

const CATEGORIES = [
  { label: 'Misc', value: 'MISC' },
  { label: 'Logistics', value: 'LOGISTICS' },
  { label: 'Salary', value: 'SALARY' },
  { label: 'Rent', value: 'RENT' },
  { label: 'Utilities', value: 'UTILITIES' },
  { label: 'Packaging', value: 'PACKAGING' },
];

const MODES = [
  { label: 'Cash', value: 'CASH' },
  { label: 'UPI', value: 'UPI' },
  { label: 'Bank Transfer', value: 'BANK_TRANSFER' },
];

interface CreateExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateExpenseModal({
  visible,
  onClose,
  onSuccess,
}: CreateExpenseModalProps) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('MISC');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [paidTo, setPaidTo] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const numAmt = parseFloat(amount);
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter expense description / title.');
      return;
    }
    if (isNaN(numAmt) || numAmt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid expense amount.');
      return;
    }

    setSubmitting(true);
    try {
      const trimmedTitle = title.trim();
      const trimmedNotes = notes.trim();
      const combinedNotes = trimmedTitle
        ? (trimmedNotes ? `${trimmedTitle} - ${trimmedNotes}` : trimmedTitle)
        : (trimmedNotes || undefined);

      await mobileApiRequest('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          title: trimmedTitle,
          amount: numAmt,
          category,
          paymentMode,
          paidTo: paidTo.trim() || undefined,
          notes: combinedNotes,
        }),
      });
      Alert.alert('Success', 'Expense recorded successfully');
      setTitle('');
      setAmount('');
      setPaidTo('');
      setNotes('');
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not record expense');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Record Business Expense"
      subtitle="Outflow from till cash or business bank account"
      maxHeightPercent={0.88}
    >
      <ScrollView contentContainerStyle={styles.formContainer}>
        {/* Title */}
        <Text style={styles.inputLabel}>Expense Title / Description *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Warehouse electricity bill, Tea & snacks..."
          placeholderTextColor={Colors.dark.textTertiary}
          value={title}
          onChangeText={setTitle}
        />

        {/* Amount */}
        <Text style={styles.inputLabel}>Amount (₹) *</Text>
        <TextInput
          style={[styles.input, styles.amountInput]}
          placeholder="0.00"
          placeholderTextColor={Colors.dark.textTertiary}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />

        {/* Category Selector */}
        <Text style={styles.inputLabel}>Category</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.value}
              style={[styles.chip, category === cat.value && styles.chipActive]}
              onPress={() => setCategory(cat.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.chipText,
                  category === cat.value && styles.chipTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Payment Mode */}
        <Text style={styles.inputLabel}>Disbursed Via</Text>
        <View style={styles.chipRow}>
          {MODES.map((m) => (
            <TouchableOpacity
              key={m.value}
              style={[styles.chip, paymentMode === m.value && styles.chipActive]}
              onPress={() => setPaymentMode(m.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.chipText,
                  paymentMode === m.value && styles.chipTextActive,
                ]}
              >
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Paid To */}
        <Text style={styles.inputLabel}>Paid To (Beneficiary)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Electric Board, Ramu Chaiwala..."
          placeholderTextColor={Colors.dark.textTertiary}
          value={paidTo}
          onChangeText={setPaidTo}
        />

        {/* Notes */}
        <Text style={styles.inputLabel}>Remarks / Notes</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="Optional remarks..."
          placeholderTextColor={Colors.dark.textTertiary}
          multiline
          numberOfLines={2}
          value={notes}
          onChangeText={setNotes}
        />

        <Button
          title="Save & Disburse Expense"
          variant="primary"
          size="lg"
          loading={submitting}
          onPress={handleSubmit}
          style={{ marginTop: 14 }}
        />
      </ScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    paddingBottom: 24,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    marginBottom: 5,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  input: {
    height: 42,
    backgroundColor: Colors.dark.cardElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 12,
    color: '#FFFFFF',
    fontSize: 13,
  },
  amountInput: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'monospace',
    color: '#EF4444',
  },
  notesInput: {
    height: 60,
    paddingTop: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.dark.cardElevated,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  chipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  chipTextActive: {
    color: '#09090B',
  },
});
