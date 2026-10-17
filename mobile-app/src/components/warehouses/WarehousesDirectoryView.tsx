import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Button } from '@/components/ui/Button';
import { SearchBar } from '@/components/ui/SearchBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Colors } from '@/constants/theme';
import { Warehouse } from './types';
import { StockItem } from '@/components/stock/types';
import { WarehouseCard } from './WarehouseCard';
import { WarehouseFormModal } from './WarehouseFormModal';
import { DeleteWarehouseModal, ZeroOutWarehouseModal } from './WarehouseDangerModals';
import { Ionicons } from '@expo/vector-icons';

interface WarehousesDirectoryViewProps {
  warehouses: Warehouse[];
  stocks?: StockItem[];
  loading: boolean;
  onRefresh: () => void;
  isOwnerOrAdmin: boolean;
}

export function WarehousesDirectoryView({
  warehouses,
  stocks = [],
  loading,
  onRefresh,
  isOwnerOrAdmin,
}: WarehousesDirectoryViewProps) {
  const [search, setSearch] = useState('');

  // Modal States
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [deletingWarehouse, setDeletingWarehouse] = useState<{
    warehouse: Warehouse;
    totalUnits: number;
  } | null>(null);
  const [zeroOutWarehouse, setZeroOutWarehouse] = useState<{
    warehouse: Warehouse;
    totalUnits: number;
  } | null>(null);

  // Compute Aggregated Statistics Across All Locations
  const totalStockUnits = useMemo(
    () => stocks.reduce((sum, s) => sum + Number(s.quantity || 0), 0),
    [stocks],
  );

  const godownCount = useMemo(
    () => warehouses.filter((w) => w.type === 'WAREHOUSE').length,
    [warehouses],
  );

  const showroomCount = useMemo(
    () => warehouses.filter((w) => w.type === 'SHOWROOM').length,
    [warehouses],
  );

  // Filter and Search logic (no horizontal list)
  const filteredWarehouses = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return warehouses;
    return warehouses.filter((wh) => {
      return (
        wh.name?.toLowerCase().includes(q) ||
        (wh.address && wh.address.toLowerCase().includes(q)) ||
        wh.type?.toLowerCase().includes(q)
      );
    });
  }, [warehouses, search]);

  return (
    <View style={styles.container}>
      {/* 1. Aggregated Summary Banner */}
      <View style={styles.summaryBanner}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Locations</Text>
          <Text style={styles.summaryValue}>{warehouses.length}</Text>
          <Text style={styles.summarySub}>
            {godownCount} Godowns • {showroomCount} Showrooms
          </Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Aggregated Stock</Text>
          <Text style={[styles.summaryValue, { color: '#10B981' }]}>
            {totalStockUnits}
          </Text>
          <Text style={styles.summarySub}>Total live units in ERP</Text>
        </View>
      </View>

      {/* 2. Action Header Row */}
      <View style={styles.actionHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>
            Locations & Godowns ({filteredWarehouses.length})
          </Text>
          <Text style={styles.sectionSubtitle}>
            Manage storage godowns, showrooms & branch stock
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={onRefresh}
            disabled={loading}
            style={styles.refreshBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="refresh-outline"
              size={18}
              color={loading ? Colors.dark.textSecondary : '#FFFFFF'}
            />
          </TouchableOpacity>
          {isOwnerOrAdmin ? (
            <Button
              title="+ Add Location"
              icon="add-circle-outline"
              size="sm"
              variant="primary"
              onPress={() => {
                setEditingWarehouse(null);
                setFormModalOpen(true);
              }}
              style={styles.addLocationBtn}
            />
          ) : null}
        </View>
      </View>

      {/* 3. Search Bar */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search location by name or address..."
        />
      </View>

      {/* Active Search Filter Reset */}
      {search.trim().length > 0 ? (
        <View style={styles.resultsInfoRow}>
          <Text style={styles.resultsCountText}>
            Showing <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{filteredWarehouses.length}</Text> of {warehouses.length} locations
          </Text>
          <TouchableOpacity
            onPress={() => setSearch('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.resetFilterText}>Clear Search</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* 4. Warehouses List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading warehouse locations...</Text>
        </View>
      ) : filteredWarehouses.length === 0 ? (
        <EmptyState
          icon="business-outline"
          title="No Locations Found"
          description={
            search.trim().length > 0
              ? 'No warehouses match your search query.'
              : 'No warehouse or showroom locations registered yet.'
          }
        />
      ) : (
        filteredWarehouses.map((wh) => (
          <WarehouseCard
            key={wh.id}
            warehouse={wh}
            stocks={stocks}
            isOwnerOrAdmin={isOwnerOrAdmin}
            onEdit={(target) => {
              setEditingWarehouse(target);
              setFormModalOpen(true);
            }}
            onZeroOut={(target, units) => {
              setZeroOutWarehouse({ warehouse: target, totalUnits: units });
            }}
            onDelete={(target, units) => {
              setDeletingWarehouse({ warehouse: target, totalUnits: units });
            }}
          />
        ))
      )}

      {/* 5. Modals */}
      <WarehouseFormModal
        visible={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setEditingWarehouse(null);
        }}
        onSuccess={onRefresh}
        warehouse={editingWarehouse}
      />

      <DeleteWarehouseModal
        visible={deletingWarehouse !== null}
        warehouse={deletingWarehouse?.warehouse || null}
        totalUnits={deletingWarehouse?.totalUnits || 0}
        onClose={() => setDeletingWarehouse(null)}
        onSuccess={onRefresh}
      />

      <ZeroOutWarehouseModal
        visible={zeroOutWarehouse !== null}
        warehouse={zeroOutWarehouse?.warehouse || null}
        totalUnits={zeroOutWarehouse?.totalUnits || 0}
        onClose={() => setZeroOutWarehouse(null)}
        onSuccess={onRefresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    paddingBottom: 16,
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.borderMedium,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 3,
    fontFamily: 'monospace',
  },
  summarySub: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 38,
    backgroundColor: Colors.dark.border,
  },
  actionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
    marginBottom: 2,
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 1,
  },
  addLocationBtn: {
    height: 38,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchContainer: {
    marginBottom: 2,
  },
  resultsInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  resultsCountText: {
    fontSize: 11.5,
    color: Colors.dark.textSecondary,
  },
  resetFilterText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#38BDF8',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
});
