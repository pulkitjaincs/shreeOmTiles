import React, { useState, useEffect, useCallback, useMemo, useDeferredValue } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SearchBar } from '@/components/ui/SearchBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Colors, ThemeColors } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/lib/theme-context';
import { mobileApiRequest, cachedMobileApiRequest } from '@/lib/api';
import { formatINR, formatDate } from '@/lib/formatters';
import { downloadAndSharePdf } from '@/lib/pdf';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-context';
import { CreateQuotationModal } from './CreateQuotationModal';
import { CalendarModal } from '@/components/ui/CalendarModal';
import { Party, Product } from '@/components/invoices/types';

export function QuotationsView() {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const { user } = useAuth();
  const isDirectorOrAdmin = user?.role === 'OWNER' || (user?.role as any) === 'DIRECTOR' || user?.role === 'ADMIN';
  const [editingQuotation, setEditingQuotation] = useState<any | null>(null);
  const [convertTargetQuote, setConvertTargetQuote] = useState<any | null>(null);
  const [convertCalendarOpen, setConvertCalendarOpen] = useState(false);

  const handleDeleteQuotation = (item: any) => {
    Alert.alert(
      'Delete Quotation',
      `Are you sure you want to delete Estimate #${item.quotationNo || item.estimateNo}? This action is permanent.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await mobileApiRequest(`/quotations/${item.id}`, { method: 'DELETE' });
              loadQuotations(true);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete quotation');
            }
          },
        },
      ],
    );
  };

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const loadQuotations = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const res = await cachedMobileApiRequest<any>('/quotations', {
        forceRefresh: force,
        onRevalidate: (fresh) => {
          const list = Array.isArray(fresh) ? fresh : fresh?.data || [];
          setQuotations(list);
        },
      });
      const list = Array.isArray(res) ? res : res?.data || [];
      setQuotations(list);
    } catch (err: any) {
      console.warn('Quotations load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Lazy-load parties and products only when creating a quotation
  const loadModalData = useCallback(async () => {
    if (parties.length > 0 && products.length > 0) return;
    try {
      const [pList, prList] = await Promise.all([
        cachedMobileApiRequest<Party[]>('/parties', {
          onRevalidate: (fresh) => setParties(fresh || []),
        }).catch(() => []),
        cachedMobileApiRequest<Product[]>('/products', {
          onRevalidate: (fresh) => setProducts(fresh || []),
        }).catch(() => []),
      ]);
      const partiesList = Array.isArray(pList) ? pList : (pList as any)?.data || [];
      const productsList = Array.isArray(prList) ? prList : (prList as any)?.data || [];
      setParties(partiesList);
      setProducts(productsList);
    } catch (err: any) {
      console.warn('Quotations modal deps load error:', err.message);
    }
  }, [parties.length, products.length]);

  useEffect(() => {
    if (createModalVisible) {
      void loadModalData();
    }
  }, [createModalVisible, loadModalData]);

  useEffect(() => {
    loadQuotations();
  }, [loadQuotations]);

  const deferredSearch = useDeferredValue(search);

  const filteredQuotations = useMemo(() => {
    if (!deferredSearch.trim()) return quotations;
    const q = deferredSearch.toLowerCase().trim();
    return quotations.filter(
      (item) =>
        item.quotationNo?.toLowerCase().includes(q) ||
        item.estimateNo?.toLowerCase().includes(q) ||
        item.customerName?.toLowerCase().includes(q) ||
        item.party?.name?.toLowerCase().includes(q) ||
        item.customerPhone?.includes(q) ||
        item.party?.phone?.includes(q),
    );
  }, [quotations, deferredSearch]);

  // 50-item Pagination
  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(1);
  const [prevSearch, setPrevSearch] = useState(deferredSearch);
  if (deferredSearch !== prevSearch) {
    setPrevSearch(deferredSearch);
    setCurrentPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filteredQuotations.length / PAGE_SIZE));

  const paginatedQuotations = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredQuotations.slice(start, start + PAGE_SIZE);
  }, [filteredQuotations, currentPage]);

  const executeConvert = async (quote: any, invoiceDate?: string) => {
    setConvertingId(quote.id);
    try {
      const res = await mobileApiRequest<any>(`/quotations/${quote.id}/convert-to-invoice`, {
        method: 'POST',
        body: JSON.stringify(invoiceDate ? { invoiceDate } : {}),
      });
      Alert.alert(
        'Converted Successfully',
        `Official Invoice #${res.invoiceNo} has been generated!`,
      );
      loadQuotations(true);
    } catch (err: any) {
      Alert.alert('Conversion Failed', err.message || 'Could not convert quotation');
    } finally {
      setConvertingId(null);
    }
  };

  const handleConvert = (quote: any) => {
    Alert.alert(
      'Convert to Invoice',
      `Generate official Tax Invoice from Price Estimate #${quote.quotationNo || quote.estimateNo}? Select invoice date:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Custom Date',
          onPress: () => {
            setConvertTargetQuote(quote);
            setConvertCalendarOpen(true);
          },
        },
        {
          text: "Today's Date",
          onPress: () => executeConvert(quote, new Date().toISOString()),
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
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Button
            title=""
            icon="refresh-outline"
            variant="ghost"
            size="sm"
            onPress={() => loadQuotations(true)}
            style={{ width: 38, height: 38, paddingHorizontal: 0, justifyContent: 'center', alignItems: 'center' }}
          />
          <Button
            title="+ New Estimate"
            icon="add-circle-outline"
            variant="primary"
            size="sm"
            onPress={() => setCreateModalVisible(true)}
            style={styles.newEstimateBtn}
          />
        </View>
      </View>

      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search estimates or customers..."
      />

      <View style={styles.scrollList}>
        {loading && quotations.length === 0 ? (
          <ActivityIndicator size="small" color={colors.text} style={{ marginTop: 24 }} />
        ) : filteredQuotations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="document-text-outline"
              size={36}
              color={colors.textTertiary}
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
          paginatedQuotations.map((item) => (
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
                  <>
                    <TouchableOpacity
                      onPress={() => {
                        void loadModalData();
                        setEditingQuotation(item);
                        setCreateModalVisible(true);
                      }}
                      style={{
                        paddingHorizontal: 10,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderWidth: 1,
                        borderColor: 'rgba(245, 158, 11, 0.3)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      accessibilityLabel="Edit Quotation"
                    >
                      <Ionicons name="create-outline" size={15} color="#F59E0B" />
                    </TouchableOpacity>

                    {isDirectorOrAdmin && (
                      <TouchableOpacity
                        onPress={() => handleDeleteQuotation(item)}
                        style={{
                          paddingHorizontal: 10,
                          height: 32,
                          borderRadius: 8,
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          borderWidth: 1,
                          borderColor: 'rgba(239, 68, 68, 0.3)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        accessibilityLabel="Delete Quotation"
                      >
                        <Ionicons name="trash-outline" size={15} color="#EF4444" />
                      </TouchableOpacity>
                    )}

                    <Button
                      title="Convert to Invoice"
                      icon="receipt-outline"
                      variant="primary"
                      size="sm"
                      loading={convertingId === item.id}
                      onPress={() => handleConvert(item)}
                      style={[styles.actionBtn, styles.convertBtn]}
                    />
                  </>
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

        {totalPages > 1 && (
          <View style={styles.paginationRow}>
            <TouchableOpacity
              style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
              disabled={currentPage === 1}
              onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <Text style={[styles.pageBtnText, currentPage === 1 && styles.pageBtnTextDisabled]}>
                Previous
              </Text>
            </TouchableOpacity>

            <Text style={styles.paginationInfo}>
              Page {currentPage} of {totalPages} ({filteredQuotations.length} total)
            </Text>

            <TouchableOpacity
              style={[styles.pageBtn, currentPage >= totalPages && styles.pageBtnDisabled]}
              disabled={currentPage >= totalPages}
              onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <Text style={[styles.pageBtnText, currentPage >= totalPages && styles.pageBtnTextDisabled]}>
                Next
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Create Quotation Modal */}
      <CreateQuotationModal
        visible={createModalVisible}
        quotationToEdit={editingQuotation}
        onClose={() => {
          setCreateModalVisible(false);
          setEditingQuotation(null);
        }}
        initialParties={parties}
        initialProducts={products}
        onSuccess={() => {
          setEditingQuotation(null);
          loadQuotations(true);
        }}
      />

      <CalendarModal
        visible={convertCalendarOpen}
        onClose={() => {
          setConvertCalendarOpen(false);
          setConvertTargetQuote(null);
        }}
        mode="single"
        title="Select Invoice Date"
        onApply={(selected) => {
          setConvertCalendarOpen(false);
          if (convertTargetQuote && selected) {
            executeConvert(convertTargetQuote, new Date(selected).toISOString());
            setConvertTargetQuote(null);
          }
        }}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
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
      color: colors.text,
      letterSpacing: 0.2,
    },
    headerSubtitle: {
      fontSize: 11,
      color: colors.textSecondary,
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
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
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
      color: colors.text,
      marginTop: 2,
    },
    customerPhone: {
      fontSize: 10.5,
      color: colors.textSecondary,
      marginTop: 1,
    },
    quoteDate: {
      fontSize: 10.5,
      color: colors.textTertiary,
      marginTop: 2,
    },
    quoteTotal: {
      fontSize: 14.5,
      fontWeight: '800',
      color: colors.text,
      fontFamily: 'monospace',
      marginBottom: 4,
    },
    itemsSub: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: colors.border,
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
      color: colors.textSecondary,
      fontSize: 12.5,
    },
    paginationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 8,
      marginTop: 8,
    },
    pageBtn: {
      paddingVertical: 7,
      paddingHorizontal: 14,
      borderRadius: 8,
      backgroundColor: colors.cardElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pageBtnDisabled: {
      opacity: 0.35,
    },
    pageBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    pageBtnTextDisabled: {
      color: colors.textTertiary,
    },
    paginationInfo: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textSecondary,
    },
  });
