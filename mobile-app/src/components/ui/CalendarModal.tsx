import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal } from './BottomSheetModal';
import { Button } from './Button';
import { useTheme, useThemedStyles } from '@/lib/theme-context';

export interface CalendarModalProps {
  visible: boolean;
  onClose: () => void;
  initialFrom?: string; // YYYY-MM-DD
  initialTo?: string;   // YYYY-MM-DD
  onApply: (from: string, to: string) => void;
  title?: string;
  mode?: 'range' | 'single';
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEK_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatDateString(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function formatReadable(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const monthAbbr = MONTH_NAMES[m - 1]?.slice(0, 3) || '';
  return `${d} ${monthAbbr} ${y}`;
}

export function CalendarModal({
  visible,
  onClose,
  initialFrom = '',
  initialTo = '',
  onApply,
  title = 'Select Date Range',
  mode = 'range',
}: CalendarModalProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const todayStr = useMemo(() => {
    const now = new Date();
    return formatDateString(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const [viewYear, setViewYear] = useState(() => {
    if (initialFrom) {
      const y = parseInt(initialFrom.slice(0, 4), 10);
      if (!isNaN(y)) return y;
    }
    return new Date().getFullYear();
  });

  const [viewMonth, setViewMonth] = useState(() => {
    if (initialFrom) {
      const m = parseInt(initialFrom.slice(5, 7), 10) - 1;
      if (!isNaN(m)) return m;
    }
    return new Date().getMonth();
  });

  const [startDate, setStartDate] = useState(initialFrom);
  const [endDate, setEndDate] = useState(initialTo);

  useEffect(() => {
    if (visible) {
      setStartDate(initialFrom);
      setEndDate(initialTo);
      if (initialFrom) {
        const y = parseInt(initialFrom.slice(0, 4), 10);
        const m = parseInt(initialFrom.slice(5, 7), 10) - 1;
        if (!isNaN(y) && !isNaN(m)) {
          setViewYear(y);
          setViewMonth(m);
        }
      } else {
        const now = new Date();
        setViewYear(now.getFullYear());
        setViewMonth(now.getMonth());
      }
    }
  }, [visible, initialFrom, initialTo]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleDayPress = (dateStr: string) => {
    if (mode === 'single') {
      setStartDate(dateStr);
      setEndDate(dateStr);
      return;
    }

    if (!startDate || (startDate && endDate)) {
      setStartDate(dateStr);
      setEndDate('');
    } else if (startDate && !endDate) {
      if (dateStr < startDate) {
        setStartDate(dateStr);
        setEndDate(startDate);
      } else {
        setEndDate(dateStr);
      }
    }
  };

  const handleApplyPreset = (preset: 'today' | 'yesterday' | 'week' | 'month' | '30d') => {
    const now = new Date();
    const today = formatDateString(now.getFullYear(), now.getMonth(), now.getDate());

    if (preset === 'today') {
      setStartDate(today);
      setEndDate(today);
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = formatDateString(y.getFullYear(), y.getMonth(), y.getDate());
      setStartDate(yStr);
      setEndDate(yStr);
      setViewYear(y.getFullYear());
      setViewMonth(y.getMonth());
    } else if (preset === 'week') {
      const w = new Date(now);
      w.setDate(w.getDate() - ((w.getDay() + 6) % 7));
      const wStr = formatDateString(w.getFullYear(), w.getMonth(), w.getDate());
      setStartDate(wStr);
      setEndDate(today);
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    } else if (preset === 'month') {
      const mStr = formatDateString(now.getFullYear(), now.getMonth(), 1);
      setStartDate(mStr);
      setEndDate(today);
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    } else if (preset === '30d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      const dStr = formatDateString(d.getFullYear(), d.getMonth(), d.getDate());
      setStartDate(dStr);
      setEndDate(today);
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    }
  };

  const handleApply = () => {
    if (mode === 'single') {
      onApply(startDate || todayStr, startDate || todayStr);
    } else {
      const finalFrom = startDate || todayStr;
      const finalTo = endDate || finalFrom;
      onApply(finalFrom, finalTo);
    }
    onClose();
  };

  // Calendar matrix calculation
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    // Monday as index 0: 0=Mon, 1=Tue, ..., 6=Sun
    const firstDayIndex = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;

    const cells: Array<{ day: number; dateStr: string } | null> = [];
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({
        day,
        dateStr: formatDateString(viewYear, viewMonth, day),
      });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const canApply = Boolean(startDate);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={mode === 'range' ? 'Select start and end dates' : 'Select a date'}
      maxHeightPercent={0.88}
    >
      <ScrollView contentContainerStyle={styles.container} bounces={false}>
        {/* Quick Presets */}
        {mode === 'range' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsRow}>
            <TouchableOpacity style={styles.presetChip} onPress={() => handleApplyPreset('today')}>
              <Text style={styles.presetChipText}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => handleApplyPreset('yesterday')}>
              <Text style={styles.presetChipText}>Yesterday</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => handleApplyPreset('week')}>
              <Text style={styles.presetChipText}>This Week</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => handleApplyPreset('month')}>
              <Text style={styles.presetChipText}>This Month</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => handleApplyPreset('30d')}>
              <Text style={styles.presetChipText}>Last 30 Days</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Selected Range Display Header */}
        <View style={styles.selectionSummaryCard}>
          <View style={styles.selectionColumn}>
            <Text style={styles.selectionLabel}>START DATE</Text>
            <Text style={styles.selectionValue}>
              {startDate ? formatReadable(startDate) : 'Select Start'}
            </Text>
          </View>
          {mode === 'range' && (
            <>
              <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} style={{ marginTop: 12 }} />
              <View style={styles.selectionColumn}>
                <Text style={styles.selectionLabel}>END DATE</Text>
                <Text style={styles.selectionValue}>
                  {endDate ? formatReadable(endDate) : startDate ? 'Select End' : '—'}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Month Navigation Header */}
        <View style={styles.monthNavRow}>
          <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </Text>
          <TouchableOpacity onPress={handleNextMonth} style={styles.navButton} hitSlop={8}>
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Days of Week Row */}
        <View style={styles.weekDaysRow}>
          {WEEK_DAYS.map((wd, i) => (
            <Text key={i} style={styles.weekDayText}>
              {wd}
            </Text>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={styles.gridContainer}>
          {calendarDays.map((cell, idx) => {
            if (!cell) {
              return <View key={`empty-${idx}`} style={styles.cellWrapper} />;
            }

            const { day, dateStr } = cell;
            const isToday = dateStr === todayStr;
            const isStart = dateStr === startDate;
            const isEnd = dateStr === endDate;
            const inRange =
              mode === 'range' &&
              startDate &&
              endDate &&
              dateStr > startDate &&
              dateStr < endDate;

            const isSelected = isStart || isEnd;

            return (
              <View
                key={dateStr}
                style={[
                  styles.cellWrapper,
                  inRange && styles.cellInRangeWrapper,
                  isStart && endDate && startDate !== endDate && styles.cellStartRangeWrapper,
                  isEnd && startDate && startDate !== endDate && styles.cellEndRangeWrapper,
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.dayCell,
                    isToday && !isSelected && styles.dayToday,
                    isSelected && styles.daySelected,
                  ]}
                  onPress={() => handleDayPress(dateStr)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isToday && !isSelected && styles.dayTodayText,
                      isSelected && styles.daySelectedText,
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Bottom Actions Bar */}
        <View style={styles.footerRow}>
          <Button
            title="Cancel"
            variant="secondary"
            size="md"
            onPress={onClose}
            style={{ flex: 1 }}
          />
          <Button
            title="Apply Range"
            variant="primary"
            size="md"
            disabled={!canApply}
            onPress={handleApply}
            style={{ flex: 1.4 }}
          />
        </View>
      </ScrollView>
    </BottomSheetModal>
  );
}

const createStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      paddingBottom: 24,
    },
    presetsRow: {
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 10,
    },
    presetChip: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.borderMedium,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    presetChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    selectionSummaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      marginHorizontal: 20,
      marginTop: 4,
      marginBottom: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderMedium,
    },
    selectionColumn: {
      flex: 1,
    },
    selectionLabel: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    selectionValue: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    monthNavRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 8,
    },
    monthTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.2,
    },
    navButton: {
      padding: 6,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.borderMedium,
    },
    weekDaysRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      marginBottom: 4,
    },
    weekDayText: {
      flex: 1,
      textAlign: 'center',
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 16,
      paddingVertical: 4,
    },
    cellWrapper: {
      width: '14.28%',
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 1,
    },
    cellInRangeWrapper: {
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(14, 165, 233, 0.12)',
    },
    cellStartRangeWrapper: {
      borderTopLeftRadius: 20,
      borderBottomLeftRadius: 20,
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(14, 165, 233, 0.12)',
    },
    cellEndRangeWrapper: {
      borderTopRightRadius: 20,
      borderBottomRightRadius: 20,
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(14, 165, 233, 0.12)',
    },
    dayCell: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayToday: {
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    dayTodayText: {
      color: colors.primary,
      fontWeight: '800',
    },
    daySelected: {
      backgroundColor: colors.primary,
    },
    daySelectedText: {
      color: colors.primaryForeground,
      fontWeight: '800',
    },
    dayText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.text,
    },
    footerRow: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 16,
    },
  });
