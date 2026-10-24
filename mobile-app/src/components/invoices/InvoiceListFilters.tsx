import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SearchBar } from '@/components/ui/SearchBar';
import { FilterPills } from '@/components/ui/FilterPills';
import { CalendarModal } from '@/components/ui/CalendarModal';
import { useTheme, useThemedStyles } from '@/lib/theme-context';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { Ionicons } from '@expo/vector-icons';

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
  onApplyCustomDates?: (from: string, to: string) => void;
  paymentMode: string;
  onPaymentModeChange: (value: string) => void;
  staffOptions?: Array<{ label: string; value: string; icon?: any; color?: string }>;
  createdById?: string;
  onCreatedByIdChange?: (value: string) => void;
  invoiceCount: number;
  resultCount: number;
  onClear: () => void;
}

function formatPrettyDate(dateStr: string): string {
  if (!dateStr) return 'Select';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = parseInt(parts[2], 10);
  const m = parseInt(parts[1], 10);
  const y = parts[0];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1] || ''} ${y}`;
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
  onApplyCustomDates,
  paymentMode,
  onPaymentModeChange,
  staffOptions,
  createdById,
  onCreatedByIdChange,
  invoiceCount,
  resultCount,
  onClear,
}: InvoiceListFiltersProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const hasActiveFilters = Boolean(search.trim()) || status !== 'ALL' || paymentMode !== 'ALL' || (createdById && createdById !== 'ALL') || datePreset !== 'ALL' || Boolean(dateFrom || dateTo);

  const handleCalendarApply = (from: string, to: string) => {
    onDateFromChange(from);
    onDateToChange(to);
    if (onApplyCustomDates) {
      onApplyCustomDates(from, to);
    }
  };

  const handleManualApply = () => {
    if (onApplyCustomDates && dateFrom && dateTo) {
      onApplyCustomDates(dateFrom, dateTo);
    }
  };

  return (
    <>
      <SearchBar
        value={search}
        onChangeText={onSearchChange}
        placeholder="Search invoice #, customer name, phone..."
      />

      {staffOptions && staffOptions.length > 0 && onCreatedByIdChange ? (
        <View style={styles.createdByRow}>
          <FilterDropdown
            label="Created By"
            value={createdById || 'ALL'}
            options={staffOptions}
            onSelect={onCreatedByIdChange}
            hideLabelPrefix
            showCountOnTrigger
          />
        </View>
      ) : null}

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
            { label: 'Card (POS)', value: 'CARD', icon: 'card-outline', color: '#F59E0B' },
            { label: 'Credit', value: 'CREDIT', icon: 'receipt-outline', color: '#EF4444' },
            { label: 'Split (Multi)', value: 'SPLIT', icon: 'git-merge-outline', color: '#A78BFA' },
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
          onSelect={(val) => {
            onDatePresetChange(val);
            if (val === 'CUSTOM' && (!dateFrom || !dateTo)) {
              setCalendarOpen(true);
            }
          }}
        />
      </View>

      {datePreset === 'CUSTOM' ? (
        <View style={styles.customDateBar}>
          <TouchableOpacity
            style={styles.customDateTrigger}
            onPress={() => setCalendarOpen(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <Text style={styles.customDateLabel}>
              {dateFrom ? formatPrettyDate(dateFrom) : 'From'}
            </Text>
            <Ionicons name="arrow-forward" size={13} color={colors.textSecondary} />
            <Text style={styles.customDateLabel}>
              {dateTo ? formatPrettyDate(dateTo) : 'To'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.applyButton, (!dateFrom || !dateTo) && styles.applyButtonDisabled]}
            onPress={handleManualApply}
            disabled={!dateFrom || !dateTo}
            activeOpacity={0.8}
          >
            <Text style={styles.applyButtonText}>Apply</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <CalendarModal
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        initialFrom={dateFrom}
        initialTo={dateTo}
        onApply={handleCalendarApply}
        title="Select Invoices Date Range"
        mode="range"
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

const createStyles = (colors: any) =>
  StyleSheet.create({
    createdByRow: {
      paddingHorizontal: 16,
      marginBottom: 6,
    },
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
    customDateBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      gap: 8,
      marginTop: 4,
      marginBottom: 6,
    },
    customDateTrigger: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.borderMedium,
      borderRadius: 9,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    customDateLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    applyButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 9,
      justifyContent: 'center',
      alignItems: 'center',
    },
    applyButtonDisabled: {
      opacity: 0.5,
    },
    applyButtonText: {
      color: colors.primaryForeground,
      fontSize: 12,
      fontWeight: '800',
    },
    resultsRow: {
      minHeight: 30,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 2,
    },
    resultsText: { color: colors.textTertiary, fontSize: 11 },
    clearFilters: { color: '#38BDF8', fontSize: 11, fontWeight: '700' },
  });
