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
import { useTheme, useThemedStyles } from '@/lib/theme-context';
import { mobileApiRequest } from '@/lib/api';
import { formatINR } from '@/lib/formatters';
import { MultiPaymentSplitSelector, PaymentSplitItem } from '@/components/ui/MultiPaymentSplitSelector';

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
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('MISC');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [isSplit, setIsSplit] = useState(false);
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplitItem[]>([
    { mode: 'CASH', amount: '' },
  ]);
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

    const validSplits = paymentSplits.filter(
      (s) => s.amount !== '' && !isNaN(parseFloat(s.amount)) && parseFloat(s.amount) > 0,
    );

    if (isSplit) {
      if (validSplits.length === 0) {
        Alert.alert('Payment Split Required', 'Please allocate at least one payment method amount.');
        return;
      }
      const allocated = validSplits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
      if (Math.abs(allocated - numAmt) > 0.05) {
        Alert.alert(
          'Split Allocation Mismatch',
          `Allocated payment total (${formatINR(allocated)}) must match expense amount (${formatINR(numAmt)}).`,
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const trimmedTitle = title.trim();
      const trimmedNotes = notes.trim();
      const combinedNotes = trimmedTitle
        ? (trimmedNotes ? `${trimmedTitle} - ${trimmedNotes}` : trimmedTitle)
        : (trimmedNotes || undefined);

      const resolvedMode = !isSplit
        ? paymentMode
        : validSplits.length > 1
        ? 'SPLIT'
        : validSplits[0].mode;

      const payload: any = {
        title: trimmedTitle,
        amount: numAmt,
        category,
        paymentMode: resolvedMode,
        paidTo: paidTo.trim() || undefined,
        notes: combinedNotes,
      };

      if (isSplit) {
        payload.splits = validSplits.map((s) => ({
          mode: s.mode,
          amount: parseFloat(s.amount) || 0,
          referenceNo: s.referenceNo?.trim() || undefined,
        }));
      }

      await mobileApiRequest('/expenses', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      Alert.alert('Success', 'Expense recorded successfully');
      setTitle('');
      setAmount('');
      setPaidTo('');
      setNotes('');
      setIsSplit(false);
      setPaymentSplits([{ mode: 'CASH', amount: '' }]);
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
          placeholderTextColor={colors.textTertiary}
          value={title}
          onChangeText={setTitle}
        />

        {/* Amount */}
        <Text style={styles.inputLabel}>Amount (₹) *</Text>
        <TextInput
          style={[styles.input, styles.amountInput]}
          placeholder="0.00"
          placeholderTextColor={colors.textTertiary}
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

        {/* Payment Mode / Split */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 5 }}>
          <Text style={[styles.inputLabel, { marginTop: 0, marginBottom: 0 }]}>Disbursed Via</Text>
          <TouchableOpacity
            onPress={() => {
              const nextSplit = !isSplit;
              setIsSplit(nextSplit);
              if (nextSplit) {
                setPaymentSplits([{ mode: 'CASH', amount: amount || '' }]);
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#38BDF8' }}>
              {isSplit ? 'Single Mode' : '+ Split Modes'}
            </Text>
          </TouchableOpacity>
        </View>

        {!isSplit ? (
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
        ) : (
          <MultiPaymentSplitSelector
            totalAmount={parseFloat(amount) || 0}
            splits={paymentSplits}
            onChange={setPaymentSplits}
            balanceLabel="Remaining to allocate"
            allowZero={false}
          />
        )}

        {/* Paid To */}
        <Text style={styles.inputLabel}>Paid To (Beneficiary)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Electric Board, Ramu Chaiwala..."
          placeholderTextColor={colors.textTertiary}
          value={paidTo}
          onChangeText={setPaidTo}
        />

        {/* Notes */}
        <Text style={styles.inputLabel}>Remarks / Notes</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="Optional remarks..."
          placeholderTextColor={colors.textTertiary}
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

const createStyles = (colors: any) =>
  StyleSheet.create({
    formContainer: {
      paddingBottom: 24,
    },
    inputLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      marginBottom: 5,
      marginTop: 10,
      textTransform: 'uppercase',
    },
    input: {
      height: 42,
      backgroundColor: colors.cardElevated,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      color: colors.text,
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
      backgroundColor: colors.cardElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.text,
      borderColor: colors.text,
    },
    chipText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    chipTextActive: {
      color: colors.background,
    },
  });
