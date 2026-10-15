import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/theme';
import { mobileApiRequest } from '@/lib/api';

interface ReturnInvoiceModalProps {
  invoice: any | null;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReturnInvoiceModal({
  invoice,
  visible,
  onClose,
  onSuccess,
}: ReturnInvoiceModalProps) {
  const [returnItems, setReturnItems] = useState<{ invoiceItemId: string; qty: number }[]>([]);
  const [returnMode, setReturnMode] = useState<'CASH' | 'UPI' | 'CREDIT'>('CASH');
  const [returnReason, setReturnReason] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  useEffect(() => {
    if (visible && invoice) {
      setReturnItems(
        (invoice.items || []).map((it: any) => ({
          invoiceItemId: it.id,
          qty: 0,
        })),
      );
      setReturnMode('CASH');
      setReturnReason('');
    }
  }, [visible, invoice]);

  if (!invoice) return null;

  const handleCreateReturn = async () => {
    const validItems = returnItems.filter((it) => it.qty > 0);
    if (validItems.length === 0) {
      Alert.alert('No Items Selected', 'Please set at least one item return quantity greater than 0');
      return;
    }

    setSubmittingReturn(true);
    try {
      await mobileApiRequest(`/invoices/${invoice.id}/return`, {
        method: 'POST',
        body: JSON.stringify({
          mode: returnMode,
          reason: returnReason.trim() || undefined,
          items: validItems,
        }),
      });

      Alert.alert('Return Processed', 'Credit note generated and inventory has been restocked!');
      onClose();
      onSuccess();
    } catch (err: any) {
      Alert.alert('Return Failed', err.message || 'Could not process customer return');
    } finally {
      setSubmittingReturn(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Create Credit Note / Return"
      subtitle={`Return goods from Invoice #${invoice.invoiceNo}`}
    >
      <View>
        <Text style={styles.fieldLabel}>Select Items to Return</Text>
        {(invoice.items || []).map((it: any) => {
          const currentReturn = returnItems.find((r) => r.invoiceItemId === it.id);
          const returnQty = currentReturn?.qty || 0;
          return (
            <Card key={it.id} style={styles.returnItemCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.itemDetailName}>{it.product?.name || 'Product'}</Text>
                <Text style={styles.itemDetailSub}>Sold: {it.qty} units</Text>
              </View>
              <View style={styles.stepperRow}>
                <Text style={styles.stepperLabel}>Qty to Return:</Text>
                <View style={styles.stepperBox}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => {
                      setReturnItems((prev) =>
                        prev.map((r) =>
                          r.invoiceItemId === it.id
                            ? { ...r, qty: Math.max(0, r.qty - 1) }
                            : r,
                        ),
                      );
                    }}
                  >
                    <Text style={styles.stepBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepValue}>{returnQty}</Text>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => {
                      setReturnItems((prev) =>
                        prev.map((r) =>
                          r.invoiceItemId === it.id
                            ? { ...r, qty: Math.min(it.qty, r.qty + 1) }
                            : r,
                        ),
                      );
                    }}
                  >
                    <Text style={styles.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          );
        })}

        <Text style={styles.fieldLabel}>Refund Mode</Text>
        <View style={styles.tabToggle}>
          {(['CASH', 'UPI', 'CREDIT'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.toggleBtn, returnMode === m && styles.toggleBtnActive]}
              onPress={() => setReturnMode(m)}
            >
              <Text style={[styles.toggleText, returnMode === m && styles.toggleTextActive]}>
                {m === 'CREDIT' ? 'Credit Ledger' : m}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Input
          label="Return Reason"
          placeholder="e.g. Excess boxes, design change, breakage"
          value={returnReason}
          onChangeText={setReturnReason}
        />

        <Button
          title={submittingReturn ? 'Processing...' : 'Confirm Return & Restock'}
          onPress={handleCreateReturn}
          loading={submittingReturn}
          variant="primary"
          size="lg"
          style={{ marginTop: 12 }}
        />
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    marginBottom: 6,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  returnItemCard: {
    padding: 12,
    marginBottom: 8,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemDetailName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.text,
    flex: 1,
  },
  itemDetailSub: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  stepperLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  stepBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  stepBtnText: {
    fontSize: 18,
    color: Colors.dark.text,
    fontWeight: 'bold',
  },
  stepValue: {
    fontSize: 14,
    color: Colors.dark.text,
    fontWeight: 'bold',
    minWidth: 24,
    textAlign: 'center',
  },
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 2,
    marginBottom: 10,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: Colors.dark.primary,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
});
