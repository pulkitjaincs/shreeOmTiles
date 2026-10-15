import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { formatINR } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';

interface CategorySplitCardProps {
  categories: Array<{ name: string; value: number }>;
  title?: string;
  onManageCatalog?: () => void;
}

export function CategorySplitCard({
  categories,
  title = 'Sales by Category',
  onManageCatalog,
}: CategorySplitCardProps) {
  const totalVolume = useMemo(() => {
    return categories.reduce((sum, c) => sum + Number(c.value || 0), 0) || 1;
  }, [categories]);

  if (!categories || categories.length === 0) {
    return (
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Ionicons name="cube-outline" size={15} color="#10B981" />
            <Text style={styles.headerTitle}>{title}</Text>
          </View>
        </View>
        <Text style={styles.emptyText}>No category sales invoiced in this period.</Text>
      </Card>
    );
  }

  const colors = ['#FFFFFF', '#10B981', '#38BDF8', '#F59E0B', '#A855F7', '#EC4899'];

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name="cube-outline" size={15} color="#10B981" />
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        {onManageCatalog ? (
          <TouchableOpacity onPress={onManageCatalog}>
            <Text style={styles.headerLink}>Catalog →</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {categories.slice(0, 6).map((cat, idx) => {
        const pct = Math.round((Number(cat.value || 0) / totalVolume) * 100);
        const barColor = colors[idx % colors.length];

        return (
          <View key={idx} style={styles.row}>
            <View style={styles.rowMeta}>
              <Text style={styles.name}>{cat.name}</Text>
              <Text style={styles.amount}>
                {formatINR(cat.value)} ({pct}%)
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${pct}%`, backgroundColor: barColor },
                ]}
              />
            </View>
          </View>
        );
      })}

      <View style={styles.footerRow}>
        <Text style={styles.footerLabel}>Total Catalog Volume:</Text>
        <Text style={styles.footerValue}>{formatINR(totalVolume)}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 15,
    borderRadius: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  row: {
    marginBottom: 10,
  },
  rowMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  name: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  amount: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    paddingTop: 8,
    marginTop: 4,
  },
  footerLabel: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
  },
  footerValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyText: {
    fontSize: 11.5,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
