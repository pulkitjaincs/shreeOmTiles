import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { mobileApiRequest, cachedMobileApiRequest } from '@/lib/api';
import { Colors } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { SearchBar } from '@/components/ui/SearchBar';
import { FilterPills } from '@/components/ui/FilterPills';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Product,
  Warehouse,
  StockItem,
  WarehouseStockCard,
  ProductCatalogCard,
  StockTabBar,
  StockActionsBar,
  InwardStockModal,
  StockTransferModal,
  StockAdjustModal,
  AddProductModal,
} from '@/components/stock';

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
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedWarehouse, setSelectedWarehouse] = useState('ALL');

  // Modals state
  const [inwardModalOpen, setInwardModalOpen] = useState(false);
  const [inwardProductId, setInwardProductId] = useState<string | undefined>(undefined);
  const [inwardWarehouseId, setInwardWarehouseId] = useState<string | undefined>(undefined);
  const [inwardBatchNo, setInwardBatchNo] = useState<string | undefined>(undefined);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedTransferStock, setSelectedTransferStock] = useState<StockItem | null>(null);
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
    const q = search.toLowerCase().trim();
    return stocks.filter((s) => {
      const matchesWarehouse =
        selectedWarehouse === 'ALL' || s.warehouseId === selectedWarehouse;
      const matchesSearch =
        s.product?.name?.toLowerCase().includes(q) ||
        s.product?.category?.toLowerCase().includes(q) ||
        s.warehouse?.name?.toLowerCase().includes(q) ||
        (s.batchNo && s.batchNo.toLowerCase().includes(q));
      return matchesWarehouse && matchesSearch;
    });
  }, [stocks, search, selectedWarehouse]);

  const warehouseOptions = useMemo(() => {
    return [
      { label: `All Godowns (${stocks.length})`, value: 'ALL' },
      ...warehouses.map((w) => ({
        label: `${w.name} (${stocks.filter((s) => s.warehouseId === w.id).length})`,
        value: w.id,
      })),
    ];
  }, [warehouses, stocks]);

  const categoryOptions = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
    return [
      { label: `All (${products.length})`, value: 'ALL' },
      ...cats.map((c) => ({
        label: `${c} (${products.filter((p) => p.category === c).length})`,
        value: c,
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
        subtitle="Warehouse Ledgers & Product Catalog"
        rightAction={
          isOwnerOrAdmin
            ? {
                icon: 'add',
                onPress: () => {
                  if (activeTab === 'STOCK') {
                    setInwardProductId(undefined);
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

      {/* View Switcher Tabs (Live Stock vs Product Catalog) */}
      <StockTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        stockCount={stocks.length}
        productCount={products.length}
      />

      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder={
          activeTab === 'STOCK'
            ? 'Search product, warehouse, batch...'
            : 'Search product catalog, category, HSN...'
        }
      />

      {/* Warehouse Filter Pills for Live Stock */}
      {activeTab === 'STOCK' && warehouseOptions.length > 1 ? (
        <View style={styles.categoryPillsContainer}>
          <FilterPills
            options={warehouseOptions}
            selected={selectedWarehouse}
            onSelect={setSelectedWarehouse}
          />
        </View>
      ) : null}

      {/* Category Filter Pills for Product Catalog */}
      {activeTab === 'PRODUCTS' && categoryOptions.length > 1 ? (
        <View style={styles.categoryPillsContainer}>
          <FilterPills
            options={categoryOptions}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </View>
      ) : null}

      {/* Stock Management Actions for Owner/Admin */}
      {isOwnerOrAdmin && activeTab === 'STOCK' ? (
        <StockActionsBar
          onInward={() => {
            setInwardProductId(undefined);
            setInwardModalOpen(true);
          }}
          onTransfer={() => setTransferModalOpen(true)}
          onAdjust={() => setAdjustModalOpen(true)}
        />
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
            <WarehouseStockCard
              item={item}
              isOwnerOrAdmin={isOwnerOrAdmin}
              onInward={(stock) => {
                setInwardProductId(stock.productId);
                setInwardWarehouseId(stock.warehouseId);
                setInwardBatchNo(stock.batchNo);
                setInwardModalOpen(true);
              }}
              onTransfer={(stock) => {
                setSelectedTransferStock(stock);
                setTransferModalOpen(true);
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

      <StockTransferModal
        visible={transferModalOpen}
        onClose={() => {
          setTransferModalOpen(false);
          setSelectedTransferStock(null);
        }}
        onSuccess={() => loadData(true)}
        products={products}
        warehouses={warehouses}
        stocks={stocks}
        initialStockItem={selectedTransferStock}
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
  categoryPillsContainer: {
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
});
