import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
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
import { mobileApiRequest, cachedMobileApiRequest, subscribeToAppSync } from '@/lib/api';
import { useTheme, useThemedStyles } from '@/lib/theme-context';
import { Header } from '@/components/ui/Header';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { downloadAndSharePdf } from '@/lib/pdf';
import { buildFullInvoiceShareUrl } from '@/lib/whatsapp';
import { Ionicons } from '@expo/vector-icons';

import {
  Invoice,
  InvoiceListEntry,
  Product,
  Warehouse,
  Party,
  StockLedger,
  CreateInvoiceModal,
  ReturnInvoiceModal,
  InvoiceDetailsModal,
  ShareInvoiceModal,
  InvoiceListFilters,
  InvoiceListCard,
  filterInvoiceList,
  DeleteInvoiceModal,
  InvoiceQrScannerModal,
} from '@/components/invoices';

export default function InvoicesScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const isSalesman = user?.role === 'SALESMAN';
  const isSupervisor = user?.role === 'SUPERVISOR';
  const isDirectorOrAdmin = user?.role === 'OWNER' || (user?.role as any) === 'DIRECTOR' || user?.role === 'ADMIN';
  const isOwnerOrAdmin = isDirectorOrAdmin;
  const canReturn = Boolean(user && user.role !== 'SUPERVISOR');

  const styles = useThemedStyles((c) =>
    StyleSheet.create({
      screen: {
        flex: 1,
        backgroundColor: c.background,
      },
      listContent: {
        padding: 16,
        paddingBottom: 28,
      },
      center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      },
      loadingText: {
        color: c.textSecondary,
        fontSize: 12,
        marginTop: 10,
      },
      utilityActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 4,
      },
      newBillAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 34,
        paddingHorizontal: 12,
        borderRadius: 9,
        backgroundColor: c.primary,
      },
      newBillActionText: {
        color: c.primaryForeground,
        fontSize: 12,
        fontWeight: '800',
      },
      returnAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 34,
        paddingHorizontal: 10,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: 'rgba(251,191,36,0.28)',
        backgroundColor: 'rgba(251,191,36,0.08)',
      },
      returnActionText: {
        color: '#FBBF24',
        fontSize: 11,
        fontWeight: '700',
      },
      scannerAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 34,
        paddingHorizontal: 11,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.35)',
        backgroundColor: 'rgba(56, 189, 248, 0.08)',
      },
      scannerActionText: {
        color: '#38BDF8',
        fontSize: 12,
        fontWeight: '700',
      },
    })
  );

  const [invoices, setInvoices] = useState<InvoiceListEntry[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [stockList, setStockList] = useState<StockLedger[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [modeFilter, setModeFilter] = useState('ALL');
  const [createdById, setCreatedById] = useState('ALL');
  const [staff, setStaff] = useState<{ id: string; name: string; role: string }[]>([]);
  const [dateFilter, setDateFilter] = useState('TODAY');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [detailsInvoice, setDetailsInvoice] = useState<any>(null);
  const [returnInvoice, setReturnInvoice] = useState<any>(null);
  const [editingRefund, setEditingRefund] = useState<any>(null);
  const [deleteInvoiceTarget, setDeleteInvoiceTarget] = useState<any>(null);
  const [createdInvoiceSuccess, setCreatedInvoiceSuccess] = useState<Invoice | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Parties are loaded lazily — only when the create modal is first opened.
  // See loadPartiesLazy() below.

  const loadData = useCallback(async (force = false) => {
    try {
      const invQueryParams = new URLSearchParams();
      if (isOwnerOrAdmin && createdById !== 'ALL') {
        invQueryParams.set('createdById', createdById);
      }
      if (dateFilter && dateFilter !== 'ALL') {
        if (dateFilter === 'CUSTOM') {
          if (dateFrom) invQueryParams.set('from', dateFrom);
          if (dateTo) invQueryParams.set('to', dateTo);
        } else {
          invQueryParams.set('preset', dateFilter);
        }
      }
      const invQueryStr = invQueryParams.toString();
      const invUrl = `/invoices${invQueryStr ? `?${invQueryStr}` : ''}`;

      const [invData, prodData, whData, stockData, usersData] = await Promise.all([
        cachedMobileApiRequest<any[]>(
          invUrl,
          {
          forceRefresh: force,
          onRevalidate: (fresh) => {
            const list = Array.isArray(fresh) ? fresh : (fresh as any)?.data || [];
            setInvoices(list);
          },
          },
        ),
        cachedMobileApiRequest<Product[]>('/products', {
          forceRefresh: force,
          onRevalidate: (fresh) => setProducts(fresh || []),
        }).catch(() => []),
        cachedMobileApiRequest<Warehouse[]>('/warehouses', {
          forceRefresh: force,
          onRevalidate: (fresh) => setWarehouses(fresh || []),
        }).catch(() => []),
        cachedMobileApiRequest<StockLedger[]>('/stock', {
          forceRefresh: force,
          onRevalidate: (fresh) => setStockList(fresh || []),
        }).catch(() => []),
        isOwnerOrAdmin
          ? cachedMobileApiRequest<{ id: string; name: string; role: string }[]>('/users', {
              forceRefresh: force,
            }).catch(() => [])
          : Promise.resolve([]),
      ]);

      const list = Array.isArray(invData) ? invData : (invData as any)?.data || [];
      setInvoices(list);
      setProducts(prodData || []);
      setWarehouses(whData || []);
      setStockList(stockData || []);
      setStaff(Array.isArray(usersData) ? usersData : []);
    } catch (err: any) {
      console.warn('Failed to load invoices data', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [createdById, isOwnerOrAdmin, dateFilter, dateFrom, dateTo]);

  // Lazy-load parties only when the Create Invoice modal is about to open.
  // /parties carries full creditLedger arrays and can be several MB — loading it
  // eagerly on every tab focus was the main bottleneck of the invoices screen.
  const loadPartiesLazy = useCallback(async () => {
    if (parties.length > 0) return; // already loaded, skip
    try {
      const data = await cachedMobileApiRequest<Party[]>('/parties', {
        onRevalidate: (fresh) => setParties(fresh || []),
      });
      setParties(data || []);
    } catch (err: any) {
      console.warn('Failed to lazy-load parties:', err.message);
    }
  }, [parties.length]);

  useEffect(() => {
    if (createModalOpen || editingInvoice || returnInvoice) {
      void loadPartiesLazy();
    }
  }, [createModalOpen, editingInvoice, returnInvoice, loadPartiesLazy]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  useEffect(() => {
    const unsubscribe = subscribeToAppSync(() => {
      void loadData();
    });
    return () => unsubscribe();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const refreshInvoiceStock = useCallback(async () => {
    try {
      const fresh = await cachedMobileApiRequest<StockLedger[]>('/stock', { forceRefresh: true });
      const list = Array.isArray(fresh) ? fresh : (fresh as any)?.data || [];
      setStockList(list);
      return list;
    } catch (err: any) {
      console.warn('Failed to refresh invoice stock:', err?.message);
      throw err;
    }
  }, []);

  // WhatsApp Share Handler - shares rich, itemized order details
  const handleShareWhatsApp = async (invoice: any) => {
    try {
      let fullInv = invoice;
      // Invoice creation responses contain items but not the payment relation.
      // Always load the detail record so paid and due amounts are accurate.
      try {
        const res = await mobileApiRequest<any>(`/invoices/${invoice.id}`);
        if (res && res.id === invoice.id) {
          fullInv = res;
        }
      } catch (error: any) {
        console.warn('Failed to load full invoice before WhatsApp share:', error?.message);
      }

      const url = buildFullInvoiceShareUrl(fullInv);
      const supported = await Linking.canOpenURL(url).catch(() => false);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(url).catch(() => {
          Alert.alert('Error', 'Unable to launch WhatsApp. Please ensure WhatsApp is installed.');
        });
      }
    } catch {
      Alert.alert('Error', 'Failed to prepare order details for WhatsApp');
    }
  };

  const handleInvoiceCreated = (res?: any) => {
    void loadData(true);
    if (res?.id) {
      setCreatedInvoiceSuccess(res);
    } else if (res?.invoiceNo) {
      Alert.alert('Invoice Created', `Invoice #${res.invoiceNo} was generated successfully.`);
    }
  };

  const handleOpenInvoiceDetails = async (invoice: any) => {
    setDetailsInvoice(invoice);
    try {
      const fullInvoice = await mobileApiRequest<any>(`/invoices/${invoice.id}`);
      if (fullInvoice?.id === invoice.id) setDetailsInvoice(fullInvoice);
    } catch {
      // Keep the list record visible if detail loading is temporarily unavailable.
    }
  };

  const handleQrScanned = async (query: string) => {
    try {
      const match = invoices.find(
        (i) =>
          i.id === query ||
          i.invoiceNo?.toLowerCase() === query.toLowerCase() ||
          (query.includes(i.invoiceNo || '') && (i.invoiceNo || '').length > 3),
      );
      if (match) {
        await handleOpenInvoiceDetails(match);
        return;
      }
      const full = await mobileApiRequest<any>(`/invoices/lookup/${encodeURIComponent(query)}`);
      if (full && full.id) {
        await handleOpenInvoiceDetails(full);
      } else {
        Alert.alert('Invoice Not Found', `No bill matching "${query}" could be found.`);
      }
    } catch (err: any) {
      Alert.alert('Lookup Error', err.message || 'Invoice lookup failed.');
    }
  };

  const handleOpenEditInvoice = async (invoice: any) => {
    try {
      void loadPartiesLazy();
      let fullInv = invoice;
      if (!invoice.items || invoice.items.length === 0) {
        const res = await mobileApiRequest<any>(`/invoices/${invoice.id}`);
        if (res && res.id) fullInv = res;
      }
      setEditingInvoice(fullInv);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not load bill details for editing');
    }
  };

  const handleDownloadRefundPdf = async (refundId: string, refundNo: string) => {
    await downloadAndSharePdf(`invoices/refund/${refundId}/pdf`, refundNo || `Credit_Note_${refundId}`);
  };

  const handleDownloadInvoicePdf = async (invoiceId: string, invoiceNo: string) => {
    await downloadAndSharePdf(`invoices/${invoiceId}/pdf`, invoiceNo || `Invoice_${invoiceId}`);
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setModeFilter('ALL');
    setDateFilter('ALL');
    setDateFrom('');
    setDateTo('');
  };

  const filteredInvoices = useMemo(
    () => filterInvoiceList(invoices, {
      search,
      status: statusFilter,
      paymentMode: modeFilter,
      datePreset: dateFilter,
      dateFrom,
      dateTo,
    }),
    [invoices, search, statusFilter, modeFilter, dateFilter, dateFrom, dateTo],
  );

  return (
    <View style={styles.screen}>
      <Header
        title={isSalesman ? 'Counter Billing' : 'Invoices'}
        subtitle={isSupervisor ? 'Order Quantities & Line Items' : 'Billing, GST & UPI Receipts'}
      />

      {!isSupervisor || canReturn ? (
        <View style={styles.utilityActions}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {!isSupervisor ? (
              <TouchableOpacity
                style={styles.newBillAction}
                onPress={() => {
                  void loadPartiesLazy();
                  setCreateModalOpen(true);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={16} color={colors.primaryForeground} />
                <Text style={styles.newBillActionText}>New Bill</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.scannerAction}
              onPress={() => setScannerOpen(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="qr-code-outline" size={15} color="#38BDF8" />
              <Text style={styles.scannerActionText}>Scan QR</Text>
            </TouchableOpacity>
          </View>

          {canReturn ? (
            <TouchableOpacity
              style={styles.returnAction}
              onPress={() => setReturnInvoice({ lookupOnly: true })}
              activeOpacity={0.8}
            >
              <Ionicons name="return-up-back-outline" size={15} color="#FBBF24" />
              <Text style={styles.returnActionText}>Process Return</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <InvoiceListFilters
        search={search}
        onSearchChange={setSearch}
        staffOptions={
          isOwnerOrAdmin
            ? [
                { label: 'All Creators', value: 'ALL', icon: 'people-outline' as const, color: '#FFFFFF' },
                ...staff
                  .filter((member) => ['SALESMAN', 'ADMIN', 'OWNER'].includes(member.role))
                  .map((member) => ({
                    label: member.name,
                    value: member.id,
                    icon: 'person-outline' as const,
                    color: member.role === 'SALESMAN' ? '#38BDF8' : '#F59E0B',
                  })),
              ]
            : undefined
        }
        createdById={createdById}
        onCreatedByIdChange={setCreatedById}
        status={statusFilter}
        onStatusChange={setStatusFilter}
        datePreset={dateFilter}
        onDatePresetChange={setDateFilter}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        paymentMode={modeFilter}
        onPaymentModeChange={setModeFilter}
        invoiceCount={invoices.length}
        resultCount={filteredInvoices.length}
        onClear={clearFilters}
      />

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={colors.text} />
          <Text style={styles.loadingText}>Fetching invoices registry...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredInvoices}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
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
            <InvoiceListCard
              invoice={item}
              canReturn={canReturn}
              isSupervisor={isSupervisor}
              onOpen={handleOpenInvoiceDetails}
              onEdit={!isSupervisor ? handleOpenEditInvoice : undefined}
              onDownloadPdf={(inv) => void downloadAndSharePdf(`invoices/${inv.id}/pdf`, inv.invoiceNo || `Invoice_${inv.id}`)}
              onShareWhatsApp={handleShareWhatsApp}
              onReturn={setReturnInvoice}
            />
          )}
        />
      )}



      {/* Modular Modals */}
      <CreateInvoiceModal
        visible={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleInvoiceCreated}
        products={products}
        warehouses={warehouses}
        parties={parties}
        stockList={stockList}
        onRefreshStock={refreshInvoiceStock}
      />

      {/* Edit Invoice Modal */}
      <CreateInvoiceModal
        visible={Boolean(editingInvoice)}
        invoiceToEdit={editingInvoice}
        onClose={() => setEditingInvoice(null)}
        onSuccess={(res) => {
          setEditingInvoice(null);
          void loadData(true);
          Alert.alert(
            'Invoice Updated',
            `Invoice #${res?.invoiceNo || editingInvoice?.invoiceNo} was updated successfully.`,
          );
        }}
        products={products}
        warehouses={warehouses}
        parties={parties}
        stockList={stockList}
        onRefreshStock={refreshInvoiceStock}
      />

      <InvoiceDetailsModal
        invoice={detailsInvoice}
        visible={Boolean(detailsInvoice)}
        onClose={() => setDetailsInvoice(null)}
        onShareWhatsApp={handleShareWhatsApp}
        onDownloadRefundPdf={handleDownloadRefundPdf}
        onInitiateReturn={canReturn ? (inv) => setReturnInvoice(inv) : undefined}
        onEditRefund={!isSupervisor ? (inv, refund) => {
          setDetailsInvoice(null);
          setEditingRefund({ ...refund, originalInvoice: inv });
          setReturnInvoice(inv);
        } : undefined}
        onEdit={!isSupervisor ? (inv) => { setDetailsInvoice(null); void handleOpenEditInvoice(inv); } : undefined}
        canDelete={isOwnerOrAdmin}
        onDeleteInvoice={(inv) => setDeleteInvoiceTarget(inv)}
        isSupervisor={isSupervisor}
      />

      <DeleteInvoiceModal
        invoice={deleteInvoiceTarget}
        visible={Boolean(deleteInvoiceTarget)}
        onClose={() => setDeleteInvoiceTarget(null)}
        onSuccess={() => loadData(true)}
      />

      <ReturnInvoiceModal
        invoice={returnInvoice}
        visible={Boolean(returnInvoice)}
        onClose={() => { setReturnInvoice(null); setEditingRefund(null); }}
        editingRefund={editingRefund}
        warehouses={warehouses}
        products={products}
        parties={parties}
        onDownloadRefundPdf={handleDownloadRefundPdf}
        onDownloadPdf={handleDownloadInvoicePdf}
        onSuccess={() => { setEditingRefund(null); loadData(true); }}
      />

      <ShareInvoiceModal
        visible={Boolean(createdInvoiceSuccess)}
        invoice={createdInvoiceSuccess}
        onClose={() => setCreatedInvoiceSuccess(null)}
        onShareWhatsApp={handleShareWhatsApp}
        onViewDetails={handleOpenInvoiceDetails}
      />

      <InvoiceQrScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleQrScanned}
      />

    </View>
  );
}
