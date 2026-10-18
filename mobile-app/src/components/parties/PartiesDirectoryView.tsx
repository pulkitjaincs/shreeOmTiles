import React, { useState, useMemo, useCallback, useDeferredValue } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Platform,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { SearchBar } from '@/components/ui/SearchBar';
import { FilterDropdown, FilterDropdownOption } from '@/components/ui/FilterDropdown';
import { FilterPills } from '@/components/ui/FilterPills';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ThemeColors } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/lib/theme-context';
import { Party } from './types';
import { CreditAgeingRow } from './CreditAgeingRow';
import { PartyCard } from './PartyCard';
import { PartyFormModal } from './PartyFormModal';
import { PartyStatementDrawer } from './PartyStatementDrawer';
import { DeletePartyModal } from './DeletePartyModal';
import {
  PartyRow,
  PartyDueFilter,
  PartyRegFilter,
  buildPartyRows,
  countRows,
  filterPartyRows,
} from './partyRows';
import { Ionicons } from '@expo/vector-icons';

interface PartiesDirectoryViewProps {
  parties: Party[];
  loading: boolean;
  onRefresh: () => void;
  isOwnerOrAdmin: boolean;
  isSalesman: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function PartiesDirectoryView({
  parties,
  loading,
  onRefresh,
  isOwnerOrAdmin,
  isSalesman,
  error,
  onRetry,
}: PartiesDirectoryViewProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<PartyDueFilter>('ALL');
  const [regFilter, setRegFilter] = useState<PartyRegFilter>('ALL');

  // Modal States
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [deletingParty, setDeletingParty] = useState<Party | null>(null);
  const [statementParty, setStatementParty] = useState<Party | null>(null);

  // Precompute rows & counts once per data load
  const rows = useMemo(() => buildPartyRows(parties), [parties]);
  const counts = useMemo(() => countRows(rows), [rows]);

  // Keep search bar smooth and responsive even with thousands of accounts
  const deferredSearch = useDeferredValue(search);

  const regFilterOptions = useMemo(
    () => [
      { label: 'All Accounts', value: 'ALL' as const, count: counts.total },
      { label: 'Saved Directory', value: 'REGISTERED' as const, count: counts.registered },
      { label: 'Walk-ins', value: 'UNREGISTERED' as const, count: counts.unregistered },
    ],
    [counts],
  );

  const partyFilterOptions: FilterDropdownOption[] = useMemo(
    () => [
      {
        label: 'All Parties',
        value: 'ALL',
        count: counts.total,
        icon: 'people-outline',
        color: colors.text,
      },
      {
        label: 'Customer Dues',
        value: 'DUES',
        count: counts.dues,
        icon: 'alert-circle-outline',
        color: '#EF4444',
      },
      {
        label: 'Store Payables',
        value: 'PAYABLES',
        count: counts.payables,
        icon: 'arrow-up-circle-outline',
        color: '#F59E0B',
      },
      {
        label: 'Cleared',
        value: 'CLEARED',
        count: counts.cleared,
        icon: 'checkmark-circle-outline',
        color: '#10B981',
      },
    ],
    [counts, colors.text],
  );

  const filteredRows = useMemo(
    () => filterPartyRows(rows, { search: deferredSearch, dueFilter: filterType, regFilter }),
    [rows, deferredSearch, filterType, regFilter],
  );

  const keyExtractor = useCallback(
    (item: PartyRow, index: number) => item.party.id || `party-${item.phone || index}`,
    [],
  );

  const handleEditParty = useCallback((p: Party) => {
    setEditingParty(p);
    setFormModalOpen(true);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: PartyRow }) => (
      <PartyCard
        party={item.party}
        due={item.due}
        payable={item.payable}
        onViewStatement={setStatementParty}
        onEdit={handleEditParty}
        onDelete={setDeletingParty}
        canEdit={!isSalesman}
        canDelete={isOwnerOrAdmin}
      />
    ),
    [isSalesman, isOwnerOrAdmin, handleEditParty],
  );

  const handleResetFilters = useCallback(() => {
    setFilterType('ALL');
    setRegFilter('ALL');
    setSearch('');
  }, []);

  // Aging row only re-computes when parties array changes, immune to search typing
  const renderAgingHeader = useMemo(() => {
    return (
      <View style={styles.agingWrapper}>
        {error && rows.length > 0 ? (
          <Text style={styles.staleText}>Couldn&apos;t refresh. Showing last loaded data.</Text>
        ) : null}
        <CreditAgeingRow parties={parties || []} />
      </View>
    );
  }, [parties, error, rows.length, styles.agingWrapper, styles.staleText]);

  const renderEmpty = useMemo(() => {
    if (error && rows.length === 0) {
      return (
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't Load Parties"
          description={error}
          actionTitle="Try Again"
          onAction={onRetry ?? onRefresh}
        />
      );
    }
    const isFiltered = search.trim().length > 0 || filterType !== 'ALL' || regFilter !== 'ALL';
    return (
      <EmptyState
        icon="people-outline"
        title={isFiltered ? 'No Matching Parties' : 'No Parties Found'}
        description={
          isFiltered
            ? 'No party accounts match your active search or filters.'
            : 'Your customer and supplier party directory is currently empty.'
        }
        actionTitle={
          isFiltered
            ? 'Reset Filters'
            : !isSalesman
            ? '+ Add Party'
            : undefined
        }
        onAction={
          isFiltered
            ? handleResetFilters
            : !isSalesman
            ? () => {
                setEditingParty(null);
                setFormModalOpen(true);
              }
            : undefined
        }
      />
    );
  }, [error, rows.length, onRetry, onRefresh, search, filterType, regFilter, isSalesman, handleResetFilters]);

