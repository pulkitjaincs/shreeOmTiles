import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Button } from '@/components/ui/Button';
import { SearchBar } from '@/components/ui/SearchBar';
import { FilterPills } from '@/components/ui/FilterPills';
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
  const [filterType, setFilterType] = useState<'ALL' | 'DUES' | 'CLEARED'>('ALL');

  // Modal States
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [deletingParty, setDeletingParty] = useState<Party | null>(null);
  const [statementParty, setStatementParty] = useState<Party | null>(null);

  // Helper to compute party dues
  const getPartyDue = (p: Party) => {
    return (p.creditLedgers || [])
      .filter((c) => c.status !== 'SETTLED')
      .reduce((sum, c) => {
        const amt = Number(c.amountDue || 0);
        return c.type === 'RECEIVABLE' ? sum + amt : sum - amt;
      }, 0);
  };

  const duesCount = useMemo(
    () => parties.filter((p) => getPartyDue(p) > 0.01).length,
    [parties],
  );

  const clearedCount = useMemo(
    () => parties.filter((p) => getPartyDue(p) <= 0.01).length,
    [parties],
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
      if (filterType === 'DUES') return due > 0.01;
      if (filterType === 'CLEARED') return due <= 0.01;
      return true;
    });
  }, [parties, search, filterType]);

  return (
    <View style={styles.container}>
      {/* Action Header Row */}
      <View style={styles.actionHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Customer Directory ({parties.length})</Text>
          <Text style={styles.sectionSubtitle}>
            Accounts, 360° credit ledgers & WhatsApp reminders
          </Text>
        </View>

        {!isSalesman ? (
          <Button
            title="+ Add Customer"
            size="sm"
            variant="primary"
            onPress={() => {
              setEditingParty(null);
              setFormModalOpen(true);
            }}
          />
        ) : null}
      </View>

      {/* Credit Ageing Buckets Cards (5 Cards matching Web Dashboard) */}
      <CreditAgeingRow parties={parties} />

      {/* Filter Pills */}
      <View style={styles.filterPillsContainer}>
        <FilterPills
          options={[
            { label: `All (${parties.length})`, value: 'ALL' },
            { label: `With Dues (${duesCount})`, value: 'DUES' },
            { label: `Cleared (${clearedCount})`, value: 'CLEARED' },
          ]}
          selected={filterType}
          onSelect={(val) => setFilterType(val as any)}
        />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search by customer name, phone, GSTIN..."
        />
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
  actionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  filterPillsContainer: {
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 4,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginVertical: 6,
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
