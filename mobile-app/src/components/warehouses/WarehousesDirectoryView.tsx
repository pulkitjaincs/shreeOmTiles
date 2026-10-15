import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Button } from '@/components/ui/Button';
import { SearchBar } from '@/components/ui/SearchBar';
import { FilterPills } from '@/components/ui/FilterPills';
import { EmptyState } from '@/components/ui/EmptyState';
import { Colors } from '@/constants/theme';
import { Warehouse } from './types';
import { StockItem } from '@/components/stock/types';
import { WarehouseCard } from './WarehouseCard';
import { WarehouseFormModal } from './WarehouseFormModal';
import { DeleteWarehouseModal, ZeroOutWarehouseModal } from './WarehouseDangerModals';

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
  const [filterType, setFilterType] = useState<'ALL' | 'WAREHOUSE' | 'SHOWROOM'>('ALL');

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

  // Filter and Search logic
  const filteredWarehouses = useMemo(() => {
    const q = search.toLowerCase().trim();
    return warehouses.filter((wh) => {
      const matchesSearch =
        wh.name?.toLowerCase().includes(q) ||
        (wh.address && wh.address.toLowerCase().includes(q));

      const matchesType =
        filterType === 'ALL' ||
        (filterType === 'WAREHOUSE' && wh.type === 'WAREHOUSE') ||
        (filterType === 'SHOWROOM' && wh.type === 'SHOWROOM');

      return matchesSearch && matchesType;
    });
  }, [warehouses, search, filterType]);

  const filterOptions = [
    { label: `All (${warehouses.length})`, value: 'ALL' },
    { label: `Godowns (${godownCount})`, value: 'WAREHOUSE' },
    { label: `Showrooms (${showroomCount})`, value: 'SHOWROOM' },
  ];

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
        <Text style={styles.sectionTitle}>
          Locations & Godowns ({filteredWarehouses.length})
        </Text>
        {isOwnerOrAdmin ? (
          <Button
            title="+ Add Location"
            size="sm"
            variant="primary"
            onPress={() => {
              setEditingWarehouse(null);
              setFormModalOpen(true);
            }}
          />
        ) : null}
      </View>

      {/* 3. Search and Filter Bar */}
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search location by name or address..."
      />

      <View style={styles.filterPillsRow}>
        <FilterPills
          options={filterOptions}
          selected={filterType}
          onSelect={(val) => setFilterType(val as any)}
        />
      </View>

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
            search || filterType !== 'ALL'
              ? 'No warehouses match the selected filters.'
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
    gap: 12,
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  summarySub: {
    fontSize: 10.5,
    color: Colors.dark.textTertiary,
    marginTop: 3,
  },
  summaryDivider: {
    width: 1,
    height: 42,
    backgroundColor: Colors.dark.border,
  },
  actionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  filterPillsRow: {
    marginBottom: 4,
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
