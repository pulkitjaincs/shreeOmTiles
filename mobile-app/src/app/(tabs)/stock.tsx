import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { mobileApiRequest, cachedMobileApiRequest } from '@/lib/api';
import { Colors } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SearchBar } from '@/components/ui/SearchBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Ionicons } from '@expo/vector-icons';
import { Product, Warehouse, StockItem } from '@/components/stock/types';
import { InwardStockModal } from '@/components/stock/InwardStockModal';
import { StockTransferModal } from '@/components/stock/StockTransferModal';
import { StockAdjustModal } from '@/components/stock/StockAdjustModal';
import { AddProductModal } from '@/components/stock/AddProductModal';

export default function StockScreen() {
  const { user } = useAuth();
  const isOwnerOrAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'STOCK' | 'PRODUCTS'>('STOCK');
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Modals state
  const [inwardModalOpen, setInwardModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [productFormModalOpen, setProductFormModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const loadData = useCallback(async (force = false) => {
    try {
      const [stockData, prodData, whData] = await Promise.all([
        cachedMobileApiRequest<any[]>('/stock', {
          forceRefresh: force,
          onRevalidate: (fresh) => {
            const stockList = Array.isArray(fresh) ? fresh : (fresh as any)?.data || [];
            setStocks(stockList);
          },
        }),
        cachedMobileApiRequest<Product[]>('/products', {
          forceRefresh: force,
          onRevalidate: (fresh) => {
            const prodList = Array.isArray(fresh) ? fresh : (fresh as any)?.data || [];
            setProducts(prodList);
          },
        }).catch(() => []),
        cachedMobileApiRequest<Warehouse[]>('/warehouses', {
          forceRefresh: force,
          onRevalidate: (fresh) => setWarehouses(fresh || []),
        }).catch(() => []),
      ]);

      const stockList = Array.isArray(stockData) ? stockData : (stockData as any)?.data || [];
      const prodList = Array.isArray(prodData) ? prodData : (prodData as any)?.data || [];
      setStocks(stockList);
      setProducts(prodList);
      setWarehouses(whData || []);
    } catch (err: any) {
      console.warn('Stock load failed', err.message);
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

  // Zero-out Product Stock
  const handleZeroOutStock = (productId: string, productName: string) => {
    Alert.alert(
      'Zero-Out Inventory',
      `Are you sure you want to reset all warehouse stock for "${productName}" to 0?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset to 0',
          style: 'destructive',
          onPress: async () => {
            try {
              await mobileApiRequest('/stock/zero-out', {
                method: 'POST',
                body: JSON.stringify({ productId }),
              });
              Alert.alert('Reset Complete', `Stock for ${productName} is now 0.`);
              loadData(true);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to zero out stock');
            }
          },
        },
      ],
    );
  };

  // Delete Product
  const handleDeleteProduct = (productId: string, productName: string) => {
    Alert.alert(
      'Delete Product',
      `Delete "${productName}" from ERP? If invoices are linked, it will be archived.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await mobileApiRequest(`/products/${productId}`, { method: 'DELETE' });
              Alert.alert('Deleted', `${productName} removed.`);
              loadData(true);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete product');
            }
          },
        },
      ],
    );
  };

  // Filtered lists
  const filteredStocks = useMemo(() => {
    const q = search.toLowerCase();
    return stocks.filter(
      (s) =>
        s.product?.name?.toLowerCase().includes(q) ||
        s.product?.category?.toLowerCase().includes(q) ||
        s.warehouse?.name?.toLowerCase().includes(q) ||
        (s.batchNo && s.batchNo.toLowerCase().includes(q)),
    );
  }, [stocks, search]);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        (p.hsnCode && p.hsnCode.includes(search)),
    );
  }, [products, search]);

  return (
    <View style={styles.screen}>
      <Header
        title="Stock & Inventory"
        subtitle="Warehouse Ledgers & Product Catalog"
        rightAction={
          isOwnerOrAdmin
            ? {
                icon: 'add',
                onPress: () => {
                  if (activeTab === 'STOCK') {
                    setInwardModalOpen(true);
                  } else {
                    setEditingProduct(null);
                    setProductFormModalOpen(true);
                  }
                },
              }
            : undefined
        }
      />

      {/* View Switcher Tabs */}
      <View style={styles.viewToggleBar}>
        <TouchableOpacity
          style={[styles.toggleTab, activeTab === 'STOCK' && styles.toggleTabActive]}
          onPress={() => setActiveTab('STOCK')}
        >
          <Ionicons
            name="cube-outline"
            size={16}
            color={activeTab === 'STOCK' ? '#09090B' : Colors.dark.textSecondary}
          />
          <Text
            style={[styles.toggleTabText, activeTab === 'STOCK' && styles.toggleTabTextActive]}
          >
            Live Warehouse Stock ({stocks.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleTab, activeTab === 'PRODUCTS' && styles.toggleTabActive]}
          onPress={() => setActiveTab('PRODUCTS')}
        >
          <Ionicons
            name="layers-outline"
            size={16}
            color={activeTab === 'PRODUCTS' ? '#09090B' : Colors.dark.textSecondary}
          />
          <Text
            style={[styles.toggleTabText, activeTab === 'PRODUCTS' && styles.toggleTabTextActive]}
          >
            Product Catalog ({products.length})
          </Text>
        </TouchableOpacity>
      </View>

      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder={
          activeTab === 'STOCK'
            ? 'Search product, warehouse, batch...'
            : 'Search product catalog, category, HSN...'
        }
      />

      {/* Stock Management Actions for Owner/Admin */}
      {isOwnerOrAdmin && activeTab === 'STOCK' ? (
        <View style={styles.stockActionRow}>
          <Button
            title="+ Inward Stock"
            size="sm"
            variant="secondary"
            onPress={() => setInwardModalOpen(true)}
            style={{ flex: 1 }}
          />
          <Button
            title="Transfer"
            size="sm"
            variant="secondary"
            onPress={() => setTransferModalOpen(true)}
            style={{ flex: 1 }}
          />
          <Button
            title="Adjust"
            size="sm"
            variant="secondary"
            onPress={() => setAdjustModalOpen(true)}
            style={{ flex: 1 }}
          />
        </View>
      ) : null}

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.loadingText}>Fetching inventory data...</Text>
        </View>
      ) : activeTab === 'STOCK' ? (
        <FlatList
          data={filteredStocks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
          }
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              title="No Stock Records"
              description="No warehouse inventory items found matching your search."
            />
          }
          renderItem={({ item }) => (
            <Card elevated style={styles.stockCard}>
              <View style={styles.stockTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productTitle}>{item.product?.name}</Text>
                  <Text style={styles.categoryBadge}>{item.product?.category}</Text>
                </View>
                <View style={styles.qtyBox}>
                  <Text
                    style={[
                      styles.qtyNumber,
                      item.quantity <= 10 && styles.qtyLow,
                    ]}
                  >
                    {item.quantity}
                  </Text>
                  <Text style={styles.unitText}>{item.product?.unit || 'units'}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.stockMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="business-outline" size={13} color="#A1A1AA" />
                  <Text style={styles.metaText}>{item.warehouse?.name || 'Warehouse'}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="barcode-outline" size={13} color="#A1A1AA" />
                  <Text style={styles.metaText}>
                    Batch: {item.batchNo || 'Standard Batch'}
                  </Text>
                </View>
              </View>
            </Card>
          )}
        />
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
          }
          ListEmptyComponent={
            <EmptyState
              icon="layers-outline"
              title="No Products Found"
              description="No catalog products found. Add a product to get started."
            />
          }
          renderItem={({ item }) => (
            <Card elevated style={styles.productCard}>
              <View style={styles.stockTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productTitle}>{item.name}</Text>
                  <Text style={styles.categoryBadge}>
                    {item.category} • HSN: {item.hsnCode || 'N/A'}
                  </Text>
                </View>
                <View style={styles.unitChip}>
                  <Text style={styles.unitChipText}>{item.unit}</Text>
                </View>
              </View>

              {isOwnerOrAdmin ? (
                <View style={styles.productActionsRow}>
                  <Button
                    title="Edit"
                    size="sm"
                    variant="secondary"
                    onPress={() => {
                      setEditingProduct(item);
                      setProductFormModalOpen(true);
                    }}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Zero Stock"
                    size="sm"
                    variant="outline"
                    onPress={() => handleZeroOutStock(item.id, item.name)}
                    style={{ flex: 1 }}
                  />
                  <TouchableOpacity
                    style={styles.deleteIconBtn}
                    onPress={() => handleDeleteProduct(item.id, item.name)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : null}
            </Card>
          )}
        />
      )}

      {/* MODALS */}
      <InwardStockModal
        visible={inwardModalOpen}
        onClose={() => setInwardModalOpen(false)}
        onSuccess={() => loadData(true)}
        products={products}
        warehouses={warehouses}
      />

      <StockTransferModal
        visible={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        onSuccess={() => loadData(true)}
        products={products}
        warehouses={warehouses}
      />

      <StockAdjustModal
        visible={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        onSuccess={() => loadData(true)}
        products={products}
        warehouses={warehouses}
      />

      <AddProductModal
        visible={productFormModalOpen}
        onClose={() => {
          setProductFormModalOpen(false);
          setEditingProduct(null);
        }}
        onSuccess={() => loadData(true)}
        product={editingProduct}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  viewToggleBar: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 3,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
  },
  toggleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  toggleTabActive: {
    backgroundColor: '#FFFFFF',
  },
  toggleTabText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  toggleTabTextActive: {
    color: '#09090B',
  },
  stockActionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
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
  stockCard: {
    padding: 14,
    marginBottom: 10,
  },
  productCard: {
    padding: 14,
    marginBottom: 10,
  },
  stockTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  productTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  categoryBadge: {
    fontSize: 11.5,
    color: Colors.dark.textSecondary,
    marginTop: 3,
    fontWeight: '500',
  },
  qtyBox: {
    alignItems: 'flex-end',
  },
  qtyNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  qtyLow: {
    color: '#EF4444',
  },
  unitText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
  },
  unitChip: {
    backgroundColor: Colors.dark.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unitChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginVertical: 10,
  },
  stockMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 11.5,
    color: Colors.dark.textSecondary,
  },
  productActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  deleteIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
