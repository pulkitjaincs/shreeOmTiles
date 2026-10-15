import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/theme';
import { mobileApiRequest, cachedMobileApiRequest } from '@/lib/api';
import { formatINR } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';
import { Party, UpiAccount, UpiPreviewData } from './types';

interface RecordSettlementModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  parties: Party[];
  initialDirection?: 'COLLECT' | 'PAY';
  initialPartyId?: string;
  initialAmount?: string;
}

export function RecordSettlementModal({
  visible,
  onClose,
  onSuccess,
  parties,
  initialDirection = 'COLLECT',
  initialPartyId = '',
  initialAmount = '',
}: RecordSettlementModalProps) {
  const [direction, setDirection] = useState<'COLLECT' | 'PAY'>(initialDirection);
  const [selectedPartyId, setSelectedPartyId] = useState(initialPartyId || parties[0]?.id || '');
  const [amount, setAmount] = useState(initialAmount || '');
  const [mode, setMode] = useState<'CASH' | 'UPI'>('CASH');
  const [utr, setUtr] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      if (isNaN(amt) || amt <= 0 || modeRef.current !== 'UPI') {
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
        if (reqId === upiReqIdRef.current && modeRef.current === 'UPI') {
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
      setSelectedPartyId(initialPartyId || parties[0]?.id || '');
      setAmount(initialAmount || '');

      const defaultMode = initialDirection === 'PAY' ? 'CASH' : 'UPI';
      setMode(defaultMode);
      modeRef.current = defaultMode;

      setUtr('');
      setNotes('');
      setUpiPreview(null);
      setUpiLoading(false);

      // Load UPI accounts from settings
      cachedMobileApiRequest<{ upiAccounts?: UpiAccount[] }>('/settings')
        .then((res) => {
          const accounts = res?.upiAccounts || [];
          setUpiAccounts(accounts);
          const primary = accounts.find((a) => a.isPrimary) || accounts[0] || null;
          setSelectedUpiAccount(primary);
          selectedUpiAccountRef.current = primary;

          const amtNum = parseFloat(initialAmount || '0');
          if (initialDirection === 'COLLECT' && modeRef.current === 'UPI' && !isNaN(amtNum) && amtNum > 0) {
            void generateUpiQr(amtNum, primary);
          }
        })
        .catch(() => {
          const amtNum = parseFloat(initialAmount || '0');
          if (initialDirection === 'COLLECT' && modeRef.current === 'UPI' && !isNaN(amtNum) && amtNum > 0) {
            void generateUpiQr(amtNum, null);
          }
        });
    } else if (!visible) {
      prevVisibleRef.current = false;
      setUpiPreview(null);
      setUpiLoading(false);
    }
  }, [visible, initialDirection, initialPartyId, initialAmount, parties, generateUpiQr]);

  const handleAmountChange = (val: string) => {
    setAmount(val);
    const amtNum = parseFloat(val);
    if (!isNaN(amtNum) && amtNum > 0 && modeRef.current === 'UPI' && direction === 'COLLECT') {
      void generateUpiQr(amtNum, selectedUpiAccountRef.current);
    } else {
      setUpiPreview(null);
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

  const handleSubmit = async () => {
    if (!selectedPartyId || !amount) {
      Alert.alert('Required Fields', 'Please select a party and enter the settlement amount');
      return;
    }
    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      Alert.alert('Invalid Amount', 'Amount must be greater than zero');
      return;
    }

    setSubmitting(true);
    try {
      const targetParty = parties.find((p) => p.id === selectedPartyId);
      const defaultNote =
        direction === 'PAY'
          ? `Disbursement to ${targetParty?.name || 'Party'}`
          : `Settlement received from ${targetParty?.name || 'Customer'}`;

      await mobileApiRequest('/payments', {
        method: 'POST',
        body: JSON.stringify({
          partyId: selectedPartyId,
          type: direction === 'COLLECT' ? 'INFLOW' : 'OUTFLOW',
          mode: direction === 'PAY' ? 'CASH' : mode,
          amount: amtNum,
          upiTxnRef: direction === 'COLLECT' && utr.trim() ? utr.trim() : undefined,
          upiUtr: direction === 'COLLECT' && utr.trim() ? utr.trim() : undefined,
          notes: notes.trim() || defaultNote,
          autoConfirm: true,
        }),
      });

      Alert.alert(
        'Settlement Recorded',
        `Recorded ${direction === 'COLLECT' ? 'receipt' : 'payout'} of ${formatINR(amtNum)}!`,
      );
      onClose();
      onSuccess();
    } catch (err: any) {
      Alert.alert('Settlement Failed', err.message || 'Could not record payment');
    } finally {
      setSubmitting(false);
    }
  };

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
              const amtNum = parseFloat(amount);
              if (mode === 'UPI' && !isNaN(amtNum) && amtNum > 0) {
                void generateUpiQr(amtNum, selectedUpiAccount);
              }
            }}
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
              setUpiPreview(null);
            }}
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

        {/* Party Selector */}
        <Text style={styles.fieldLabel}>
          {direction === 'COLLECT' ? 'Customer / Party' : 'Vendor / Party'}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
          {parties.map((p) => {
            const isSelected = selectedPartyId === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => setSelectedPartyId(p.id)}
                style={[styles.smallChip, isSelected && styles.smallChipActive]}
              >
                <Text style={[styles.smallChipText, isSelected && styles.smallChipTextActive]}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Amount */}
        <Input
          label="Settlement Amount (₹)"
          placeholder="e.g. 5000"
          value={amount}
          onChangeText={handleAmountChange}
          keyboardType="numeric"
        />

        {/* Payment Mode Selector (Only needed for collections) */}
        {direction === 'COLLECT' && (
          <>
            <Text style={styles.fieldLabel}>Payment Mode</Text>
            <View style={styles.modeToggleBar}>
              {(['CASH', 'UPI'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
                  onPress={() => handleModeChange(m)}
                >
                  <Ionicons
                    name={m === 'CASH' ? 'cash-outline' : 'qr-code-outline'}
                    size={14}
                    color={mode === m ? '#09090B' : Colors.dark.textSecondary}
                  />
                  <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>
                    {m === 'CASH' ? 'Cash in Hand' : 'UPI (Dynamic QR)'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Dynamic UPI Section when Collecting via UPI */}
        {direction === 'COLLECT' && mode === 'UPI' ? (
          <View style={styles.upiContainer}>
            {upiAccounts.length > 1 ? (
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.upiAccountLabel}>Receive into UPI Account:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                  {upiAccounts.map((acc) => {
                    const isSelected = selectedUpiAccount?.id === acc.id;
                    return (
                      <TouchableOpacity
                        key={acc.id}
                        onPress={() => {
                          setSelectedUpiAccount(acc);
                          const amtNum = parseFloat(amount);
                          if (!isNaN(amtNum) && amtNum > 0) {
                            void generateUpiQr(amtNum, acc);
                          }
                        }}
                        style={[styles.accChip, isSelected && styles.accChipActive]}
                      >
                        <Text style={[styles.accChipText, isSelected && styles.accChipTextActive]}>
                          {acc.upiId} {acc.merchantName ? `(${acc.merchantName})` : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

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
                  Enter an amount above to generate live NPCI QR code
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

        {direction === 'COLLECT' && mode === 'CASH' ? (
          <View style={styles.cashContainer}>
            <View style={styles.cashHeaderRow}>
              <Ionicons name="cash" size={20} color="#10B981" />
              <Text style={styles.cashHeaderTitle}>Cash in Hand Collection</Text>
            </View>
            <Text style={styles.cashSubText}>
              Collect physical cash directly from customer and record the deposit into store register drawer.
            </Text>
            <View style={styles.cashAmountBox}>
              <Text style={styles.cashAmountLabel}>Exact Cash to Receive:</Text>
              <Text style={styles.cashAmountVal}>
                {amount ? formatINR(parseFloat(amount) || 0) : '₹0.00'}
              </Text>
            </View>
            <Input
              label="Cash Drawer Note / Slip No. (Optional)"
              placeholder="e.g. Counter 1 Register Slip"
              value={utr}
              onChangeText={setUtr}
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
              ? mode === 'CASH'
                ? `Confirm Cash Received ${amount ? formatINR(parseFloat(amount) || 0) : ''}`
                : `Confirm UPI Received ${amount ? formatINR(parseFloat(amount) || 0) : ''}`
              : `Confirm & Disburse ${amount ? formatINR(parseFloat(amount) || 0) : ''}`
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
  smallChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginRight: 6,
  },
  smallChipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  smallChipText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  smallChipTextActive: {
    color: '#09090B',
    fontWeight: '800',
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
  upiAccountLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
  },
  accChip: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 6,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginRight: 6,
  },
  accChipActive: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  accChipText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontFamily: 'monospace',
  },
  accChipTextActive: {
    color: '#10B981',
    fontWeight: '700',
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
});
