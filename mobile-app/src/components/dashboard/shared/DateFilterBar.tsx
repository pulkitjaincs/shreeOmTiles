import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme, useThemedStyles } from '@/lib/theme-context';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FilterPills } from '@/components/ui/FilterPills';
import { CalendarModal } from '@/components/ui/CalendarModal';
import { Ionicons } from '@expo/vector-icons';
import { DatePreset } from '../types';

interface DateFilterBarProps {
  preset: DatePreset;
  setPreset: (preset: DatePreset) => void;
  dateFrom: string;
  dateTo: string;
  setDateFrom: (value: string) => void;
  setDateTo: (value: string) => void;
  onApplyDateRange: () => void;
}

function formatPretty(dateStr: string): string {
  if (!dateStr) return 'Not set';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = parseInt(parts[2], 10);
  const m = parseInt(parts[1], 10);
  const y = parts[0];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1] || ''} ${y}`;
}

export function DateFilterBar({
  preset,
  setPreset,
  dateFrom,
  dateTo,
  setDateFrom,
  setDateTo,
  onApplyDateRange,
}: DateFilterBarProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handleCalendarApply = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
    onApplyDateRange();
  };

  return (
    <View style={styles.container}>
      <View style={styles.pillsWrapper}>
        <FilterPills<DatePreset>
          options={[
            { label: 'Today', value: 'today' },
            { label: '7 Days', value: '7d' },
            { label: '30 Days', value: '30d' },
            { label: 'This Month', value: 'month' },
            { label: 'All Time', value: 'all' },
            { label: 'Custom', value: 'custom' },
          ]}
          selected={preset}
          onSelect={(val) => {
            setPreset(val);
            if (val === 'custom' && (!dateFrom || !dateTo)) {
              setCalendarOpen(true);
            }
          }}
        />
      </View>

      {preset === 'custom' && (
        <Card style={styles.customDateCard}>
          <View style={styles.customDateHeader}>
            <Ionicons name="calendar" size={15} color={colors.primary} />
            <Text style={styles.customDateTitle}>Custom Date Range</Text>
          </View>

          <TouchableOpacity
            style={styles.dateSelectorTrigger}
            onPress={() => setCalendarOpen(true)}
            activeOpacity={0.7}
          >
            <View style={styles.dateCol}>
              <Text style={styles.dateColLabel}>FROM</Text>
              <Text style={styles.dateColValue}>{formatPretty(dateFrom)}</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />
            <View style={styles.dateCol}>
              <Text style={styles.dateColLabel}>TO</Text>
              <Text style={styles.dateColValue}>{formatPretty(dateTo)}</Text>
            </View>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          </TouchableOpacity>

          <View style={styles.actionsRow}>
            <Button
              title="Pick Dates"
              size="sm"
              variant="secondary"
              onPress={() => setCalendarOpen(true)}
              style={{ flex: 1 }}
            />
            <Button
              title="Apply Range"
              size="sm"
              variant="primary"
              disabled={!dateFrom || !dateTo}
              onPress={onApplyDateRange}
              style={{ flex: 1.2 }}
            />
          </View>
        </Card>
      )}

      <CalendarModal
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        initialFrom={dateFrom}
        initialTo={dateTo}
        onApply={handleCalendarApply}
        title="Select Dashboard Date Range"
        mode="range"
      />
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      marginBottom: 6,
    },
    pillsWrapper: {
      marginHorizontal: -16,
    },
    customDateCard: {
      padding: 14,
      backgroundColor: colors.cardElevated,
      borderWidth: 1,
      borderColor: colors.borderMedium,
      marginBottom: 8,
    },
    customDateHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10,
    },
    customDateTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    dateSelectorTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.borderMedium,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 10,
    },
    dateCol: {
      flex: 1,
    },
    dateColLabel: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    dateColValue: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 8,
    },
  });
