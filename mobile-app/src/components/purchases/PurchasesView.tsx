import React, { useState, useEffect, useCallback, useMemo, useDeferredValue } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SearchBar } from '@/components/ui/SearchBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Colors } from '@/constants/theme';
import { invalidateMobileApiCache, cachedMobileApiRequest } from '@/lib/api';
import { formatINR, formatDate } from '@/lib/formatters';
import { useAuth } from '@/lib/auth-context';
import { Warehouse } from '@/components/stock/types';
import { Party } from '@/components/parties/types';
import { CreatePurchaseModal } from './CreatePurchaseModal';

export interface PurchasesViewProps {
  onRefreshStock?: () => Promise<any> | void;
  warehouses?: Warehouse[];
  parties?: Party[];
}

function getPurchasePaidAmount(p: any): number {
  if (p.amountPaid !== undefined && p.amountPaid !== null) {
    return Number(p.amountPaid);
  }
  if (Array.isArray(p.payments) && p.payments.length > 0) {
    return p.payments.reduce((sum: number, pay: any) => sum + Number(pay.amount || 0), 0);
  }
  if (p.paymentMode === 'CASH' || p.paymentMode === 'BANK_TRANSFER' || p.paymentMode === 'UPI') {
    const hasUnpaidCredit =
      Array.isArray(p.creditLedgers) &&
      p.creditLedgers.some((c: any) => c.status !== 'SETTLED');
    if (!hasUnpaidCredit && (!p.creditLedgers || p.creditLedgers.length === 0)) {
      return Number(p.total || 0);
    }
  }
  return 0;
}

function getPurchaseDueAmount(p: any): number {
  if (Array.isArray(p.creditLedgers) && p.creditLedgers.length > 0) {
    return p.creditLedgers.reduce(
      (sum: number, c: any) => (c.status !== 'SETTLED' ? sum + Number(c.amountDue || 0) : sum),
      0,
    );
  }
  const paid = getPurchasePaidAmount(p);
  return Math.max(0, Number(p.total || 0) - paid);
}

function getPurchaseStatus(p: any): string {
  if (p.paymentStatus) return p.paymentStatus;
  const due = getPurchaseDueAmount(p);
  const paid = getPurchasePaidAmount(p);
  const total = Number(p.total || 0);
  if (due <= 0.01 && (paid >= total || total === 0)) return 'PAID';
  if (paid > 0.01) return 'PARTIAL';
  return 'UNPAID';
}

