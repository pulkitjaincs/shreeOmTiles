import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, useThemedStyles } from '@/lib/theme-context';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FilterPills } from '@/components/ui/FilterPills';
import { Input } from '@/components/ui/Input';
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
          onSelect={(val) => setPreset(val)}
        />
      </View>

      {preset === 'custom' && (
        <Card style={styles.customDateCard}>
          <View style={styles.customDateHeader}>
            <Ionicons name="calendar-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.customDateTitle}>Select Custom Date Range</Text>
          </View>
          <View style={styles.customDateInputsRow}>
            <View style={{ flex: 1 }}>
              <Input
                label="From (YYYY-MM-DD)"
                value={dateFrom}
                onChangeText={setDateFrom}
                placeholder="2026-01-01"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="To (YYYY-MM-DD)"
                value={dateTo}
                onChangeText={setDateTo}
                placeholder="2026-01-31"
              />
            </View>
          </View>
          <Button
            title="Apply Range"
            size="sm"
            variant="primary"
            onPress={onApplyDateRange}
            style={{ marginTop: 8 }}
          />
        </Card>
      )}
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
    customDateInputsRow: {
      flexDirection: 'row',
      gap: 10,
    },
  });
