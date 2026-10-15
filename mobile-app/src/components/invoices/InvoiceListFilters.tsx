import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SearchBar } from '@/components/ui/SearchBar';
import { FilterPills } from '@/components/ui/FilterPills';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/theme';

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
      <FilterPills
        options={[
          { label: 'All Bills', value: 'ALL', count: invoiceCount },
          { label: 'Paid', value: 'PAID' },
          { label: 'Partial', value: 'PARTIAL' },
          { label: 'Created', value: 'CREATED' },
        ]}
        selected={status}
        onSelect={onStatusChange}
      />
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
      {datePreset === 'CUSTOM' ? (
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Input label="From (YYYY-MM-DD)" placeholder="2026-01-01" value={dateFrom} onChangeText={onDateFromChange} />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="To (YYYY-MM-DD)" placeholder="2026-01-31" value={dateTo} onChangeText={onDateToChange} />
          </View>
        </View>
      ) : null}
      <FilterPills
        options={[
          { label: 'All Modes', value: 'ALL' },
          { label: 'UPI', value: 'UPI' },
          { label: 'Cash', value: 'CASH' },
          { label: 'Credit', value: 'CREDIT' },
          { label: 'Cheque', value: 'CHEQUE' },
        ]}
        selected={paymentMode}
        onSelect={onPaymentModeChange}
      />
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
  resultsRow: {
    minHeight: 30,
    paddingHorizontal: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  resultsText: { color: Colors.dark.textTertiary, fontSize: 11 },
  clearFilters: { color: Colors.dark.primary, fontSize: 11, fontWeight: '700' as const },
});
