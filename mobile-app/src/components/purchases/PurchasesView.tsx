import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Card } from '@/components/ui/Card';
import { SearchBar } from '@/components/ui/SearchBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Colors } from '@/constants/theme';
import { mobileApiRequest } from '@/lib/api';
import { formatINR, formatDate } from '@/lib/formatters';
import { useAuth } from '@/lib/auth-context';

export function PurchasesView() {
  const { user } = useAuth();
  const isSupervisor = user?.role === 'SUPERVISOR';
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mobileApiRequest<any[]>('/purchases');
      setPurchases(res || []);
    } catch (err: any) {
      console.warn('Purchases load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  const filteredPurchases = useMemo(() => {
    if (!search.trim()) return purchases;
    const q = search.toLowerCase();
    return purchases.filter(
      (item) =>
        item.purchaseNo?.toLowerCase().includes(q) ||
        item.supplierInvoiceNo?.toLowerCase().includes(q) ||
        item.party?.name?.toLowerCase().includes(q),
    );
  }, [purchases, search]);

  const totalBilled = purchases.reduce((sum, p) => sum + Number(p.total || 0), 0);
  const totalPaid = purchases.reduce((sum, p) => sum + Number(p.amountPaid || 0), 0);
  const totalPayable = totalBilled - totalPaid;

  return (
    <View style={styles.container}>
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
          filteredPurchases.map((item) => (
            <Card key={item.id} style={styles.purchaseCard}>
              <View style={styles.purchaseTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.purchaseNo}>#{item.purchaseNo}</Text>
                  <Text style={styles.supplierName}>
                    {item.party?.name || 'Unknown Supplier'}
                  </Text>
                  <Text style={styles.purchaseDate}>
                    Bill Date: {formatDate(item.purchaseDate || item.createdAt)}
                    {item.supplierInvoiceNo ? ` • Inv #${item.supplierInvoiceNo}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {!isSupervisor ? (
                    <>
                      <Text style={styles.purchaseTotal}>{formatINR(item.total)}</Text>
                      <StatusBadge status={item.paymentStatus} size="sm" />
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
                    {Number(item.total) - Number(item.amountPaid) > 0 ? (
                      <Text style={styles.dueSub}>
                        Due: {formatINR(Number(item.total) - Number(item.amountPaid))}
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
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
