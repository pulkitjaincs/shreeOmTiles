import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Colors } from '@/constants/theme';
import { formatINR, formatDate } from '@/lib/formatters';
import { mobileApiRequest } from '@/lib/api';
import { downloadAndSharePdf } from '@/lib/pdf';
import { Warehouse } from './types';

interface ReturnInvoiceModalProps {
  invoice: any | null;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  warehouses?: Warehouse[];
  onDownloadRefundPdf?: (refundId: string, refundNo: string) => Promise<void> | void;
  onDownloadPdf?: (id: string, invoiceNo: string) => Promise<void> | void;
}

type ReturnAllocation = { qty: number; warehouseId?: string; batchNo?: string };

export function ReturnInvoiceModal({
  invoice,
  visible,
  onClose,
  onSuccess,
  warehouses,
  onDownloadRefundPdf,
  onDownloadPdf,
}: ReturnInvoiceModalProps) {
  const [returnSearch, setReturnSearch] = useState('');
  const [activeInvoice, setActiveInvoice] = useState<any>(null);
  const [allocations, setAllocations] = useState<Record<string, ReturnAllocation>>({});
  const [returnMode, setReturnMode] = useState<'CASH' | 'UPI' | 'CREDIT'>('CASH');
  const [returnReason, setReturnReason] = useState('Customer Return');
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<any>(null);

  const initializeAllocations = (found: any) => {
    const initial: Record<string, ReturnAllocation> = {};
    (found.items || []).forEach((item: any) => {
      initial[item.id] = {
        qty: 0,
        warehouseId: item.warehouseId || item.warehouse?.id || undefined,
        batchNo: item.batchNo || undefined,
      };
    });
    setAllocations(initial);
  };

  const lookupInvoice = async (query: string, seed?: any, preserveSuccess = false) => {
    const trimmed = query.trim();
    if (!trimmed && !seed?.id) return;
    setLoadingInvoice(true);
    setError('');
    if (!preserveSuccess) setSuccess(null);
    try {
      let lookup = trimmed;
      if (lookup.startsWith('{')) {
        try {
          const parsed = JSON.parse(lookup);
          lookup = String(parsed.inv || parsed.id || lookup);
        } catch {
          // Treat malformed scanner content as a normal invoice number.
        }
      }
      const found = await mobileApiRequest<any>(`/invoices/lookup/${encodeURIComponent(lookup || seed.invoiceNo || seed.id)}`);
      setActiveInvoice(found);
      setReturnSearch(found.invoiceNo || lookup);
      initializeAllocations(found);
    } catch (err: any) {
      if (seed?.items) {
        setActiveInvoice(seed);
        initializeAllocations(seed);
      } else {
        setActiveInvoice(null);
        setError(err.message || 'Invoice not found. Check the invoice number and try again.');
      }
    } finally {
      setLoadingInvoice(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    setError('');
    setSuccess(null);
    setReturnMode('CASH');
    setReturnReason('Customer Return');
    if (invoice?.lookupOnly) {
      setActiveInvoice(null);
      setReturnSearch('');
      setAllocations({});
    } else if (invoice) {
      setActiveInvoice(invoice);
      setReturnSearch(invoice.invoiceNo || '');
      initializeAllocations(invoice);
      void lookupInvoice(invoice.invoiceNo || invoice.id, invoice);
    }
    // Initialize once when the sheet opens; changing a fetched invoice must not reset user edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, invoice]);

  const estimated = useMemo(() => {
    if (!activeInvoice) return { subtotal: 0, tax: 0, total: 0 };
    const subtotal = (activeInvoice.items || []).reduce((sum: number, item: any) => {
      const qty = allocations[item.id]?.qty || 0;
      return sum + qty * Number(item.unitPrice || 0);
    }, 0);
    const rate = Number(activeInvoice.taxBreakup?.rate ?? (Number(activeInvoice.subtotal) > 0
      ? Number(activeInvoice.tax || 0) / Number(activeInvoice.subtotal) * 100
      : 18));
    const tax = subtotal * (Number.isFinite(rate) ? rate : 18) / 100;
    return { subtotal, tax, total: subtotal + tax };
  }, [activeInvoice, allocations]);

  const updateAllocation = (itemId: string, patch: Partial<ReturnAllocation>) => {
    setAllocations((current) => ({
      ...current,
      [itemId]: { ...current[itemId], ...patch },
    }));
  };

  const handleCreateReturn = async () => {
    if (!activeInvoice || loadingInvoice || submitting) return;
    const itemsToReturn = (activeInvoice.items || []).flatMap((item: any) => {
      const allocation = allocations[item.id];
      if (!allocation?.qty) return [];
      return [{
        productId: item.productId || item.product?.id,
        warehouseId: allocation.warehouseId || undefined,
        batchNo: allocation.batchNo || item.batchNo || undefined,
        qty: allocation.qty,
        unitPrice: Number(item.unitPrice || 0),
      }];
    });
    if (itemsToReturn.length === 0) {
      setError('Please enter a return quantity for at least one item.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess(null);
    try {
      const result = await mobileApiRequest<any>(`/invoices/${activeInvoice.id}/return`, {
        method: 'POST',
        body: JSON.stringify({
          refundMode: returnMode,
          reason: returnReason.trim() || undefined,
          items: itemsToReturn,
        }),
      });
      setSuccess({
        id: result.refundInvoice?.id,
        refundNo: result.refundNo || result.refundInvoice?.refundNo,
        total: Number(result.totalRefund ?? result.refundInvoice?.total ?? estimated.total),
        mode: result.refundMode || returnMode,
        invoiceId: activeInvoice.id,
        invoiceNo: activeInvoice.invoiceNo || result.invoiceNo,
      });
      await onSuccess();
      await lookupInvoice(activeInvoice.invoiceNo || activeInvoice.id, undefined, true);
    } catch (err: any) {
      setError(err.message || 'Could not process customer return.');
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    setActiveInvoice(null);
    setReturnSearch('');
    setAllocations({});
    setError('');
    setSuccess(null);
    onClose();
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={close}
      title="Process Customer Return"
      subtitle="Find an invoice, choose return quantities and restock locations"
    >
      <View>
        <View style={styles.lookupRow}>
          <View style={styles.lookupInput}>
            <Input
              label="Invoice Number or Scanned QR Content"
              placeholder="e.g. INV-2425-0012"
              value={returnSearch}
              onChangeText={setReturnSearch}
              autoCapitalize="none"
            />
          </View>
          <Button
            title={loadingInvoice ? 'Finding…' : 'Find'}
            size="sm"
            loading={loadingInvoice}
            disabled={loadingInvoice || !returnSearch.trim()}
            onPress={() => void lookupInvoice(returnSearch)}
            style={styles.findButton}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {success ? (
          <Card style={styles.successCard}>
            <Text style={styles.successTitle}>Credit note {success.refundNo ? `#${success.refundNo}` : 'created'}</Text>
            <Text style={styles.successText}>{formatINR(success.total)} refunded via {success.mode}. Parent invoice updated.</Text>
            {(success.invoiceId || activeInvoice?.id) ? (
              <Button
                title={downloadingPdf ? 'Downloading PDF...' : 'Download Updated Invoice PDF'}
                icon="document-text-outline"
                variant="primary"
                loading={downloadingPdf}
                disabled={downloadingPdf}
                onPress={async () => {
                  try {
                    setDownloadingPdf(true);
                    const invId = success.invoiceId || activeInvoice?.id;
                    const invNo = success.invoiceNo || activeInvoice?.invoiceNo || `Invoice_${invId}`;
                    if (onDownloadPdf) {
                      await onDownloadPdf(invId, invNo);
                    } else {
                      await downloadAndSharePdf(`invoices/${invId}/pdf`, invNo);
                    }
                  } finally {
                    setDownloadingPdf(false);
                  }
                }}
                style={{ marginTop: 10 }}
              />
            ) : null}
          </Card>
        ) : null}

        {activeInvoice ? (
          <View>
            <Card style={styles.invoiceCard}>
              <View style={styles.invoiceSummary}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invoiceNo}>#{activeInvoice.invoiceNo}</Text>
                  <Text style={styles.subText} numberOfLines={2}>
                    {activeInvoice.party?.name || 'Walk-in Customer'}{activeInvoice.party?.phone ? ` • ${activeInvoice.party.phone}` : ''}
                  </Text>
                  <Text style={styles.subText}>{formatDate(activeInvoice.createdAt)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.subText}>Original total</Text>
                  <Text style={styles.originalTotal}>{formatINR(activeInvoice.total)}</Text>
                </View>
              </View>
            </Card>

            <Text style={styles.sectionTitle}>Items to return</Text>
            {(activeInvoice.items || []).map((item: any) => {
              const allocation = allocations[item.id] || { qty: 0 };
              const maxReturnable = Number(item.remainingReturnable ?? item.qty ?? 0);
              const unit = item.product?.unit || 'units';
              return (
                <Card key={item.id} style={styles.itemCard}>
                  <Text style={styles.itemName}>{item.product?.name || 'Product'}</Text>
                  <Text style={styles.subText}>
                    Purchased {item.qty} {unit} · Returned {item.returnedQty || 0} · Available {maxReturnable} · Rate {formatINR(item.unitPrice)}
                  </Text>
                  {maxReturnable <= 0 ? (
                    <Text style={styles.fullyReturned}>Fully returned</Text>
                  ) : (
                    <>
                      <Input
                        label={`Return quantity (max ${maxReturnable})`}
                        placeholder="0"
                        value={allocation.qty ? String(allocation.qty) : ''}
                        keyboardType="numeric"
                        onChangeText={(value) => updateAllocation(item.id, {
                          qty: Math.max(0, Math.min(maxReturnable, Number.parseFloat(value) || 0)),
                        })}
                      />
                      <Text style={styles.lineRefund}>Line refund: {formatINR(allocation.qty * Number(item.unitPrice || 0))}</Text>
                    </>
                  )}
                </Card>
              );
            })}

            <Card elevated style={styles.refundSummary}>
              <Text style={styles.sectionTitle}>Estimated refund</Text>
              <View style={styles.summaryRow}><Text style={styles.subText}>Items subtotal</Text><Text style={styles.summaryValue}>{formatINR(estimated.subtotal)}</Text></View>
              <View style={styles.summaryRow}><Text style={styles.subText}>GST reversal</Text><Text style={styles.summaryValue}>{formatINR(estimated.tax)}</Text></View>
              <View style={[styles.summaryRow, styles.totalRow]}><Text style={styles.totalLabel}>Total refund</Text><Text style={styles.totalValue}>{formatINR(estimated.total)}</Text></View>
            </Card>

            <Text style={styles.sectionTitle}>Refund settlement</Text>
            <View style={styles.modeRow}>
              {(['CASH', 'UPI', 'CREDIT'] as const).map((mode) => {
                const isSelected = returnMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.modeButton, isSelected && styles.modeButtonActive]}
                    onPress={() => setReturnMode(mode)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={
                        mode === 'CASH'
                          ? 'cash-outline'
                          : mode === 'UPI'
                          ? 'qr-code-outline'
                          : 'card-outline'
                      }
                      size={14}
                      color={isSelected ? '#09090B' : Colors.dark.textSecondary}
                    />
                    <Text style={[styles.modeText, isSelected && styles.modeTextActive]}>
                      {mode === 'CREDIT' ? 'Store Credit' : mode}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Input label="Reason for Return (Optional)" placeholder="e.g. Unopened boxes or design change" value={returnReason} onChangeText={setReturnReason} />
            <Button
              title={submitting ? 'Processing return…' : `Confirm Return · ${formatINR(estimated.total)}`}
              icon="checkmark-circle-outline"
              loading={submitting || loadingInvoice}
              disabled={submitting || loadingInvoice || estimated.total <= 0}
              onPress={handleCreateReturn}
              size="lg"
              style={{ marginTop: 8, backgroundColor: '#D97706' }}
            />
          </View>
        ) : loadingInvoice ? (
          <View style={styles.loadingRow}><ActivityIndicator color="#FFFFFF" /><Text style={styles.subText}>Loading invoice and return history…</Text></View>
        ) : null}
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  lookupRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  lookupInput: { flex: 1 },
  findButton: { marginBottom: 14, minWidth: 70 },
  errorText: { color: '#F87171', fontSize: 12, marginBottom: 10 },
  successCard: { padding: 12, borderColor: 'rgba(16,185,129,0.35)', marginBottom: 12 },
  successTitle: { color: '#34D399', fontWeight: '800', fontSize: 14 },
  successText: { color: Colors.dark.textSecondary, fontSize: 12, marginTop: 3 },
  invoiceCard: { padding: 12, marginBottom: 8 },
  invoiceSummary: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  invoiceNo: { color: Colors.dark.text, fontSize: 15, fontWeight: '900' },
  originalTotal: { color: '#34D399', fontSize: 15, fontWeight: '900' },
  subText: { color: Colors.dark.textSecondary, fontSize: 11, marginTop: 3 },
  sectionTitle: { color: Colors.dark.text, fontWeight: '800', fontSize: 13, marginTop: 12, marginBottom: 7 },
  itemCard: { padding: 12, marginBottom: 8 },
  itemName: { color: Colors.dark.text, fontWeight: '800', fontSize: 13 },
  fullyReturned: { color: Colors.dark.textTertiary, fontSize: 12, marginTop: 10 },
  lineRefund: { color: Colors.dark.textSecondary, fontSize: 11, textAlign: 'right', marginTop: -7, marginBottom: 6 },
  refundSummary: { padding: 12, backgroundColor: Colors.dark.card },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 3 },
  summaryValue: { color: Colors.dark.text, fontSize: 12, fontWeight: '600' },
  totalRow: { borderTopWidth: 1, borderColor: Colors.dark.border, paddingTop: 9, marginTop: 7 },
  totalLabel: { color: Colors.dark.text, fontSize: 14, fontWeight: '800' },
  totalValue: { color: '#34D399', fontSize: 16, fontWeight: '900' },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modeButton: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.card,
  },
  modeButtonActive: {
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 2,
  },
  modeText: { color: Colors.dark.textSecondary, fontSize: 11.5, fontWeight: '700' },
  modeTextActive: { color: '#09090B', fontWeight: '800' },
  loadingRow: { padding: 24, alignItems: 'center', gap: 10 },
});