  return (
    <View style={styles.container}>
      {/* 1. TOP CONTROLS (Pinned above FlatList: SearchBar never unmounts, keyboard never loses focus) */}
      <View style={styles.topControls}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Customer & Supplier Parties ({counts.total})</Text>
            <Text style={styles.sectionSubtitle}>
              Accounts, 360° statements & credit balances
            </Text>
          </View>
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
              color={loading ? colors.textSecondary : colors.text}
            />
          </TouchableOpacity>
        </View>

        {/* Search Bar - pinned outside FlatList */}
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, phone, address, or GSTIN..."
          style={styles.searchBarOverride}
        />

        {/* Registration Status Filter Pills */}
        <View style={styles.filterPillsWrapper}>
          <FilterPills
            options={regFilterOptions}
            selected={regFilter}
            onSelect={(val) => setRegFilter(val as 'ALL' | 'REGISTERED' | 'UNREGISTERED')}
          />
        </View>

        {/* Dropdown Filter + Add Party Row */}
        <View style={styles.dropdownActionRow}>
          <FilterDropdown
            label="Parties"
            value={filterType}
            options={partyFilterOptions}
            onSelect={(val) => setFilterType(val as 'ALL' | 'DUES' | 'PAYABLES' | 'CLEARED')}
            icon="funnel-outline"
            containerStyle={{ flex: 1.15 }}
            showCountOnTrigger
          />

          {!isSalesman ? (
            <Button
              title="+ Add Party"
              icon="person-add-outline"
              size="sm"
              variant="primary"
              onPress={() => {
                setEditingParty(null);
                setFormModalOpen(true);
              }}
              style={styles.addPartyBtn}
            />
          ) : null}
        </View>

        {/* Results Count & Reset Filter Indicator */}
        <View style={styles.resultsInfoRow}>
          <Text style={styles.resultsCountText}>
            Showing <Text style={styles.resultsCountHighlight}>{filteredRows.length}</Text> of {counts.total} party accounts
          </Text>
          {(filterType !== 'ALL' || regFilter !== 'ALL' || search.trim().length > 0) && (
            <TouchableOpacity
              onPress={handleResetFilters}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.resetFilterText}>Reset Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. MAIN CONTENT AREA: Center spinner on initial empty load, else virtualized FlatList */}
      {loading && rows.length === 0 ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading party directory & credit ledgers...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRows}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={renderAgingHeader}
          ListEmptyComponent={renderEmpty}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== 'web'}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={loading && rows.length > 0}
              onRefresh={onRefresh}
              tintColor="#FFFFFF"
            />
          }
        />
      )}

      {/* MODALS - Conditionally mounted single instances */}
      {/* 1. Add / Edit Customer Modal */}
      {formModalOpen && (
        <PartyFormModal
          visible={formModalOpen}
          onClose={() => {
            setFormModalOpen(false);
            setEditingParty(null);
          }}
          onSuccess={onRefresh}
          party={editingParty}
        />
      )}

      {/* 2. Customer 360° Statement Drawer */}
      {Boolean(statementParty?.id) && (
        <PartyStatementDrawer
          visible={Boolean(statementParty?.id)}
          party={statementParty}
          onClose={() => setStatementParty(null)}
          onPartyDeleted={onRefresh}
          canDelete={isOwnerOrAdmin}
          onEdit={
            !isSalesman
              ? (party) => {
                  setStatementParty(null);
                  setEditingParty(party);
                  setFormModalOpen(true);
                }
              : undefined
          }
          onDelete={
            isOwnerOrAdmin
              ? (party) => {
                  setStatementParty(null);
                  setDeletingParty(party);
                }
              : undefined
          }
        />
      )}

      {/* 3. Delete Customer Safety Modal (Zero-due validation) */}
      {Boolean(deletingParty?.id) && (
        <DeletePartyModal
          party={deletingParty}
          visible={Boolean(deletingParty?.id)}
          onClose={() => setDeletingParty(null)}
          onSuccess={onRefresh}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    topControls: {
      paddingHorizontal: 16,
      paddingTop: 8,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
      paddingHorizontal: 2,
    },
    refreshBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.cardHover,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.3,
    },
    sectionSubtitle: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    searchBarOverride: {
      marginHorizontal: 0,
      marginTop: 6,
      marginBottom: 8,
    },
    filterPillsWrapper: {
      marginHorizontal: -16,
      marginVertical: -2,
      marginBottom: 6,
    },
    dropdownActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    addPartyBtn: {
      flex: 0.9,
      height: 38,
      borderRadius: 10,
    },
    resultsInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
      paddingHorizontal: 2,
    },
    resultsCountText: {
      fontSize: 11.5,
      color: colors.textSecondary,
    },
    resultsCountHighlight: {
      color: colors.text,
      fontWeight: '800',
    },
    resetFilterText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: '#38BDF8',
    },
    agingWrapper: {
      marginBottom: 8,
    },
    staleText: {
      fontSize: 11,
      color: '#F59E0B',
      marginBottom: 6,
      paddingHorizontal: 2,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 95,
    },
    centerLoading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    loadingText: {
      fontSize: 12.5,
      color: colors.textSecondary,
      marginTop: 12,
    },
  });
