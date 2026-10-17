'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Banknote,
  ArrowUpRight,
  Plus,
  X,
  Loader2,
  UserPlus,
} from 'lucide-react';
import { ThemedSelect } from '@/components/ui/themed-select';
import { Party, UpiPreviewData, UpiAccount } from './types';
import { MultiPaymentSplitSelector, SplitRow, PaymentMethodType } from '@/components/shared/multi-payment-split-selector';

interface SettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  parties: Party[];
  onPartyCreated?: (newParty: Party) => void;
  initialDirection?: 'COLLECT' | 'PAY';
  initialPartyId?: string;
  initialInvoiceId?: string;
  initialAmount?: string;
  initialNotes?: string;
  initialMode?: PaymentMethodType;
}

export function SettlementModal({
  isOpen,
  onClose,
  onSuccess,
  parties,
  onPartyCreated,
  initialDirection = 'COLLECT',
  initialPartyId = '',
  initialInvoiceId = '',
  initialAmount = '',
  initialNotes = '',
  initialMode,
}: SettlementModalProps) {
  const [modalDirection, setModalDirection] = useState<'COLLECT' | 'PAY'>(initialDirection);
  const [selectedPartyId, setSelectedPartyId] = useState(initialPartyId || parties[0]?.id || '');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(initialInvoiceId || '');
  const [collectAmount, setCollectAmount] = useState(initialAmount || '');
  const [splits, setSplits] = useState<SplitRow[]>([
    { mode: initialMode || (initialDirection === 'PAY' ? 'CASH' : 'UPI'), amount: initialAmount || '' },
  ]);
  const [collectUtr, setCollectUtr] = useState('');
  const [collectNotes, setCollectNotes] = useState(initialNotes || '');
  const [collectSubmitting, setCollectSubmitting] = useState(false);
  const [collectError, setCollectError] = useState('');

  // Refs to prevent dependency loop glitches and state overwrites
  const prevOpenRef = useRef(false);
  const selectedUpiAccountRef = useRef<UpiAccount | null>(null);

  // Dynamic UPI Preview State
  const [upiPreview, setUpiPreview] = useState<UpiPreviewData | null>(null);
  const [upiLoading, setUpiLoading] = useState(false);
  const [upiAccounts, setUpiAccounts] = useState<UpiAccount[]>([]);
  const [selectedUpiAccount, setSelectedUpiAccount] = useState<UpiAccount | null>(null);

  // Quick "Create New Party On The Spot" inside Modal
  const [isCreatingPartyOnSpot, setIsCreatingPartyOnSpot] = useState(false);
  const [spotPartyName, setSpotPartyName] = useState('');
  const [spotPartyPhone, setSpotPartyPhone] = useState('');
  const [spotPartyAddress, setSpotPartyAddress] = useState('');
  const [spotPartyGstin, setSpotPartyGstin] = useState('');
  const [spotPartyLoading, setSpotPartyLoading] = useState(false);
  const [spotPartyError, setSpotPartyError] = useState('');

  const generateUpiQr = useCallback(
    async (amountNum: number, note?: string, account?: UpiAccount | null) => {
      if (isNaN(amountNum) || amountNum <= 0) {
        setUpiPreview(null);
        return;
      }
      const target = account !== undefined ? account : selectedUpiAccountRef.current;
      setUpiLoading(true);
      try {
        const data = await apiRequest<UpiPreviewData>('/payments/preview-upi-qr', {
          method: 'POST',
          body: JSON.stringify({
            amount: amountNum,
            note: note || 'Shree Om Tiles Payment',
            vpa: target?.upiId,
            merchantName: target?.merchantName,
          }),
        });
        setUpiPreview(data);
      } catch (err) {
        console.error('Failed to generate UPI QR:', err);
      } finally {
        setUpiLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      prevOpenRef.current = true;
      setModalDirection(initialDirection);
      setSelectedPartyId(initialPartyId || parties[0]?.id || '');
      setSelectedInvoiceId(initialInvoiceId || '');
      setCollectAmount(initialAmount || '');

      const resolvedMode = initialMode || (initialDirection === 'PAY' ? 'CASH' : 'UPI');
      setSplits([{ mode: resolvedMode, amount: initialAmount || '' }]);

      setCollectUtr('');
      setCollectNotes(initialNotes || '');
      setCollectError('');
      setIsCreatingPartyOnSpot(false);

      const num = parseFloat(initialAmount || '0');

      const fetchUpiAccounts = async () => {
        try {
          const res = await apiRequest<{ upiAccounts?: UpiAccount[] }>('/settings');
          const accounts = res.upiAccounts || [];
          setUpiAccounts(accounts);
          const primary = accounts.find((a) => a.isPrimary) || accounts[0] || null;
          setSelectedUpiAccount(primary);
          selectedUpiAccountRef.current = primary;

          if (initialDirection === 'COLLECT' && resolvedMode === 'UPI' && !isNaN(num) && num > 0) {
            void generateUpiQr(num, initialNotes, primary);
          } else {
            setUpiPreview(null);
          }
        } catch (e) {
          console.error('Failed to load UPI accounts:', e);
          if (initialDirection === 'COLLECT' && resolvedMode === 'UPI' && !isNaN(num) && num > 0) {
            void generateUpiQr(num, initialNotes, null);
          } else {
            setUpiPreview(null);
          }
        }
      };

      void fetchUpiAccounts();
    } else if (!isOpen) {
      prevOpenRef.current = false;
    }
  }, [
    isOpen,
    initialDirection,
    initialPartyId,
    initialInvoiceId,
    initialAmount,
    initialNotes,
    initialMode,
    parties,
    generateUpiQr,
  ]);

  if (!isOpen) return null;

  const handleCollectAmountChange = (val: string) => {
    setCollectAmount(val);
    const num = parseFloat(val);
    if (splits.length === 1) {
      setSplits([{ ...splits[0], amount: val }]);
      if (splits[0].mode === 'UPI' && !isNaN(num) && num > 0 && modalDirection === 'COLLECT') {
        void generateUpiQr(num, collectNotes, selectedUpiAccountRef.current);
      } else {
        setUpiPreview(null);
      }
    }
  };

  const handleCreatePartyOnSpot = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = spotPartyPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setSpotPartyError('Mobile number must be strictly 10 digits');
      return;
    }

    setSpotPartyLoading(true);
    setSpotPartyError('');
    try {
      const newParty = await apiRequest<Party>('/parties', {
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
    } catch (err: unknown) {
      setSpotPartyError((err as Error).message || 'Failed to create party');
    } finally {
      setSpotPartyLoading(false);
    }
  };

  const handleSubmitCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const validSplits = splits.filter((s) => {
      const a = parseFloat(s.amount);
      return !isNaN(a) && a > 0;
    });
    const totalAmount = validSplits.reduce((acc, s) => acc + parseFloat(s.amount), 0);
    if (totalAmount <= 0) {
      setCollectError('Please enter a valid amount greater than ₹0');
      return;
    }
    if (!selectedPartyId && !selectedInvoiceId) {
      setCollectError('Please select a party or invoice');
      return;
    }

    setCollectSubmitting(true);
    setCollectError('');
    try {
      const targetParty = parties.find((p) => p.id === selectedPartyId);
      const defaultNote =
        modalDirection === 'PAY'
          ? `Payment of ₹${totalAmount.toFixed(2)} made to ${targetParty?.name || 'Party'}`
          : `Payment of ₹${totalAmount.toFixed(2)} received from ${targetParty?.name || 'Customer'}`;

      const primaryUtr = validSplits.find((s) => s.mode === 'UPI' && s.upiUtr)?.upiUtr || collectUtr.trim() || undefined;

      await apiRequest('/payments', {
        method: 'POST',
        body: JSON.stringify({
          invoiceId: selectedInvoiceId || undefined,
          partyId: selectedPartyId || undefined,
          amount: totalAmount,
          type: modalDirection === 'PAY' ? 'OUTFLOW' : 'INFLOW',
          mode: validSplits.length > 1 ? 'SPLIT' : validSplits[0]?.mode,
          upiUtr: primaryUtr,
          notes: collectNotes.trim() || defaultNote,
          autoConfirm: true,
          splits: validSplits.map((s) => ({
            mode: s.mode,
            amount: parseFloat(s.amount),
            upiUtr: s.upiUtr?.trim() || (s.mode === 'UPI' ? collectUtr.trim() || undefined : undefined),
            notes: s.notes?.trim() || undefined,
          })),
        }),
      });

      onClose();
      await onSuccess();
    } catch (err: unknown) {
      setCollectError((err as Error).message || 'Failed to record payment');
    } finally {
      setCollectSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-hidden animate-in fade-in">
      <div className="w-full max-w-lg rounded-[1.25rem] border border-border/70 bg-card/95 backdrop-blur-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-foreground">
        <div className="shrink-0 flex items-center justify-between border-b border-border/60 p-5">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              {modalDirection === 'PAY' ? (
                <>
                  <ArrowUpRight className="h-5 w-5 text-amber-500" />
                  Make Payment to Party (Disbursement)
                </>
              ) : (
                <>
                  <Banknote className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  Collect / Receive Payment
                </>
              )}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {modalDirection === 'PAY'
                ? 'Record outgoing payment made by store to settle vendor/party debt'
                : 'Enter spot amount, generate exact UPI QR or confirm cash'}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* CREATE PARTY ON THE SPOT TOGGLE */}
        {isCreatingPartyOnSpot ? (
          <form
            onSubmit={handleCreatePartyOnSpot}
            className="p-4 rounded-[0.875rem] border border-primary/30 bg-primary/5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <UserPlus className="h-4 w-4" />
                Create New Party On The Spot
              </span>
              <button
                type="button"
                onClick={() => setIsCreatingPartyOnSpot(false)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>

            <div>
              <input
                type="text"
                required
                placeholder="Party / Firm Name *"
                className="w-full rounded-[0.625rem] border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={spotPartyName}
                onChange={(e) => setSpotPartyName(e.target.value)}
              />
            </div>

            <div>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                required
                placeholder="Mobile Number (strictly 10 digits) *"
                className="w-full rounded-[0.625rem] border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                value={spotPartyPhone}
                onChange={(e) =>
                  setSpotPartyPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Address (optional)"
                className="w-full rounded-[0.625rem] border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={spotPartyAddress}
                onChange={(e) => setSpotPartyAddress(e.target.value)}
              />
              <input
                type="text"
                placeholder="GSTIN (optional)"
                className="w-full rounded-[0.625rem] border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring uppercase font-mono"
                value={spotPartyGstin}
                onChange={(e) => setSpotPartyGstin(e.target.value)}
              />
            </div>

            {spotPartyError && (
              <div className="text-[0.6875rem] text-destructive bg-destructive/10 p-2 rounded-[0.5rem] border border-destructive/20">
                {spotPartyError}
              </div>
            )}

            <Button
              type="submit"
              disabled={spotPartyLoading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs py-1.5 rounded-[0.625rem] active:scale-98"
            >
              {spotPartyLoading ? 'Creating Party...' : 'Save & Select Party'}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            {/* Party Selection with "+ New Party" option */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-foreground">
                  {modalDirection === 'PAY'
                    ? 'Select Party / Vendor to Pay *'
                    : 'Select Party / Customer *'}
                </label>
                <button
                  type="button"
                  onClick={() => setIsCreatingPartyOnSpot(true)}
                  className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Create New Party
                </button>
              </div>

              <ThemedSelect
                value={selectedPartyId}
                onChange={(val) => {
                  setSelectedPartyId(val);
                  setSelectedInvoiceId('');
                }}
                searchable
                searchPlaceholder="Search party by name or phone..."
                options={[
                  { value: '', label: '-- Choose Party --' },
                  ...parties.map((p) => ({
                    value: p.id,
                    label: p.name,
                    subLabel: p.phone,
                    badge: p.type,
                  })),
                ]}
                placeholder="-- Choose Party --"
              />
            </div>

            {/* Spot Amount Entry */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {modalDirection === 'PAY'
                  ? 'Amount to Pay Out (₹) *'
                  : 'Amount to Collect (₹) *'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 5000"
                  className="w-full rounded-[0.75rem] border border-input bg-background pl-8 pr-3 py-2.5 text-base font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                  value={collectAmount}
                  onChange={(e) => handleCollectAmountChange(e.target.value)}
                />
              </div>
              <span className="text-[0.6875rem] text-muted-foreground mt-1 block">
                {modalDirection === 'PAY'
                  ? 'Enter the exact disbursement amount paid to party from store funds.'
                  : 'Enter the exact amount collected. Custom partial amounts are fully supported.'}
              </span>
            </div>

            {/* Multi-Payment Split Selector */}
            <MultiPaymentSplitSelector
              totalAmount={parseFloat(collectAmount) || 0}
              splits={splits}
              onChange={(newSplits) => {
                setSplits(newSplits);
                const upiRow = newSplits.find((s) => s.mode === 'UPI');
                const upiVal = upiRow ? parseFloat(upiRow.amount) : 0;
                if (!isNaN(upiVal) && upiVal > 0 && modalDirection === 'COLLECT') {
                  void generateUpiQr(upiVal, collectNotes, selectedUpiAccountRef.current);
                } else {
                  setUpiPreview(null);
                }
              }}
              allowCredit={false}
              onPreviewUpi={(amt) => void generateUpiQr(amt, collectNotes, selectedUpiAccountRef.current)}
              previewUpiLoading={upiLoading}
            />

            {/* UPI QR Display if COLLECT and UPI mode is in splits */}
            {modalDirection === 'COLLECT' && splits.some((s) => s.mode === 'UPI') && (
              <div className="p-4 rounded-[0.875rem] border border-primary/20 bg-muted/30 text-center space-y-3">
                {upiAccounts.length > 0 && (
                  <div className="space-y-1.5 text-left mb-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[0.6875rem] font-semibold text-foreground uppercase tracking-wider">
                        Receive Into UPI Account:
                      </label>
                      <span className="text-[0.625rem] text-primary font-medium">
                        Select account
                      </span>
                    </div>
                    <ThemedSelect
                      value={selectedUpiAccount?.id || (upiAccounts.find((a) => a.isPrimary)?.id || upiAccounts[0]?.id || '')}
                      onChange={(val) => {
                        const acc = upiAccounts.find((a) => a.id === val) || null;
                        setSelectedUpiAccount(acc);
                        selectedUpiAccountRef.current = acc;
                        const upiRow = splits.find((s) => s.mode === 'UPI');
                        const num = upiRow ? parseFloat(upiRow.amount) : 0;
                        if (!isNaN(num) && num > 0) {
                          void generateUpiQr(num, collectNotes, acc);
                        }
                      }}
                      options={upiAccounts.map((acc) => ({
                        value: acc.id,
                        label: acc.upiId,
                        subLabel: acc.merchantName ? acc.merchantName : undefined,
                        badge: acc.isPrimary ? 'Default' : undefined,
                      }))}
                    />
                  </div>
                )}

                {upiAccounts.length === 0 && (
                  <div className="p-3 rounded-[0.625rem] border border-amber-500/20 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300 text-left">
                    No store UPI IDs configured by director yet. Please add a UPI ID in Director Settings.
                  </div>
                )}

                {upiLoading ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span>Generating exact-amount QR code...</span>
                  </div>
                ) : upiPreview?.qrDataUrl ? (
                  <div>
                    <div className="inline-block p-3 bg-white rounded-[1rem] shadow-md border border-border/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={upiPreview.qrDataUrl}
                        alt="UPI QR Code"
                        className="h-44 w-44 mx-auto"
                      />
                    </div>
                    <div className="mt-2 text-xs text-foreground font-semibold">
                      UPI Split Amount:{' '}
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                        ₹{upiPreview.amount.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-[0.6875rem] text-muted-foreground mt-0.5">
                      Target VPA:{' '}
                      <span className="font-mono text-foreground">
                        {upiPreview.vpa}
                      </span>
                    </div>
                    <p className="text-[0.6875rem] text-muted-foreground mt-0.5">
                      Customer scans with GPay, PhonePe, or Paytm • Exact amount locked
                    </p>
                  </div>
                ) : (
                  <div className="py-6 text-xs text-muted-foreground">
                    Enter an amount for the UPI split row above to generate the live QR code
                  </div>
                )}

                <div>
                  <input
                    type="text"
                    placeholder="UPI UTR / Transaction Ref (optional)"
                    className="w-full rounded-[0.625rem] border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                    value={collectUtr}
                    onChange={(e) => setCollectUtr(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Optional Notes */}
            <div>
              <input
                type="text"
                placeholder={
                  modalDirection === 'PAY'
                    ? 'Payment Notes (e.g. Cleared vendor invoice or advance repayment)'
                    : 'Transaction Notes (optional, e.g. Bill INV-2425-001 token)'
                }
                className="w-full rounded-[0.75rem] border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={collectNotes}
                onChange={(e) => setCollectNotes(e.target.value)}
              />
            </div>

            {collectError && (
              <div className="rounded-[0.5rem] bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
                {collectError}
              </div>
            )}

            {/* Submit Confirmation */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="text-muted-foreground text-xs"
              >
                Cancel
              </Button>
              {modalDirection === 'PAY' ? (
                <Button
                  type="button"
                  disabled={collectSubmitting}
                  onClick={handleSubmitCollectPayment}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs px-4 active:scale-98 shadow-sm"
                >
                  {collectSubmitting ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Disbursing...
                    </span>
                  ) : (
                    `Confirm Payment Made (Outflow) ₹${splits.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0).toFixed(2)}`
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={collectSubmitting}
                  onClick={handleSubmitCollectPayment}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-4 active:scale-98 shadow-sm"
                >
                  {collectSubmitting ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Settling...
                    </span>
                  ) : (
                    `Confirm Settlement Received ₹${splits.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0).toFixed(2)}`
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
