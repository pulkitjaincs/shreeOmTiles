import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/theme';
import { formatINR } from '@/lib/formatters';
import { mobileApiRequest } from '@/lib/api';
import { Warehouse, Product, Party } from './types';

interface ReturnInvoiceModalProps {
  invoice: any | null;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  warehouses?: Warehouse[];
  products?: Product[];
  parties?: Party[];
  onDownloadRefundPdf?: (refundId: string, refundNo: string) => Promise<void> | void;
  onDownloadPdf?: (id: string, invoiceNo: string) => Promise<void> | void;
}

type ReturnAllocation = { qty: number };

interface StandaloneItem {
  id: string;
  isCustom: boolean;
  productId?: string;
  customItemName?: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
}

export function ReturnInvoiceModal({
  invoice,
  visible,
  onClose,
  onSuccess,
  warehouses = [],
  products = [],
  parties = [],
  onDownloadRefundPdf,
  onDownloadPdf,
}: ReturnInvoiceModalProps) {
  const [activeTab, setActiveTab] = useState<'RECORDED' | 'STANDALONE'>('RECORDED');

  // Recorded Return State
  const [returnSearch, setReturnSearch] = useState('');
  const [activeInvoice, setActiveInvoice] = useState<any>(null);
  const [allocations, setAllocations] = useState<Record<string, ReturnAllocation>>({});
  const [returnMode, setReturnMode] = useState<'CASH' | 'UPI' | 'CARD' | 'CREDIT'>('CASH');
  const [returnReason, setReturnReason] = useState('Customer Return');
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<any>(null);

  // Standalone Return State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [standaloneReason, setStandaloneReason] = useState('Legacy / Standalone Return');
  const [standaloneMode, setStandaloneMode] = useState<'CASH' | 'UPI' | 'CARD' | 'CREDIT'>('CASH');
  const [standaloneItems, setStandaloneItems] = useState<StandaloneItem[]>([
    {
      id: 'item-1',
      isCustom: true,
      customItemName: 'Other Returned Goods',
      qty: 1,
      unitPrice: 0,
      taxRate: 18,
    },
  ]);

  const initializeAllocations = useCallback((found: any) => {
    const initial: Record<string, ReturnAllocation> = {};
    (found.items || []).forEach((item: any) => {
      initial[item.id] = { qty: 0 };
    });
    setAllocations(initial);
  }, []);

  const lookupInvoice = useCallback(
    async (query: string, seed?: any, preserveSuccess = false) => {
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
            // ignore
          }
        }
        const found = await mobileApiRequest<any>(
          `/invoices/lookup/${encodeURIComponent(lookup || seed.invoiceNo || seed.id)}`,
        );
        setActiveInvoice(found);
        setReturnSearch(found.invoiceNo || lookup);
        initializeAllocations(found);
      } catch (err: any) {
        if (seed?.items) {
          setActiveInvoice(seed);
          initializeAllocations(seed);
        } else {
          setActiveInvoice(null);
          setError(
            err.message ||
              'Invoice not found. Check the invoice number and try again.',
          );
        }
      } finally {
        setLoadingInvoice(false);
      }
    },
    [initializeAllocations],
  );

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
  }, [visible, invoice, lookupInvoice, initializeAllocations]);

  const estimated = useMemo(() => {
    if (!activeInvoice) return { subtotal: 0, tax: 0, total: 0 };
    const subtotal = (activeInvoice.items || []).reduce((sum: number, item: any) => {
      const qty = allocations[item.id]?.qty || 0;
      return sum + qty * Number(item.unitPrice || 0);
    }, 0);
    const rate = Number(
      activeInvoice.taxBreakup?.rate ??
        (Number(activeInvoice.subtotal) > 0
          ? (Number(activeInvoice.tax || 0) / Number(activeInvoice.subtotal)) * 100
          : 18),
    );
    const tax = (subtotal * (Number.isFinite(rate) ? rate : 18)) / 100;
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
      return [
        {
          productId: item.productId || item.product?.id,
          qty: allocation.qty,
          unitPrice: Number(item.unitPrice || 0),
        },
      ];
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
        isStandalone: false,
      });
      await onSuccess();
      await lookupInvoice(activeInvoice.invoiceNo || activeInvoice.id, undefined, true);
    } catch (err: any) {
      setError(err.message || 'Could not process customer return.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateStandaloneReturn = async () => {
    if (standaloneItems.length === 0) {
      setError('Please add at least 1 item to return.');
      return;
    }
    for (const it of standaloneItems) {
      if (!it.qty || it.qty <= 0) {
        setError('Item quantity must be greater than 0.');
        return;
      }
      if (it.unitPrice < 0) {
        setError('Unit price cannot be negative.');
        return;
      }
      if (it.isCustom && !it.customItemName?.trim()) {
        setError('Please provide a name for custom items.');
        return;
      }
    }

    setSubmitting(true);
    setError('');
    setSuccess(null);
    try {
      const payload = {
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        refundMode: standaloneMode,
        reason: standaloneReason.trim() || undefined,
        items: standaloneItems.map((it) => ({
          productId: it.isCustom ? undefined : it.productId,
          customItemName: it.isCustom ? it.customItemName : undefined,
          qty: it.qty,
          unitPrice: it.unitPrice,
          taxRate: it.taxRate,
        })),
      };

      const result = await mobileApiRequest<any>('/invoices/returns/standalone', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSuccess({
        id: result.refundInvoice?.id,
        refundNo: result.refundNo || result.refundInvoice?.refundNo,
        total: Number(result.totalRefund ?? result.refundInvoice?.total ?? 0),
        mode: result.refundMode || standaloneMode,
        invoiceId: result.refundInvoice?.id,
        invoiceNo: result.refundNo,
        isStandalone: true,
      });
      await onSuccess();
      setStandaloneItems([
        {
          id: `item-${Date.now()}`,
          isCustom: true,
          customItemName: 'Other Returned Goods',
          qty: 1,
          unitPrice: 0,
          taxRate: 18,
        },
      ]);
    } catch (err: any) {
      setError(err.message || 'Could not generate standalone credit note.');
    } finally {
      setSubmitting(false);
    }
  };

  const standaloneTotals = useMemo(() => {
    return standaloneItems.reduce(
      (acc, it) => {
        const sub = (it.qty || 0) * (it.unitPrice || 0);
        const tax = (sub * (it.taxRate || 0)) / 100;
        return { subtotal: acc.subtotal + sub, tax: acc.tax + tax, total: acc.total + sub + tax };
      },
      { subtotal: 0, tax: 0, total: 0 },
    );
  }, [standaloneItems]);

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
      title="Customer Return & Credit Note"
      subtitle="Process returns from recorded invoices or legacy bills"
    >
      <View>
        {/* Tab Switcher */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'RECORDED' && styles.tabBtnActive]}
            onPress={() => {
              setActiveTab('RECORDED');
              setError('');
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabBtnText, activeTab === 'RECORDED' && styles.tabBtnTextActive]}>
              From Invoice
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'STANDALONE' && styles.tabBtnActive]}
            onPress={() => {
              setActiveTab('STANDALONE');
              setError('');
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabBtnText, activeTab === 'STANDALONE' && styles.tabBtnTextActive]}>
              Standalone / Legacy Bill
            </Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {success ? (
          <Card style={styles.successCard}>
            <Text style={styles.successTitle}>Credit note #{success.refundNo} created</Text>
            <Text style={styles.successText}>
              {formatINR(success.total)} refunded via {success.mode}. Catalog items restocked immediately. (Never pushed to delivery)
            </Text>
            {onDownloadRefundPdf ? (
              <Button
                title={downloadingPdf ? 'Downloading PDF...' : 'Download Credit Note PDF'}
                icon="document-text-outline"
                variant="primary"
                loading={downloadingPdf}
                disabled={downloadingPdf}
                onPress={async () => {
                  setDownloadingPdf(true);
                  try {
                    await onDownloadRefundPdf(success.id, success.refundNo);
                  } finally {
                    setDownloadingPdf(false);
                  }
                }}
                style={{ marginTop: 10 }}
              />
            ) : null}
          </Card>
        ) : null}

        {activeTab === 'RECORDED' ? (
          <View>
            <View style={styles.lookupRow}>
              <View style={styles.lookupInput}>
                <Input
                  label="Invoice Number"
                  placeholder="e.g. INV-2425-0012"
                  value={returnSearch}
                  onChangeText={setReturnSearch}
                  autoCapitalize="characters"
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

            {activeInvoice ? (
              <View style={styles.section}>
                <Card style={styles.invoiceMetaCard}>
                  <Text style={styles.invoiceNumber}>#{activeInvoice.invoiceNo}</Text>
                  <Text style={styles.partyText}>
                    {activeInvoice.party?.name || (activeInvoice.isCashSale ? 'Cash Sale' : 'Walk-in Customer')}
                  </Text>
                  <Text style={styles.totalText}>Original Total: {formatINR(activeInvoice.total)}</Text>
                </Card>

                <Text style={styles.sectionTitle}>Select Quantities to Return</Text>
                {(activeInvoice.items || []).map((item: any) => {
                  const alloc = allocations[item.id] || { qty: 0 };
                  const maxReturnable =
                    item.remainingReturnable !== undefined ? item.remainingReturnable : item.qty;

                  return (
                    <Card key={item.id} style={styles.itemCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>
                          {item.product?.name || item.customItemName || 'Item'}
                        </Text>
                        <Text style={styles.itemMeta}>
                          Sold: {item.qty} · Available to Return: {maxReturnable} · Rate: {formatINR(item.unitPrice)}
                        </Text>
                      </View>
                      <View style={styles.qtyControl}>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => updateAllocation(item.id, { qty: Math.max(0, alloc.qty - 1) })}
                        >
                          <Ionicons name="remove" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{alloc.qty}</Text>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() =>
                            updateAllocation(item.id, { qty: Math.min(maxReturnable, alloc.qty + 1) })
                          }
                        >
                          <Ionicons name="add" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </Card>
                  );
                })}

                <Card style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Estimated Refund Value</Text>
                    <Text style={styles.summaryVal}>{formatINR(estimated.total)}</Text>
                  </View>
                </Card>

                <Text style={styles.sectionTitle}>Refund Payout Method</Text>
                <View style={styles.modeRow}>
                  {(['CASH', 'UPI', 'CARD', 'CREDIT'] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.modeBtn, returnMode === m && styles.modeBtnActive]}
                      onPress={() => setReturnMode(m)}
                    >
                      <Text style={[styles.modeBtnText, returnMode === m && styles.modeBtnTextActive]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Input
                  label="Reason / Notes"
                  placeholder="e.g. Broken tiles, customer exchange"
                  value={returnReason}
                  onChangeText={setReturnReason}
                />

                <Button
                  title={submitting ? 'Processing Return...' : 'Accept Return & Restock Items'}
                  onPress={handleCreateReturn}
                  loading={submitting}
                  disabled={submitting || estimated.total <= 0}
                  style={{ marginTop: 16 }}
                />
              </View>
            ) : null}
          </View>
        ) : (
          /* Standalone Return Form */
          <View style={styles.section}>
            <View style={styles.standaloneBanner}>
              <Text style={styles.standaloneBannerText}>
                Create standalone credit notes for legacy paper bills or non-catalog goods. Items are credited directly and restocked without delivery queuing.
              </Text>
            </View>

            <Input
              label="Customer Name (Optional)"
              placeholder="e.g. Rajesh Sharma"
              value={customerName}
              onChangeText={setCustomerName}
            />

            <Input
              label="Customer Phone (Optional)"
              placeholder="e.g. 9876543210"
              value={customerPhone}
              onChangeText={setCustomerPhone}
              keyboardType="phone-pad"
            />

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Items to Return</Text>
              <TouchableOpacity
                style={styles.addItemBtn}
                onPress={() =>
                  setStandaloneItems((prev) => [
                    ...prev,
                    {
                      id: `item-${Date.now()}`,
                      isCustom: true,
                      customItemName: 'Other Returned Goods',
                      qty: 1,
                      unitPrice: 0,
                      taxRate: 18,
                    },
                  ])
                }
              >
                <Ionicons name="add" size={14} color="#38BDF8" />
                <Text style={styles.addItemBtnText}>Add Item</Text>
              </TouchableOpacity>
            </View>

            {standaloneItems.map((it, idx) => (
              <Card key={it.id} style={styles.standaloneItemCard}>
                <View style={styles.standaloneItemHeader}>
                  <Text style={styles.standaloneItemIdx}>Item #{idx + 1}</Text>
                  {standaloneItems.length > 1 ? (
                    <TouchableOpacity
                      onPress={() =>
                        setStandaloneItems((prev) => prev.filter((item) => item.id !== it.id))
                      }
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <Input
                  label="Description / Goods Name"
                  placeholder="e.g. Mosaic Wall Tiles"
                  value={it.customItemName}
                  onChangeText={(val) =>
                    setStandaloneItems((prev) =>
                      prev.map((item) => (item.id === it.id ? { ...item, customItemName: val } : item)),
                    )
                  }
                />

                <View style={styles.rowInputs}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Qty"
                      placeholder="1"
                      value={String(it.qty)}
                      onChangeText={(val) =>
                        setStandaloneItems((prev) =>
                          prev.map((item) =>
                            item.id === it.id ? { ...item, qty: Math.max(1, parseInt(val, 10) || 1) } : item,
                          ),
                        )
                      }
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Rate (₹)"
                      placeholder="0"
                      value={String(it.unitPrice)}
                      onChangeText={(val) =>
                        setStandaloneItems((prev) =>
                          prev.map((item) =>
                            item.id === it.id ? { ...item, unitPrice: parseFloat(val) || 0 } : item,
                          ),
                        )
                      }
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </Card>
            ))}

            <Card style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Refund Amount</Text>
                <Text style={styles.summaryVal}>{formatINR(standaloneTotals.total)}</Text>
              </View>
            </Card>

            <Text style={styles.sectionTitle}>Refund Payout Mode</Text>
            <View style={styles.modeRow}>
              {(['CASH', 'UPI', 'CARD', 'CREDIT'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modeBtn, standaloneMode === m && styles.modeBtnActive]}
                  onPress={() => setStandaloneMode(m)}
                >
                  <Text style={[styles.modeBtnText, standaloneMode === m && styles.modeBtnTextActive]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Reason / Notes"
              placeholder="e.g. Legacy ledger adjustment"
              value={standaloneReason}
              onChangeText={setStandaloneReason}
            />

            <Button
              title={submitting ? 'Generating...' : 'Generate Standalone Credit Note'}
              onPress={handleCreateStandaloneReturn}
              loading={submitting}
              disabled={submitting || standaloneTotals.total <= 0}
              style={{ marginTop: 16 }}
            />
          </View>
        )}
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    padding: 3,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  tabBtnTextActive: {
    color: '#09090B',
  },
  lookupRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 12,
  },
  lookupInput: { flex: 1 },
  findButton: { minWidth: 84 },
  section: { marginTop: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  addItemBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginBottom: 8,
  },
  successCard: {
    padding: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    marginBottom: 12,
  },
  successTitle: {
    color: '#10B981',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
  },
  successText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  invoiceMetaCard: {
    padding: 12,
    marginBottom: 10,
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  partyText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  totalText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
    marginTop: 4,
  },
  itemCard: {
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  itemMeta: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    padding: 4,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 6,
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    minWidth: 20,
    textAlign: 'center',
  },
  summaryCard: {
    padding: 12,
    marginTop: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  summaryVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#38BDF8',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  modeBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  modeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  modeBtnTextActive: {
    color: '#09090B',
  },
  standaloneBanner: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    marginBottom: 12,
  },
  standaloneBannerText: {
    fontSize: 11,
    color: '#F59E0B',
    lineHeight: 16,
  },
  standaloneItemCard: {
    padding: 12,
    marginBottom: 10,
  },
  standaloneItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  standaloneItemIdx: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 10,
  },
});
