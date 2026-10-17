import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Colors } from '@/constants/theme';
import { mobileApiRequest, cachedMobileApiRequest } from '@/lib/api';
import { formatINR } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';
import { Party, UpiAccount, UpiPreviewData } from './types';
import { PaymentSplitItem } from '@/components/invoices/types';
import { MultiPaymentSplitSelector } from '@/components/ui/MultiPaymentSplitSelector';
import { SettlementSuccessData } from './SettlementSuccessModal';

interface RecordSettlementModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (data?: SettlementSuccessData) => void;
  parties: Party[];
  onPartyCreated?: (newParty: Party) => void;
  initialDirection?: 'COLLECT' | 'PAY';
  initialPartyId?: string;
  initialAmount?: string;
  initialInvoiceId?: string;
  initialInvoiceNo?: string;
  initialNotes?: string;
}

export function RecordSettlementModal({
  visible,
  onClose,
  onSuccess,
  parties,
  onPartyCreated,
  initialDirection = 'COLLECT',
  initialPartyId = '',
  initialAmount = '',
  initialInvoiceId,
  initialInvoiceNo = '',
  initialNotes = '',
}: RecordSettlementModalProps) {
  const [direction, setDirection] = useState<'COLLECT' | 'PAY'>(initialDirection);
  const [selectedPartyId, setSelectedPartyId] = useState(initialPartyId || '');
  const [amount, setAmount] = useState(initialAmount || '');
  const [splits, setSplits] = useState<PaymentSplitItem[]>([
    { mode: initialDirection === 'PAY' ? 'CASH' : 'UPI', amount: initialAmount || '' },
  ]);
  const [mode, setMode] = useState<'CASH' | 'UPI'>('CASH');
  const [utr, setUtr] = useState('');
  const [notes, setNotes] = useState(initialNotes || '');
  const [invoiceId, setInvoiceId] = useState(initialInvoiceId || '');
  const [invoiceNo, setInvoiceNo] = useState(initialInvoiceNo || '');
  const [submitting, setSubmitting] = useState(false);

  // Quick "Create New Party On The Spot" inside Modal
  const [isCreatingPartyOnSpot, setIsCreatingPartyOnSpot] = useState(false);
  const [spotPartyName, setSpotPartyName] = useState('');
  const [spotPartyPhone, setSpotPartyPhone] = useState('');
  const [spotPartyAddress, setSpotPartyAddress] = useState('');
  const [spotPartyGstin, setSpotPartyGstin] = useState('');
  const [spotPartyLoading, setSpotPartyLoading] = useState(false);

  // Guard refs to prevent re-render loops and state overwriting
  const prevVisibleRef = useRef(false);
  const modeRef = useRef<'CASH' | 'UPI'>('CASH');
  const selectedUpiAccountRef = useRef<UpiAccount | null>(null);
  const upiReqIdRef = useRef(0);

  // Dynamic UPI Preview state
  const [upiAccounts, setUpiAccounts] = useState<UpiAccount[]>([]);
  const [selectedUpiAccount, setSelectedUpiAccount] = useState<UpiAccount | null>(null);
  const [upiPreview, setUpiPreview] = useState<UpiPreviewData | null>(null);
  const [upiLoading, setUpiLoading] = useState(false);

  const generateUpiQr = useCallback(
    async (amt: number, account?: UpiAccount | null) => {
      if (isNaN(amt) || amt <= 0) {
        setUpiPreview(null);
        return;
      }
      const reqId = ++upiReqIdRef.current;
      const target = account !== undefined ? account : selectedUpiAccountRef.current;
      setUpiLoading(true);
      try {
        const data = await mobileApiRequest<UpiPreviewData>('/payments/preview-upi-qr', {
          method: 'POST',
          body: JSON.stringify({
            amount: amt,
            note: 'Dhra ERP Settlement',
            vpa: target?.upiId,
            merchantName: target?.merchantName,
          }),
        });
        if (reqId === upiReqIdRef.current) {
          setUpiPreview(data);
        }
      } catch (err: any) {
        if (reqId === upiReqIdRef.current) {
          console.warn('Failed to generate UPI QR:', err.message);
          setUpiPreview(null);
        }
      } finally {
        if (reqId === upiReqIdRef.current) {
          setUpiLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      prevVisibleRef.current = true;
      setDirection(initialDirection);
      setSelectedPartyId(initialPartyId || '');
      setAmount(initialAmount || '');

      const defaultMode = initialDirection === 'PAY' ? 'CASH' : 'UPI';
      setSplits([{ mode: defaultMode, amount: initialAmount || '' }]);
      setMode(defaultMode);
      modeRef.current = defaultMode;

      setUtr('');
      setNotes(initialNotes || '');
      setInvoiceId(initialInvoiceId || '');
      setInvoiceNo(initialInvoiceNo || '');
      setUpiPreview(null);
      setUpiLoading(false);
      setIsCreatingPartyOnSpot(false);
      setSpotPartyName('');
      setSpotPartyPhone('');
      setSpotPartyAddress('');
      setSpotPartyGstin('');

      // Load UPI accounts from settings
      cachedMobileApiRequest<{ upiAccounts?: UpiAccount[] }>('/settings')
        .then((res) => {
          const accounts = res?.upiAccounts || [];
          setUpiAccounts(accounts);
          const primary = accounts.find((a) => a.isPrimary) || accounts[0] || null;
          setSelectedUpiAccount(primary);
          selectedUpiAccountRef.current = primary;

          const amtNum = parseFloat(initialAmount || '0');
          if (initialDirection === 'COLLECT' && defaultMode === 'UPI' && !isNaN(amtNum) && amtNum > 0) {
            void generateUpiQr(amtNum, primary);
          }
        })
        .catch(() => {
          const amtNum = parseFloat(initialAmount || '0');
          if (initialDirection === 'COLLECT' && defaultMode === 'UPI' && !isNaN(amtNum) && amtNum > 0) {
            void generateUpiQr(amtNum, null);
          }
        });
    } else if (!visible) {
      prevVisibleRef.current = false;
      setUpiPreview(null);
      setUpiLoading(false);
    }
  }, [visible, initialDirection, initialPartyId, initialAmount, initialNotes, initialInvoiceId, initialInvoiceNo, parties, generateUpiQr]);

  const handleAmountChange = (val: string) => {
    setAmount(val);
    if (splits.length === 1) {
      setSplits([{ ...splits[0], amount: val }]);
      const amtNum = parseFloat(val);
      if (splits[0].mode === 'UPI' && !isNaN(amtNum) && amtNum > 0 && direction === 'COLLECT') {
        void generateUpiQr(amtNum, selectedUpiAccountRef.current);
      } else {
        setUpiPreview(null);
      }
    }
  };

  const handleModeChange = (newMode: 'CASH' | 'UPI') => {
    upiReqIdRef.current++;
    setMode(newMode);
    modeRef.current = newMode;
    if (newMode === 'UPI' && direction === 'COLLECT') {
      const amtNum = parseFloat(amount);
      if (!isNaN(amtNum) && amtNum > 0) {
        void generateUpiQr(amtNum, selectedUpiAccountRef.current);
      }
    } else {
      setUpiPreview(null);
      setUpiLoading(false);
      setUtr('');
    }
  };

  const handleCreatePartyOnSpot = async () => {
    const cleanPhone = spotPartyPhone.replace(/\D/g, '');
    if (!spotPartyName.trim()) {
      Alert.alert('Required Field', 'Please enter customer / party name');
      return;
    }
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Mobile', 'Mobile number must be exactly 10 digits');
      return;
    }

    setSpotPartyLoading(true);
    try {
      const newParty = await mobileApiRequest<Party>('/parties', {
        method: 'POST',
        body: JSON.stringify({
          name: spotPartyName.trim(),
          phone: cleanPhone,
          address: spotPartyAddress.trim() || undefined,
          gstin: spotPartyGstin.trim().toUpperCase() || undefined,
        }),
      });

      if (onPartyCreated) {
        onPartyCreated(newParty);
      }
      setSelectedPartyId(newParty.id);
      setIsCreatingPartyOnSpot(false);
      setSpotPartyName('');
      setSpotPartyPhone('');
      setSpotPartyAddress('');
      setSpotPartyGstin('');
      Alert.alert('Party Created', `Added ${newParty.name} and selected for this settlement.`);
    } catch (err: any) {
      Alert.alert('Error Creating Party', err.message || 'Could not create party');
    } finally {
      setSpotPartyLoading(false);
    }
  };

  const handleSubmit = async () => {
    const validSplits = splits.filter((s) => {
      const a = parseFloat(s.amount);
      return !isNaN(a) && a > 0;
    });
    const totalSplitAmount = validSplits.reduce((acc, s) => acc + parseFloat(s.amount), 0);
    if (!selectedPartyId || totalSplitAmount <= 0) {
      Alert.alert('Required Fields', 'Please select a party and enter the settlement amount');
      return;
    }

    setSubmitting(true);
    try {
      const targetParty = parties.find((p) => p.id === selectedPartyId);
      const defaultNote =
        direction === 'PAY'
          ? `Disbursement to ${targetParty?.name || 'Party'}`
          : `Settlement received from ${targetParty?.name || 'Customer'}`;

      const primaryUtr = validSplits.find((s) => s.mode === 'UPI' && s.upiUtr)?.upiUtr || utr.trim() || undefined;

      await mobileApiRequest('/payments', {
        method: 'POST',
        body: JSON.stringify({
          partyId: selectedPartyId,
          invoiceId: invoiceId || undefined,
          type: direction === 'COLLECT' ? 'INFLOW' : 'OUTFLOW',
          mode: validSplits.length > 1 ? 'SPLIT' : validSplits[0]?.mode,
          amount: totalSplitAmount,
          upiTxnRef: primaryUtr,
          upiUtr: primaryUtr,
          notes: notes.trim() || defaultNote,
          autoConfirm: true,
          splits: validSplits.map((s) => ({
            mode: s.mode,
            amount: parseFloat(s.amount),
            upiUtr: s.upiUtr?.trim() || (s.mode === 'UPI' ? utr.trim() || undefined : undefined),
            notes: s.notes?.trim() || undefined,
          })),
        }),
      });

      onClose();
      onSuccess({
        direction,
        amount: totalSplitAmount,
        partyName: targetParty?.name || 'Party',
        partyPhone: targetParty?.phone,
        mode: validSplits.length > 1 ? 'SPLIT' : validSplits[0]?.mode,
        invoiceNo: invoiceNo || undefined,
        utr: primaryUtr,
        notes: notes.trim() || defaultNote,
      });
    } catch (err: any) {
      Alert.alert('Settlement Failed', err.message || 'Could not record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const initialAmountNum = parseFloat(initialAmount || '0');

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={direction === 'COLLECT' ? 'Collect Payment' : 'Disburse Payout'}
      subtitle={
        direction === 'COLLECT'
          ? 'Record customer receipt via live dynamic UPI QR or Cash'
          : 'Record vendor or supplier payment disbursement'
      }
    >
      <View>
        {/* Direction Switcher */}
        <View style={styles.directionToggle}>
          <TouchableOpacity
            style={[styles.dirBtn, direction === 'COLLECT' && styles.dirBtnActiveCollect]}
            onPress={() => {
              setDirection('COLLECT');
              setSplits([{ mode: 'UPI', amount }]);
              const amtNum = parseFloat(amount);
              if (!isNaN(amtNum) && amtNum > 0) {
                void generateUpiQr(amtNum, selectedUpiAccount);
              }
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="arrow-down-circle"
              size={15}
              color={direction === 'COLLECT' ? '#10B981' : Colors.dark.textSecondary}
            />
            <Text
              style={[
                styles.dirText,
                direction === 'COLLECT' && { color: '#10B981', fontWeight: '800' },
              ]}
            >
              Collect (Inflow)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dirBtn, direction === 'PAY' && styles.dirBtnActivePay]}
            onPress={() => {
              setDirection('PAY');
              setSplits([{ mode: 'CASH', amount }]);
              setUpiPreview(null);
            }}
            activeOpacity={0.8}
          >
          <Ionicons
            name="arrow-up-circle"
            size={15}
            color={direction === 'PAY' ? '#F59E0B' : Colors.dark.textSecondary}
          />
          <Text
            style={[
              styles.dirText,
              direction === 'PAY' && { color: '#F59E0B', fontWeight: '800' },
            ]}
          >
            Pay Out (Disbursement)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Inline Create Party on the Spot or Party Select */}
      {isCreatingPartyOnSpot ? (
        <View style={styles.spotPartyCard}>
          <View style={styles.spotHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="person-add" size={16} color="#10B981" />
              <Text style={styles.spotTitle}>Quick Add Party On The Spot</Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsCreatingPartyOnSpot(false)}
              style={styles.spotCancelBtn}
            >
              <Text style={styles.spotCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <Input
            label="Party / Customer Name *"
            placeholder="e.g. Rahul Sharma or Balaji Traders"
            value={spotPartyName}
            onChangeText={setSpotPartyName}
            icon="person-outline"
          />

          <Input
            label="Mobile Number (10 digits) *"
            placeholder="e.g. 9876543210"
            value={spotPartyPhone}
            onChangeText={setSpotPartyPhone}
            keyboardType="phone-pad"
            icon="call-outline"
          />

          <Input
            label="Address (Optional)"
            placeholder="e.g. Shop 4, Gandhi Chowk"
            value={spotPartyAddress}
            onChangeText={setSpotPartyAddress}
            icon="location-outline"
          />

          <Input
            label="GSTIN (Optional)"
            placeholder="e.g. 08AAACD1234E1Z5"
            value={spotPartyGstin}
            onChangeText={setSpotPartyGstin}
            autoCapitalize="characters"
            icon="document-text-outline"
          />

          <Button
            title={spotPartyLoading ? 'Saving Party...' : 'Save & Select Party'}
            variant="primary"
            loading={spotPartyLoading}
            onPress={handleCreatePartyOnSpot}
            style={{ marginTop: 6 }}
          />
        </View>
      ) : (
        <View style={{ marginBottom: 4 }}>
          <View style={styles.partySelectHeader}>
            <Text style={styles.partySelectLabel}>
              {direction === 'COLLECT' ? 'Customer / Party *' : 'Vendor / Party *'}
            </Text>
            <TouchableOpacity
              onPress={() => setIsCreatingPartyOnSpot(true)}
              style={styles.createPartyBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={13} color="#10B981" />
              <Text style={styles.createPartyBtnText}>+ New Party</Text>
            </TouchableOpacity>
          </View>

          <Select
            placeholder="Choose customer / party..."
            value={selectedPartyId}
            onChange={setSelectedPartyId}
            searchable
            searchPlaceholder="Search party name or phone..."
            icon="person-outline"
            options={parties.map((p) => ({
              value: p.id,
              label: p.name,
              subLabel: p.phone + (p.address ? ` • ${p.address}` : ''),
              badge: p.gstin ? 'GST' : undefined,
            }))}
          />
        </View>
      )}

      {/* Amount with Quick Helper Chips */}
      <View style={{ marginTop: 6 }}>
        <Input
          label={direction === 'COLLECT' ? 'Settlement Amount (₹) *' : 'Disbursement Amount (₹) *'}
          placeholder="e.g. 5000"
          value={amount}
          onChangeText={handleAmountChange}
          keyboardType="numeric"
        />

        {initialAmountNum > 0 && (
          <View style={styles.quickChipsRow}>
            <Text style={styles.quickChipsLabel}>Quick Fill:</Text>
            <TouchableOpacity
              style={styles.quickChip}
              onPress={() => handleAmountChange(initialAmountNum.toFixed(2))}
              activeOpacity={0.7}
            >
              <Text style={styles.quickChipText}>Full ({formatINR(initialAmountNum)})</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickChip}
              onPress={() => handleAmountChange((initialAmountNum / 2).toFixed(2))}
              activeOpacity={0.7}
            >
              <Text style={styles.quickChipText}>50% ({formatINR(initialAmountNum / 2)})</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickChip, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}
              onPress={() => handleAmountChange('')}
              activeOpacity={0.7}
            >
              <Text style={[styles.quickChipText, { color: '#EF4444' }]}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Multi-Payment Split Selector */}
      <MultiPaymentSplitSelector
        totalAmount={parseFloat(amount) || 0}
        splits={splits}
        onChange={(newSplits) => {
          setSplits(newSplits);
          const upiRow = newSplits.find((s) => s.mode === 'UPI');
          const upiVal = upiRow ? parseFloat(upiRow.amount) : 0;
          if (!isNaN(upiVal) && upiVal > 0 && direction === 'COLLECT') {
            void generateUpiQr(upiVal, selectedUpiAccountRef.current);
          } else {
            setUpiPreview(null);
          }
        }}
        allowCredit={false}
        onPreviewUpi={(amt) => void generateUpiQr(amt, selectedUpiAccountRef.current)}
        previewUpiLoading={upiLoading}
      />

      {/* Dynamic UPI Section when Collecting via UPI */}
      {direction === 'COLLECT' && splits.some((s) => s.mode === 'UPI') ? (
        <View style={styles.upiContainer}>
          {upiAccounts.length > 0 ? (
            <View style={{ marginBottom: 10 }}>
              <Select
                label="Receive into UPI Account"
                placeholder="Select UPI Account..."
                value={selectedUpiAccount?.id || (upiAccounts.find((a) => a.isPrimary)?.id || upiAccounts[0]?.id || '')}
                onChange={(id) => {
                  const acc = upiAccounts.find((a) => a.id === id);
                  if (acc) {
                    setSelectedUpiAccount(acc);
                    const upiRow = splits.find((s) => s.mode === 'UPI');
                    const amtNum = upiRow ? parseFloat(upiRow.amount) : 0;
                    if (!isNaN(amtNum) && amtNum > 0) {
                      void generateUpiQr(amtNum, acc);
                    }
                  }
                }}
                icon="qr-code-outline"
                options={upiAccounts.map((acc) => ({
                  value: acc.id,
                  label: acc.upiId,
                  subLabel: acc.merchantName || undefined,
                  badge: acc.isPrimary ? 'Primary' : undefined,
                }))}
              />
            </View>
          ) : (
            <View style={styles.upiWarningBox}>
              <Ionicons name="information-circle-outline" size={14} color="#F59E0B" />
              <Text style={styles.upiWarningText}>
                No store UPI IDs configured yet. Please configure a UPI ID in Director Settings.
              </Text>
            </View>
          )}

          {upiLoading ? (
            <View style={styles.qrLoadingBox}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.qrLoadingText}>Generating exact-amount QR code...</Text>
            </View>
          ) : upiPreview?.qrDataUrl ? (
            <View style={styles.qrCard}>
              <View style={styles.qrWhiteBox}>
                <Image
                  source={{ uri: upiPreview.qrDataUrl }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.qrAmountText}>
                Amount Pre-filled: <Text style={styles.qrAmountHighlight}>{formatINR(upiPreview.amount)}</Text>
              </Text>
              <Text style={styles.qrVpaText}>Target VPA: {upiPreview.vpa}</Text>
              <Text style={styles.qrSubText}>
                Customer scans with GPay, PhonePe, Paytm, or BHIM
              </Text>
            </View>
          ) : (
            <View style={styles.qrPromptBox}>
              <Ionicons name="qr-code-outline" size={32} color="#A1A1AA" />
              <Text style={styles.qrPromptText}>
                Enter an amount above for UPI to generate live NPCI QR code
              </Text>
            </View>
          )}

          <Input
            label="UPI UTR / Reference No. (Optional)"
            placeholder="e.g. 402918239012"
            value={utr}
            onChangeText={setUtr}
            keyboardType="numeric"
          />
        </View>
      ) : null}

      {/* Notes */}
      <Input
        label={direction === 'PAY' ? 'Payment Notes' : 'Transaction Notes (Optional)'}
        placeholder={
          direction === 'PAY'
            ? 'e.g. Cleared vendor invoice or advance repayment'
            : 'e.g. Cleared 50% invoice balance'
        }
        value={notes}
        onChangeText={setNotes}
      />

      <Button
        title={
          submitting
            ? 'Recording...'
            : direction === 'COLLECT'
            ? `Confirm Settlement Received ${formatINR(splits.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0))}`
            : `Confirm & Disburse ${formatINR(splits.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0))}`
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
  directionToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 3,
    marginBottom: 12,
  },
  dirBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
  },
  dirBtnActiveCollect: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  dirBtnActivePay: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  dirText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    marginBottom: 4,
    marginTop: 8,
    textTransform: 'uppercase',
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
    color: Colors.dark.textSecondary,
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
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  spotCancelText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  quickChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    marginBottom: 4,
  },
  quickChipsLabel: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  quickChip: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 6,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  quickChipText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '700',
  },
  modeToggleBar: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 3,
    marginBottom: 10,
    gap: 6,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
  },
  modeBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  modeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  modeTextActive: {
    color: '#09090B',
  },
  upiContainer: {
    backgroundColor: '#121216',
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  qrLoadingBox: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrLoadingText: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    marginTop: 8,
  },
  qrCard: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  qrWhiteBox: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  qrImage: {
    width: 170,
    height: 170,
  },
  qrAmountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  qrAmountHighlight: {
    color: '#10B981',
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  qrVpaText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  qrSubText: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
    marginTop: 4,
  },
  qrPromptBox: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  qrPromptText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
  },
  cashContainer: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  cashHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cashHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
  },
  cashSubText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    lineHeight: 16,
  },
  cashAmountBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginVertical: 4,
  },
  cashAmountLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  cashAmountVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#10B981',
    fontFamily: 'monospace',
  },
  upiWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  upiWarningText: {
    fontSize: 11,
    color: '#F59E0B',
    flex: 1,
  },
});
