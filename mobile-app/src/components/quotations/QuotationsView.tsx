import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SearchBar } from '@/components/ui/SearchBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Colors } from '@/constants/theme';
import { mobileApiRequest } from '@/lib/api';
import { formatINR, formatDate } from '@/lib/formatters';
import { downloadAndSharePdf } from '@/lib/pdf';
import { Ionicons } from '@expo/vector-icons';
import { CreateQuotationModal } from './CreateQuotationModal';

export function QuotationsView() {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);

  const loadQuotations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mobileApiRequest<any>('/quotations');
      const list = Array.isArray(res) ? res : res?.data || [];
      setQuotations(list);
    } catch (err: any) {
      console.warn('Quotations load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuotations();
  }, [loadQuotations]);

  const filteredQuotations = useMemo(() => {
    if (!search.trim()) return quotations;
    const q = search.toLowerCase();
    return quotations.filter(
      (item) =>
        item.quotationNo?.toLowerCase().includes(q) ||
        item.estimateNo?.toLowerCase().includes(q) ||
        item.customerName?.toLowerCase().includes(q) ||
        item.party?.name?.toLowerCase().includes(q) ||
        item.customerPhone?.includes(q) ||
        item.party?.phone?.includes(q),
    );
  }, [quotations, search]);

  const handleConvert = (quote: any) => {
    Alert.alert(
      'Convert to Invoice',
      `Generate official Tax Invoice from Price Estimate #${quote.quotationNo || quote.estimateNo}? This will reserve inventory.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Convert & Invoice',
          onPress: async () => {
            setConvertingId(quote.id);
            try {
              const res = await mobileApiRequest<any>(`/quotations/${quote.id}/convert-to-invoice`, {
                method: 'POST',
              });
              Alert.alert(
                'Converted Successfully',
                `Official Invoice #${res.invoiceNo} has been generated!`,
              );
              loadQuotations();
            } catch (err: any) {
              Alert.alert('Conversion Failed', err.message || 'Could not convert quotation');
            } finally {
              setConvertingId(null);
            }
          },
        },
      ],
    );
  };

  const handleDownloadPdf = async (quote: any) => {
    try {
      await downloadAndSharePdf(
        `quotations/${quote.id}/pdf`,
        `Estimate_${quote.quotationNo || quote.estimateNo}`,
      );
    } catch (err: any) {
      Alert.alert('Download Failed', err.message || 'Could not download estimate PDF');
    }
  };

  return (
    <View style={styles.container}>
      {/* Prominent Header Bar with "+ New Estimate" Button */}
      <View style={styles.headerBar}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Price Estimates</Text>
          <Text style={styles.headerSubtitle}>
            {quotations.length} {quotations.length === 1 ? 'estimate' : 'estimates'} generated
          </Text>
        </View>
        <Button
          title="+ New Estimate"
          icon="add-circle-outline"
          variant="primary"
          size="sm"
          onPress={() => setCreateModalVisible(true)}
          style={styles.newEstimateBtn}
        />
      </View>

      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search estimates or customers..."
      />

      <View style={styles.scrollList}>
        {loading && quotations.length === 0 ? (
          <ActivityIndicator size="small" color="#FFFFFF" style={{ marginTop: 24 }} />
        ) : filteredQuotations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="document-text-outline"
              size={36}
              color={Colors.dark.textTertiary}
              style={{ marginBottom: 6 }}
            />
            <Text style={styles.emptyText}>
              {search.trim() ? `No estimates matching "${search}"` : 'No price estimates created yet.'}
            </Text>
            {!search.trim() ? (
              <Button
                title="+ Create First Estimate"
                variant="outline"
                size="sm"
                onPress={() => setCreateModalVisible(true)}
                style={{ marginTop: 12, paddingHorizontal: 16 }}
              />
            ) : null}
          </View>
        ) : (
          filteredQuotations.map((item) => (
            <Card key={item.id} style={styles.quoteCard}>
              <View style={styles.quoteTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.estimateNo}>#{item.quotationNo || item.estimateNo}</Text>
                  <Text style={styles.customerName}>
                    {item.party?.name || item.customerName || 'Walk-in Customer'}
                  </Text>
                  {item.customerPhone || item.party?.phone ? (
                    <Text style={styles.customerPhone}>
                      {item.customerPhone || item.party?.phone}
                    </Text>
                  ) : null}
                  <Text style={styles.quoteDate}>{formatDate(item.createdAt)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.quoteTotal}>{formatINR(item.total)}</Text>
                  <StatusBadge status={item.status} size="sm" />
                </View>
              </View>

              <Text style={styles.itemsSub}>
                {(item.items || []).length} line items • Validity: {item.validUntil ? formatDate(item.validUntil) : '15 Days'}
              </Text>

              <View style={styles.actionRow}>
                <Button
                  title="PDF Estimate"
                  icon="document-text-outline"
                  variant="outline"
                  size="sm"
                  onPress={() => handleDownloadPdf(item)}
                  style={styles.actionBtn}
                />
                {item.status !== 'CONVERTED' ? (
                  <Button
                    title="Convert to Invoice"
                    icon="receipt-outline"
                    variant="primary"
                    size="sm"
                    loading={convertingId === item.id}
                    onPress={() => handleConvert(item)}
                    style={[styles.actionBtn, styles.convertBtn]}
                  />
                ) : (
                  <View style={styles.convertedPill}>
                    <Ionicons name="checkmark-done" size={13} color="#10B981" />
                    <Text style={styles.convertedText}>Converted to Invoice</Text>
                  </View>
                )}
              </View>
            </Card>
          ))
        )}
      </View>

      {/* Create Quotation Modal */}
      <CreateQuotationModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={() => {
          loadQuotations();
        }}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  newEstimateBtn: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 9,
  },
  scrollList: {
    paddingBottom: 24,
    paddingTop: 8,
  },
  quoteCard: {
    padding: 12,
    marginBottom: 8,
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  quoteTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  estimateNo: {
    fontSize: 13,
    fontWeight: '800',
    color: '#38BDF8',
    fontFamily: 'monospace',
  },
  customerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  customerPhone: {
    fontSize: 10.5,
    color: Colors.dark.textSecondary,
    marginTop: 1,
  },
  quoteDate: {
    fontSize: 10.5,
    color: Colors.dark.textTertiary,
    marginTop: 2,
  },
  quoteTotal: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  itemsSub: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
  },
  convertBtn: {
    backgroundColor: '#3B82F6',
  },
  convertedPill: {
    flex: 1,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  convertedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.dark.textSecondary,
    fontSize: 12.5,
  },
});