export function PurchasesView({
  onRefreshStock,
  warehouses,
  parties,
}: PurchasesViewProps = {}) {
  const { user } = useAuth();
  const isSupervisor = user?.role === 'SUPERVISOR';
  const isDirectorOrAdmin = user?.role === 'OWNER' || (user?.role as any) === 'DIRECTOR' || user?.role === 'ADMIN';
  const isAccountant = user?.role === 'ACCOUNTANT';
  const canRecordPurchase = isDirectorOrAdmin || isAccountant;

  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const loadPurchases = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const res = await cachedMobileApiRequest<any[]>('/purchases', {
        forceRefresh: force,
        onRevalidate: (fresh) => {
          const list = Array.isArray(fresh) ? fresh : (fresh as any)?.data || [];
          setPurchases(list);
        },
      });
      const list = Array.isArray(res) ? res : (res as any)?.data || [];
      setPurchases(list);
    } catch (err: any) {
      console.warn('Purchases load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  const handlePurchaseSuccess = async () => {
    await invalidateMobileApiCache('/stock');
    await invalidateMobileApiCache('/purchases');
    await invalidateMobileApiCache('/parties');
    await invalidateMobileApiCache('/warehouses');
    await loadPurchases(true);
    try {
      await cachedMobileApiRequest('/stock', { forceRefresh: true });
    } catch {
      // ignore
    }
    if (onRefreshStock) {
      try {
        await onRefreshStock();
      } catch (err) {
        console.warn('PurchasesView onRefreshStock error:', err);
      }
    }
  };


  const deferredSearch = useDeferredValue(search);

  const filteredPurchases = useMemo(() => {
    if (!deferredSearch.trim()) return purchases;
    const q = deferredSearch.toLowerCase().trim();
    return purchases.filter(
      (item) =>
        item.purchaseNo?.toLowerCase().includes(q) ||
        item.vendorBillNo?.toLowerCase().includes(q) ||
        item.supplierInvoiceNo?.toLowerCase().includes(q) ||
        item.party?.name?.toLowerCase().includes(q) ||
        item.party?.phone?.includes(q),
    );
  }, [purchases, deferredSearch]);

  const totalBilled = useMemo(
    () => purchases.reduce((sum, p) => sum + Number(p.total || 0), 0),
    [purchases],
  );
  const totalPaid = useMemo(
    () => purchases.reduce((sum, p) => sum + getPurchasePaidAmount(p), 0),
    [purchases],
  );
  const totalPayable = useMemo(
    () => purchases.reduce((sum, p) => sum + getPurchaseDueAmount(p), 0),
    [purchases],
  );

  return (
    <View style={styles.container}>
      {/* Header Bar with "+ Record Purchase" and sync refresh button */}
      <View style={styles.headerBar}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Inward Purchases</Text>
          <Text style={styles.headerSubtitle}>
            {purchases.length} {purchases.length === 1 ? 'purchase order' : 'purchase orders'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Button
            title=""
            icon="refresh-outline"
            variant="ghost"
            size="sm"
            onPress={() => loadPurchases(true)}
            style={{ width: 38, height: 38, paddingHorizontal: 0, justifyContent: 'center', alignItems: 'center' }}
          />
          {canRecordPurchase && (
            <Button
              title="+ Record Purchase"
              icon="add-circle-outline"
              variant="primary"
              size="sm"
              onPress={() => setCreateModalOpen(true)}
              style={styles.recordBtn}
            />
          )}
        </View>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiGrid}>
        {!isSupervisor ? (
          <>
            <Card style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total Purchases</Text>
              <Text style={styles.kpiValue}>{formatINR(totalBilled)}</Text>
              <Text style={styles.kpiSub}>{purchases.length} inward POs</Text>
            </Card>

            <Card style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Amount Paid</Text>
              <Text style={[styles.kpiValue, { color: '#10B981' }]}>{formatINR(totalPaid)}</Text>
              <Text style={styles.kpiSub}>Supplier payments</Text>
            </Card>

            <Card style={[styles.kpiCard, totalPayable > 0 ? styles.kpiDueCard : null]}>
              <Text style={styles.kpiLabel}>Payable Dues</Text>
              <Text
                style={[
                  styles.kpiValue,
                  { color: totalPayable > 0 ? '#EF4444' : '#10B981' },
                ]}
              >
                {formatINR(totalPayable)}
              </Text>
              <Text style={styles.kpiSub}>To be disbursed</Text>
            </Card>
          </>
        ) : (
          <>
            <Card style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Inward POs</Text>
              <Text style={[styles.kpiValue, { color: '#A855F7' }]}>{purchases.length}</Text>
              <Text style={styles.kpiSub}>Total shipments</Text>
            </Card>
            <Card style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Line Items</Text>
              <Text style={[styles.kpiValue, { color: '#38BDF8' }]}>
                {purchases.reduce((sum, p) => sum + (p.items?.length || 0), 0)}
              </Text>
              <Text style={styles.kpiSub}>Stock entries</Text>
            </Card>
            <Card style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Suppliers</Text>
              <Text style={[styles.kpiValue, { color: '#10B981' }]}>
                {new Set(purchases.map((p) => p.partyId).filter(Boolean)).size}
              </Text>
              <Text style={styles.kpiSub}>Active vendors</Text>
            </Card>
          </>
        )}
      </View>

      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search purchases or suppliers..."
      />

      <View style={styles.scrollList}>
        {loading && purchases.length === 0 ? (
          <ActivityIndicator size="small" color="#FFFFFF" style={{ marginTop: 24 }} />
        ) : filteredPurchases.length === 0 ? (
          <Text style={styles.emptyText}>No inward purchases found.</Text>
        ) : (
          filteredPurchases.map((item) => {
            const dueAmt = getPurchaseDueAmount(item);
            const billNo = item.vendorBillNo || item.supplierInvoiceNo;
            return (
              <Card key={item.id} style={styles.purchaseCard}>
                <View style={styles.purchaseTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.purchaseNo}>#{item.purchaseNo}</Text>
                    <Text style={styles.supplierName}>
                      {item.party?.name || 'Unknown Supplier'}
                    </Text>
                    <Text style={styles.purchaseDate}>
                      Bill Date: {formatDate(item.purchaseDate || item.createdAt)}
                      {billNo ? ` • Inv #${billNo}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {!isSupervisor ? (
                      <>
                        <Text style={styles.purchaseTotal}>{formatINR(item.total)}</Text>
                        <StatusBadge status={getPurchaseStatus(item)} size="sm" />
                      </>
                    ) : (
                      <Text style={[styles.purchaseTotal, { fontSize: 12, color: Colors.dark.textSecondary }]}>
                        {(item.items || []).length} items
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.purchaseBottomRow}>
                  {!isSupervisor ? (
                    <>
                      <Text style={styles.itemsSub}>
                        {(item.items || []).length} items • Mode: {item.paymentMode || 'CASH'}
                      </Text>
                      {dueAmt > 0.01 ? (
                        <Text style={styles.dueSub}>
                          Due: {formatINR(dueAmt)}
                        </Text>
                      ) : (
                        <Text style={styles.paidSub}>Fully Paid</Text>
                      )}
                    </>
                  ) : (
                    <Text style={styles.itemsSub}>
                      Received items: {(item.items || []).map((it: any) => `${it.product?.name || 'Item'} (${it.qty} ${it.product?.unit || 'units'})`).join(', ') || `${(item.items || []).length} items`}
                    </Text>
                  )}
                </View>
              </Card>
            );
          })
        )}
      </View>

      <CreatePurchaseModal
        visible={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handlePurchaseSuccess}
        warehouses={warehouses}
        parties={parties}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerInfo: {
    flex: 1,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  recordBtn: {
    height: 38,
    paddingHorizontal: 14,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  kpiCard: {
    flex: 1,
    padding: 10,
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  kpiDueCard: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  kpiLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#FFFFFF',
    marginVertical: 2,
    fontFamily: 'monospace',
  },
  kpiSub: {
    fontSize: 9,
    color: Colors.dark.textTertiary,
  },
  scrollList: {
    paddingBottom: 24,
    paddingTop: 8,
  },
  purchaseCard: {
    padding: 12,
    marginBottom: 8,
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  purchaseTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  purchaseNo: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F59E0B',
    fontFamily: 'monospace',
  },
  supplierName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  purchaseDate: {
    fontSize: 10.5,
    color: Colors.dark.textTertiary,
    marginTop: 2,
  },
  purchaseTotal: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  purchaseBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  itemsSub: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
  },
  dueSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  paidSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 24,
  },
});
