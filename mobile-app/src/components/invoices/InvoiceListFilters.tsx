import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SearchBar } from '@/components/ui/SearchBar';
import { FilterPills } from '@/components/ui/FilterPills';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/theme';

import { FilterDropdown } from '@/components/ui/FilterDropdown';

interface InvoiceListFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  datePreset: string;
  onDatePresetChange: (value: string) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  paymentMode: string;
  onPaymentModeChange: (value: string) => void;
  invoiceCount: number;
  resultCount: number;
  onClear: () => void;
}

export function InvoiceListFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  datePreset,
  onDatePresetChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  paymentMode,
  onPaymentModeChange,
  invoiceCount,
  resultCount,
  onClear,
}: InvoiceListFiltersProps) {
  const hasActiveFilters = Boolean(search.trim()) || status !== 'ALL' || paymentMode !== 'ALL' || datePreset !== 'ALL' || Boolean(dateFrom || dateTo);

  return (
    <>
      <SearchBar
        value={search}
        onChangeText={onSearchChange}
        placeholder="Search invoice #, customer name, phone..."
      />

      {/* Line 1: Status Dropdown & Payment Mode Dropdown in one line */}
      <View style={styles.dropdownsRow}>
        <FilterDropdown
          label="Status"
          value={status}
          options={[
            { label: 'All Bills', value: 'ALL', count: invoiceCount, icon: 'receipt-outline' },
            { label: 'Paid', value: 'PAID', icon: 'checkmark-circle-outline', color: '#10B981' },
            { label: 'Partial', value: 'PARTIAL', icon: 'time-outline', color: '#F59E0B' },
            { label: 'Created', value: 'CREATED', icon: 'document-outline', color: '#38BDF8' },
            { label: 'Refunds', value: 'REFUNDED', icon: 'return-up-back-outline', color: '#F43F5E' },
          ]}
          onSelect={onStatusChange}
          icon="receipt-outline"
        />

        <FilterDropdown
          label="Mode"
          value={paymentMode}
          options={[
            { label: 'All Modes', value: 'ALL', icon: 'wallet-outline' },
            { label: 'UPI QR', value: 'UPI', icon: 'qr-code-outline', color: '#38BDF8' },
            { label: 'Cash', value: 'CASH', icon: 'cash-outline', color: '#10B981' },
            { label: 'Credit', value: 'CREDIT', icon: 'card-outline', color: '#EF4444' },
            { label: 'Cheque', value: 'CHEQUE', icon: 'document-text-outline', color: '#F59E0B' },
          ]}
          onSelect={onPaymentModeChange}
          icon="wallet-outline"
        />
      </View>

      {/* Line 2: Timing Date Preset FilterPills */}
      <View style={styles.datePillsContainer}>
        <FilterPills
          options={[
            { label: 'All Time', value: 'ALL' },
            { label: 'Today', value: 'TODAY' },
            { label: 'Yesterday', value: 'YESTERDAY' },
            { label: 'This Week', value: 'THIS_WEEK' },
            { label: 'This Month', value: 'THIS_MONTH' },
            { label: 'Custom Range', value: 'CUSTOM' },
          ]}
          selected={datePreset}
          onSelect={onDatePresetChange}
        />
      </View>

      {datePreset === 'CUSTOM' ? (
        <View style={styles.customDateRow}>
          <View style={{ flex: 1 }}>
            <Input label="From (YYYY-MM-DD)" placeholder="2026-01-01" value={dateFrom} onChangeText={onDateFromChange} />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="To (YYYY-MM-DD)" placeholder="2026-01-31" value={dateTo} onChangeText={onDateToChange} />
          </View>
        </View>
      ) : null}

      <View style={styles.resultsRow}>
        <Text style={styles.resultsText}>Showing {resultCount} of {invoiceCount} invoices</Text>
        {hasActiveFilters ? (
          <TouchableOpacity onPress={onClear} hitSlop={8}>
            <Text style={styles.clearFilters}>Clear filters</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  dropdownsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 2,
  },
  datePillsContainer: {
    marginTop: -4,
    marginBottom: -4,
  },
  customDateRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 6,
    marginBottom: 6,
  },
  resultsRow: {
    minHeight: 30,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  resultsText: { color: Colors.dark.textTertiary, fontSize: 11 },
  clearFilters: { color: '#38BDF8', fontSize: 11, fontWeight: '700' },
});
