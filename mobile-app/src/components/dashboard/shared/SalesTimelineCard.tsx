import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { formatINR } from '@/lib/formatters';
import { TrendPoint } from '../types';

interface SalesTimelineCardProps {
  trendData: TrendPoint[];
  title?: string;
  subtitle?: string;
  showSeriesToggle?: boolean;
}

export function SalesTimelineCard({
  trendData,
  title = 'Revenue & Cashflow Timeline',
  subtitle = 'Daily trend of Invoiced, Collected, and Credit',
  showSeriesToggle = true,
}: SalesTimelineCardProps) {
  const [activeSeries, setActiveSeries] = useState<'all' | 'invoiced' | 'collected' | 'credit'>('all');

  const maxVal = useMemo(() => {
    if (!trendData.length) return 1000;
    const max = Math.max(
      ...trendData.map((t) =>
        Math.max(Number(t.invoiced || 0), Number(t.collected || 0), Number(t.credit || 0)),
      ),
      1000,
    );
    return max > 0 ? max : 1000;
  }, [trendData]);

  if (trendData.length === 0) {
    return (
      <View style={styles.section}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>{subtitle}</Text>
        </View>
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No data recorded for the selected period.</Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View>
          <View style={styles.titleRow}>
            <View style={styles.dot} />
            <Text style={styles.title}>{title}</Text>
          </View>
          <Text style={styles.sub}>{subtitle}</Text>
        </View>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsBadgeText}>{trendData.length} Days</Text>
        </View>
      </View>

      {/* Series Selector (if enabled) */}
      {showSeriesToggle && (
        <View style={styles.seriesRow}>
          {(
            [
              { id: 'all', label: 'All Series' },
              { id: 'invoiced', label: 'Invoiced' },
              { id: 'collected', label: 'Collected' },
              { id: 'credit', label: 'Credit' },
            ] as const
          ).map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[
                styles.seriesPill,
                activeSeries === s.id && styles.seriesPillActive,
              ]}
              onPress={() => setActiveSeries(s.id)}
            >
              <Text
                style={[
                  styles.seriesPillText,
                  activeSeries === s.id && styles.seriesPillTextActive,
                ]}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Card style={styles.chartCard}>
        {/* Legend */}
        <View style={styles.legendRow}>
          {(activeSeries === 'all' || activeSeries === 'invoiced') && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FFFFFF' }]} />
              <Text style={styles.legendText}>Invoiced</Text>
            </View>
          )}
          {(activeSeries === 'all' || activeSeries === 'collected') && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>Collected</Text>
            </View>
          )}
          {(activeSeries === 'all' || activeSeries === 'credit') && showSeriesToggle && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendText}>Credit</Text>
            </View>
          )}
        </View>

        {/* Daily Bars */}
        {trendData.slice(-8).map((point, idx) => {
          const invVal = Number(point.invoiced || 0);
          const colVal = Number(point.collected || 0);
          const creVal = Number(point.credit || 0);

          const invPct = Math.min(100, Math.round((invVal / maxVal) * 100));
          const colPct = Math.min(100, Math.round((colVal / maxVal) * 100));
          const crePct = Math.min(100, Math.round((creVal / maxVal) * 100));

          return (
            <View key={idx} style={styles.dayRow}>
              <Text style={styles.dayLabel}>{point.label || point.date}</Text>
              <View style={styles.barsContainer}>
                {(activeSeries === 'all' || activeSeries === 'invoiced') && (
                  <View style={styles.barWrapper}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${Math.max(invPct, 2)}%`, backgroundColor: '#FFFFFF' },
                      ]}
                    />
                    <Text style={styles.barText}>{formatINR(invVal)}</Text>
                  </View>
                )}
                {(activeSeries === 'all' || activeSeries === 'collected') && (
                  <View style={styles.barWrapper}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${Math.max(colPct, 2)}%`, backgroundColor: '#10B981' },
                      ]}
                    />
                    <Text style={[styles.barText, { color: '#10B981' }]}>
                      {formatINR(colVal)}
                    </Text>
                  </View>
                )}
                {(activeSeries === 'all' || activeSeries === 'credit') && creVal > 0 && showSeriesToggle && (
                  <View style={styles.barWrapper}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${Math.max(crePct, 2)}%`, backgroundColor: '#EF4444' },
                      ]}
                    />
                    <Text style={[styles.barText, { color: '#EF4444' }]}>
                      {formatINR(creVal)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Start: {trendData[0]?.label || 'Start'}</Text>
          <Text style={styles.footerText}>
            End: {trendData[trendData.length - 1]?.label || 'Today'}
          </Text>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 14,
  },
  header: {
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38BDF8',
  },
  title: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  sub: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  pointsBadge: {
    backgroundColor: Colors.dark.cardElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  pointsBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  seriesRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  seriesPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  seriesPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  seriesPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  seriesPillTextActive: {
    color: '#09090B',
  },
  chartCard: {
    padding: 14,
    borderRadius: 16,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4.5,
    gap: 10,
  },
  dayLabel: {
    width: 58,
    fontSize: 10.5,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  barsContainer: {
    flex: 1,
    gap: 3.5,
  },
  barWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  barText: {
    fontSize: 9.5,
    color: Colors.dark.textTertiary,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    paddingTop: 8,
    marginTop: 8,
  },
  footerText: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
  },
  emptyCard: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 11.5,
    color: Colors.dark.textSecondary,
  },
});
