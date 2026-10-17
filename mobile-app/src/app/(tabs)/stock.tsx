import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-context';
import { mobileApiRequest, cachedMobileApiRequest } from '@/lib/api';
import { Colors } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { SearchBar } from '@/components/ui/SearchBar';
import { Button } from '@/components/ui/Button';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Product,
  Warehouse,
  StockItem,
  WarehouseStockCard,
  ProductCatalogCard,
  StockTabBar,
  InwardStockModal,
  StockAdjustModal,
  AddProductModal,
} from '@/components/stock';

export default function StockScreen() {
  const { user } = useAuth();
  const isOwnerOrAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const isSupervisor = user?.role === 'SUPERVISOR';
  const userWarehouseId = user?.scope;

  const [activeTab, setActiveTab] = useState<'STOCK' | 'PRODUCTS'>('STOCK');
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Modals state
  const [inwardModalOpen, setInwardModalOpen] = useState(false);
  const [inwardProductId, setInwardProductId] = useState<string | undefined>(undefined);
  const [inwardWarehouseId, setInwardWarehouseId] = useState<string | undefined>(undefined);
  const [inwardBatchNo, setInwardBatchNo] = useState<string | undefined>(undefined);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedAdjustStock, setSelectedAdjustStock] = useState<StockItem | null>(null);
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

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  // Zero-out Product Stock
  const handleZeroOutStock = (productId: string, productName: string) => {
    Alert.alert(
      'Zero-Out Inventory',
      `Are you sure you want to reset all inventory stock for "${productName}" to 0?`,
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
  const inStockBatches = useMemo(
    () => stocks.filter((s) => Number(s.quantity || 0) > 0),
    [stocks],
  );

  const filteredStocks = useMemo(() => {
    const q = search.toLowerCase().trim();
    return inStockBatches.filter((s) => {
      const matchesCat =
        selectedCategory === 'ALL' || s.product?.category === selectedCategory;
      const matchesSearch =
        !q ||
        (s.product?.name?.toLowerCase().includes(q) ?? false) ||
        (s.product?.category?.toLowerCase().includes(q) ?? false) ||
        (s.batchNo?.toLowerCase().includes(q) ?? false);
      return matchesCat && matchesSearch;
    });
  }, [inStockBatches, search, selectedCategory]);

  const categoryOptions = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
    return [
      {
        label: 'All Categories',
        value: 'ALL',
        count: products.length,
        icon: 'grid-outline' as const,
        color: '#FFFFFF',
      },
      ...cats.map((c) => ({
        label: c,
        value: c,
        count: products.filter((p) => p.category === c).length,
        icon: 'folder-outline' as const,
        color: '#38BDF8',
      })),
    ];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products.filter((p) => {
      const matchesSearch =
        p.name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        (p.hsnCode && p.hsnCode.includes(q));
      const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [products, search, selectedCategory]);

  return (
    <View style={styles.screen}>
      <Header
        title="Stock & Inventory"
        subtitle="Inventory & Product Catalog"
      />

      <View style={styles.topControlContainer}>
        {/* View Switcher Tabs (Live Stock vs Product Catalog) */}
        <StockTabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          stockCount={inStockBatches.length}
          productCount={products.length}
        />

        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder={
            activeTab === 'STOCK'
              ? 'Search product, batch...'
              : 'Search product catalog, category, HSN...'
          }
        />

        {/* Dropdown of Categories with Inward/New Product Action Beside It */}
        <View style={styles.dropdownActionRow}>
          <FilterDropdown
            label="Category"
            value={selectedCategory}
            options={categoryOptions}
            onSelect={setSelectedCategory}
            icon="grid-outline"
            containerStyle={{ flex: 1.15 }}
          />

          {isOwnerOrAdmin && (
            activeTab === 'STOCK' ? (
              <Button
                title="Inward Stock"
                icon="add-circle-outline"
                size="sm"
                variant="primary"
                onPress={() => {
                  setInwardProductId(undefined);
                  setInwardWarehouseId(undefined);
                  setInwardBatchNo(undefined);
                  setInwardModalOpen(true);
                }}
                style={styles.actionBtn}
              />
            ) : (
              <Button
                title="New Product"
                icon="add-circle-outline"
                size="sm"
                variant="primary"
                onPress={() => {
                  setEditingProduct(null);
                  setProductFormModalOpen(true);
                }}
                style={styles.actionBtn}
              />
            )
          )}
        </View>

        {/* Secondary Quick Inventory Utility Links (Adjust) */}
        {(isOwnerOrAdmin || isSupervisor) && activeTab === 'STOCK' && (
          <View style={styles.secondaryActionsRow}>
            <TouchableOpacity
              style={styles.utilityBtn}
              onPress={() => setAdjustModalOpen(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="options-outline" size={13} color="#A855F7" />
              <Text style={styles.utilityBtnTextAdjust}>Audit / Adjust Physical Count</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Results Count & Reset Filters */}
        <View style={styles.resultsRow}>
          <Text style={styles.resultsText}>
            {activeTab === 'STOCK'
              ? `Showing ${filteredStocks.length} of ${inStockBatches.length} inventory batches`
              : `Showing ${filteredProducts.length} of ${products.length} products`}
          </Text>
          {(selectedCategory !== 'ALL' || Boolean(search.trim())) ? (
            <TouchableOpacity
              onPress={() => {
                setSelectedCategory('ALL');
                setSearch('');
              }}
            >
              <Text style={styles.clearFiltersText}>Reset Filters</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

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
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
          }
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              title="No Stock Records"
              description="No inventory items found matching your search."
            />
          }
          renderItem={({ item }) => (
            <WarehouseStockCard
              item={item}
              isOwnerOrAdmin={isOwnerOrAdmin}
              isSupervisor={isSupervisor}
              userWarehouseId={userWarehouseId}
              onInward={(stock) => {
                setInwardProductId(stock.productId);
                setInwardWarehouseId(stock.warehouseId);
                setInwardBatchNo(stock.batchNo);
                setInwardModalOpen(true);
              }}
              onAdjust={(stock) => {
                setSelectedAdjustStock(stock);
                setAdjustModalOpen(true);
              }}
            />
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
            <ProductCatalogCard
              item={item}
              stocks={stocks}
              isOwnerOrAdmin={isOwnerOrAdmin}
              isSupervisor={isSupervisor}
              onInward={(productId) => {
                setInwardProductId(productId);
                setInwardModalOpen(true);
              }}
              onEdit={(prod) => {
                setEditingProduct(prod);
                setProductFormModalOpen(true);
              }}
              onZeroOut={handleZeroOutStock}
              onDelete={handleDeleteProduct}
            />
          )}
        />
      )}

      {/* MODALS */}
      <InwardStockModal
        visible={inwardModalOpen}
        onClose={() => {
          setInwardModalOpen(false);
          setInwardProductId(undefined);
          setInwardWarehouseId(undefined);
          setInwardBatchNo(undefined);
        }}
        onSuccess={() => loadData(true)}
        products={products}
        warehouses={warehouses}
        stocks={stocks}
        initialProductId={inwardProductId}
        initialWarehouseId={inwardWarehouseId}
        initialBatchNo={inwardBatchNo}
      />


      <StockAdjustModal
        visible={adjustModalOpen}
        onClose={() => {
          setAdjustModalOpen(false);
          setSelectedAdjustStock(null);
        }}
        onSuccess={() => loadData(true)}
        products={products}
        warehouses={warehouses}
        stocks={stocks}
        initialStockItem={selectedAdjustStock}
      />

      <AddProductModal
        visible={productFormModalOpen}
        onClose={() => {
          setProductFormModalOpen(false);
          setEditingProduct(null);
        }}
        onSuccess={() => loadData(true)}
        product={editingProduct}
        warehouses={warehouses}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  topControlContainer: {
    paddingBottom: 2,
  },
  dropdownActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 6,
  },
  actionBtn: {
    flex: 0.85,
    height: 38,
    borderRadius: 10,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  utilityBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.dark.cardElevated,
    borderRadius: 8,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  utilityBtnTextTransfer: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  utilityBtnTextAdjust: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A855F7',
  },
  resultsRow: {
    minHeight: 24,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 4,
  },
  resultsText: {
    color: Colors.dark.textTertiary,
    fontSize: 11,
  },
  clearFiltersText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
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
});
