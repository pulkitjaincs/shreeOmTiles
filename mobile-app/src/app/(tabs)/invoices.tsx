import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { mobileApiRequest, cachedMobileApiRequest } from '@/lib/api';
import { Colors } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { SearchBar } from '@/components/ui/SearchBar';
import { FilterPills } from '@/components/ui/FilterPills';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatINR, formatDate, cleanPhoneNumber } from '@/lib/formatters';
import { downloadAndSharePdf } from '@/lib/pdf';
import { Ionicons } from '@expo/vector-icons';

import { Product, Warehouse, Party, StockLedger, UpiModalData } from '@/components/invoices/types';
import { CreateInvoiceModal } from '@/components/invoices/CreateInvoiceModal';
import { ReturnInvoiceModal } from '@/components/invoices/ReturnInvoiceModal';
import { UpiQrModal } from '@/components/invoices/UpiQrModal';
import { InvoiceDetailsModal } from '@/components/invoices/InvoiceDetailsModal';

export default function InvoicesScreen() {
  const { user } = useAuth();
  const isSalesman = user?.role === 'SALESMAN';

  const [invoices, setInvoices] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [stockList, setStockList] = useState<StockLedger[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailsInvoice, setDetailsInvoice] = useState<any>(null);
  const [returnInvoice, setReturnInvoice] = useState<any>(null);
  const [upiModalData, setUpiModalData] = useState<UpiModalData | null>(null);

  const loadData = useCallback(async (force = false) => {
    try {
      const [invData, prodData, whData, partyData, stockData] = await Promise.all([
        cachedMobileApiRequest<any[]>('/invoices', {
          forceRefresh: force,
          onRevalidate: (fresh) => {
            const list = Array.isArray(fresh) ? fresh : (fresh as any)?.data || [];
            setInvoices(list);
          },
        }),
        cachedMobileApiRequest<Product[]>('/products', {
          forceRefresh: force,
          onRevalidate: (fresh) => setProducts(fresh || []),
        }).catch(() => []),
        cachedMobileApiRequest<Warehouse[]>('/warehouses', {
          forceRefresh: force,
          onRevalidate: (fresh) => setWarehouses(fresh || []),
        }).catch(() => []),
        cachedMobileApiRequest<Party[]>('/parties', {
          forceRefresh: force,
          onRevalidate: (fresh) => setParties(fresh || []),
        }).catch(() => []),
        cachedMobileApiRequest<StockLedger[]>('/stock', {
          forceRefresh: force,
          onRevalidate: (fresh) => setStockList(fresh || []),
        }).catch(() => []),
      ]);

      const list = Array.isArray(invData) ? invData : (invData as any)?.data || [];
      setInvoices(list);
      setProducts(prodData || []);
      setWarehouses(whData || []);
      setParties(partyData || []);
      setStockList(stockData || []);
    } catch (err: any) {
      console.warn('Failed to load invoices data', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  // WhatsApp Share Handler
  const handleShareWhatsApp = (invoice: any) => {
    const phone = cleanPhoneNumber(invoice.party?.phone || invoice.partyPhone);
    const partyName = invoice.party?.name || invoice.partyName || 'Customer';
    const totalVal = formatINR(invoice.total);
    const msg = `*Shree Om Tiles & Sanitaryware*\nInvoice: #${invoice.invoiceNo}\nCustomer: ${partyName}\nTotal: ${totalVal}\nStatus: ${invoice.status || 'PAID'}\n\nThank you for your business!`;
    const url = phone
      ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to launch WhatsApp. Please ensure WhatsApp is installed.');
    });
  };

  // Open Dynamic UPI QR
  const handleOpenUpiQr = async (invoice: any) => {
    try {
      const qrData = await mobileApiRequest<any>(`/invoices/${invoice.id}/upi-qr`);
      setUpiModalData({
        invoiceId: invoice.id,
        invoiceNo: qrData.invoiceNo || invoice.invoiceNo,
        partyName: invoice.party?.name,
        partyPhone: invoice.party?.phone,
        total: Number(qrData.amount || invoice.total),
        qrDataUrl: qrData.qrDataUrl,
        vpa: qrData.vpa,
      });
    } catch (err: any) {
      Alert.alert('UPI QR Error', err.message || 'Unable to load UPI QR code. Please check connection.');
    }
  };

  const handleInvoiceCreated = (res?: any) => {
    loadData(true);
    // If created with UPI mode, prompt dynamic NPCI UPI QR code for counter scanning
    if (res?.id && res?.paymentMode === 'UPI') {
      handleOpenUpiQr(res);
    }
  };

  // Filtered invoices
  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNo?.toLowerCase().includes(search.toLowerCase()) ||
      inv.party?.name?.toLowerCase().includes(search.toLowerCase()) ||
      inv.party?.phone?.includes(search);

    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <View style={styles.screen}>
      <Header
        title={isSalesman ? 'Counter Billing' : 'Invoices'}
        subtitle="Billing, GST & UPI Receipts"
        rightAction={{
          icon: 'add',
          onPress: () => setCreateModalOpen(true),
        }}
      />

      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search invoice #, customer name, phone..."
      />

      {/* Status Filter Chips */}
      <FilterPills
        options={[
          { label: 'All Bills', value: 'ALL', count: invoices.length },
          { label: 'Paid', value: 'PAID' },
          { label: 'Partial', value: 'PARTIAL' },
          { label: 'Created', value: 'CREATED' },
          { label: 'Cancelled', value: 'CANCELLED' },
        ]}
        selected={statusFilter}
        onSelect={setStatusFilter}
      />

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.loadingText}>Fetching invoices registry...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredInvoices}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
          }
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="No Invoices Found"
              description="No billing records match your search or filter. Create a new invoice to get started."
              actionTitle="+ Create Invoice"
              onAction={() => setCreateModalOpen(true)}
            />
          }
          renderItem={({ item }) => (
            <Card
              elevated
              style={styles.invoiceCard}
              onPress={() => setDetailsInvoice(item)}
            >
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invoiceNumber}>#{item.invoiceNo}</Text>
                  <Text style={styles.partyName}>{item.party?.name || 'Counter Sale'}</Text>
                  <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.totalAmount}>{formatINR(item.total)}</Text>
                  <StatusBadge status={item.status} size="sm" />
                </View>
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.cardBottom}>
                <View style={styles.badgeRow}>
                  <View style={styles.modeBadge}>
                    <Text style={styles.modeText}>{item.paymentMode || 'UPI'}</Text>
                  </View>
                  <Text style={styles.salesmanText}>
                    By: {item.salesman?.name || 'Staff'}
                  </Text>
                </View>

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => downloadAndSharePdf(`invoices/${item.id}/pdf`, item.invoiceNo || `Invoice_${item.id}`)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="document-text-outline" size={18} color="#3B82F6" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => handleOpenUpiQr(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => handleShareWhatsApp(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="logo-whatsapp" size={18} color="#10B981" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => setReturnInvoice(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="return-up-back-outline" size={18} color="#A1A1AA" />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          )}
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setCreateModalOpen(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={24} color="#09090B" />
        <Text style={styles.fabText}>New Bill</Text>
      </TouchableOpacity>

      {/* Modular Modals */}
      <CreateInvoiceModal
        visible={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleInvoiceCreated}
        products={products}
        warehouses={warehouses}
        parties={parties}
        stockList={stockList}
        isSalesman={isSalesman}
      />

      <InvoiceDetailsModal
        invoice={detailsInvoice}
        visible={Boolean(detailsInvoice)}
        onClose={() => setDetailsInvoice(null)}
        onShareWhatsApp={handleShareWhatsApp}
        onInitiateReturn={(inv) => setReturnInvoice(inv)}
      />

      <ReturnInvoiceModal
        invoice={returnInvoice}
        visible={Boolean(returnInvoice)}
        onClose={() => setReturnInvoice(null)}
        onSuccess={() => loadData(true)}
      />

      <UpiQrModal
        data={upiModalData}
        onClose={() => setUpiModalData(null)}
        onShareWhatsApp={(data) => handleShareWhatsApp(data)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  listContent: {
    padding: 16,
    paddingBottom: 90,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 10,
  },
  invoiceCard: {
    padding: 16,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  invoiceNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  partyName: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
    marginTop: 4,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cardDivider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginVertical: 12,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeBadge: {
    backgroundColor: Colors.dark.secondary,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  modeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  salesmanText: {
    color: Colors.dark.textTertiary,
    fontSize: 11,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIconBtn: {
    padding: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    height: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '800',
  },
});
