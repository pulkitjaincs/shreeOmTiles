import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Button } from '@/components/ui/Button';
import { SearchBar } from '@/components/ui/SearchBar';
import { FilterDropdown, FilterDropdownOption } from '@/components/ui/FilterDropdown';
import { EmptyState } from '@/components/ui/EmptyState';
import { Colors } from '@/constants/theme';
import { Party } from './types';
import { CreditAgeingRow } from './CreditAgeingRow';
import { PartyCard } from './PartyCard';
import { PartyFormModal } from './PartyFormModal';
import { PartyStatementDrawer } from './PartyStatementDrawer';
import { DeletePartyModal } from './DeletePartyModal';

interface PartiesDirectoryViewProps {
  parties: Party[];
  loading: boolean;
  onRefresh: () => void;
  isOwnerOrAdmin: boolean;
  isSalesman: boolean;
}

export function PartiesDirectoryView({
  parties,
  loading,
  onRefresh,
  isOwnerOrAdmin,
  isSalesman,
}: PartiesDirectoryViewProps) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'DUES' | 'PAYABLES' | 'CLEARED'>('ALL');

  // Modal States
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [deletingParty, setDeletingParty] = useState<Party | null>(null);
  const [statementParty, setStatementParty] = useState<Party | null>(null);

  // Helper to compute party dues and payables
  const getPartyDue = (p: Party) => {
    return (p.creditLedgers || [])
      .filter((c) => c.status !== 'SETTLED')
      .reduce((sum, c) => {
        const amt = Number(c.amountDue || 0);
        return c.type === 'RECEIVABLE' ? sum + amt : sum - amt;
      }, 0);
  };

  const getPartyPayable = (p: Party) => {
    return (p.creditLedgers || [])
      .filter((c) => c.status !== 'SETTLED' && c.type === 'PAYABLE')
      .reduce((sum, c) => sum + Number(c.amountDue || 0), 0);
  };

  const duesCount = useMemo(
    () => parties.filter((p) => getPartyDue(p) > 0.01).length,
    [parties],
  );

  const payablesCount = useMemo(
    () => parties.filter((p) => getPartyDue(p) < -0.01 || getPartyPayable(p) > 0.01).length,
    [parties],
  );

  const clearedCount = useMemo(
    () => parties.filter((p) => Math.abs(getPartyDue(p)) <= 0.01 && getPartyPayable(p) <= 0.01).length,
    [parties],
  );

  const partyFilterOptions: FilterDropdownOption[] = useMemo(
    () => [
      {
        label: 'All Customers',
        value: 'ALL',
        count: parties.length,
        icon: 'people-outline',
        color: '#FFFFFF',
      },
      {
        label: 'Customer Dues',
        value: 'DUES',
        count: duesCount,
        icon: 'alert-circle-outline',
        color: '#EF4444',
      },
      {
        label: 'Store Payables',
        value: 'PAYABLES',
        count: payablesCount,
        icon: 'arrow-up-circle-outline',
        color: '#F59E0B',
      },
      {
        label: 'Cleared',
        value: 'CLEARED',
        count: clearedCount,
        icon: 'checkmark-circle-outline',
        color: '#10B981',
      },
    ],
    [parties.length, duesCount, payablesCount, clearedCount],
  );

  const filteredParties = useMemo(() => {
    const q = search.toLowerCase().trim();
    return parties.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        (p.gstin && p.gstin.toLowerCase().includes(q)) ||
        (p.address && p.address.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      const due = getPartyDue(p);
      const payable = getPartyPayable(p);
      if (filterType === 'DUES') return due > 0.01;
      if (filterType === 'PAYABLES') return due < -0.01 || payable > 0.01;
      if (filterType === 'CLEARED') return Math.abs(due) <= 0.01 && payable <= 0.01;
      return true;
    });
  }, [parties, search, filterType]);

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Customer Directory ({parties.length})</Text>
        <Text style={styles.sectionSubtitle}>
          Accounts, 360° credit ledgers & WhatsApp reminders
        </Text>
      </View>

      {/* Credit Ageing Buckets Cards (5 Cards matching Web Dashboard) */}
      <CreditAgeingRow parties={parties} />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search customer name, phone, GSTIN..."
        />
      </View>

      {/* Dropdown Filter + Add Customer Row */}
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
            title="+ Add Customer"
            icon="person-add-outline"
            size="sm"
            variant="primary"
            onPress={() => {
              setEditingParty(null);
              setFormModalOpen(true);
            }}
            style={styles.addCustomerBtn}
          />
        ) : null}
      </View>

      {/* Results Count & Reset Filter Indicator */}
      <View style={styles.resultsInfoRow}>
        <Text style={styles.resultsCountText}>
          Showing <Text style={styles.resultsCountHighlight}>{filteredParties.length}</Text> of {parties.length} customer accounts
        </Text>
        {(filterType !== 'ALL' || search.trim().length > 0) && (
          <TouchableOpacity
            onPress={() => {
              setFilterType('ALL');
              setSearch('');
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.resetFilterText}>Reset Filters</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Parties List */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading customer directory...</Text>
        </View>
      ) : filteredParties.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No Customers Found"
          description={
            search
              ? 'No customer accounts match your search filter.'
              : 'Your customer directory is currently empty.'
          }
        />
      ) : (
        filteredParties.map((party) => (
          <PartyCard
            key={party.id}
            party={party}
            onViewStatement={setStatementParty}
            onEdit={(p) => {
              setEditingParty(p);
              setFormModalOpen(true);
            }}
            onDelete={setDeletingParty}
            canEditOrDelete={!isSalesman}
          />
        ))
      )}

      {/* MODALS */}
      {/* 1. Add / Edit Customer Modal */}
      <PartyFormModal
        visible={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setEditingParty(null);
        }}
        onSuccess={onRefresh}
        party={editingParty}
      />

      {/* 2. Customer 360° Statement Drawer */}
      <PartyStatementDrawer
        party={statementParty}
        onClose={() => setStatementParty(null)}
        onPartyDeleted={onRefresh}
        canDelete={isOwnerOrAdmin}
        onEdit={(party) => {
          setStatementParty(null);
          setEditingParty(party);
          setFormModalOpen(true);
        }}
      />

      {/* 3. Delete Customer Safety Modal (Zero-due validation) */}
      <DeletePartyModal
        party={deletingParty}
        visible={Boolean(deletingParty)}
        onClose={() => setDeletingParty(null)}
        onSuccess={onRefresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  headerRow: {
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.dark.text,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  searchContainer: {
    marginTop: 4,
    marginBottom: 8,
  },
  dropdownActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  addCustomerBtn: {
    flex: 0.9,
    height: 38,
    borderRadius: 10,
  },
  resultsInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  resultsCountText: {
    fontSize: 11.5,
    color: Colors.dark.textSecondary,
  },
  resultsCountHighlight: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  resetFilterText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#38BDF8',
  },
  centerLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 8,
  },
});
