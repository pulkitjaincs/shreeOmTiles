import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useTheme, useThemedStyles, ThemeColors } from '@/lib/theme-context';
import { Card } from '@/components/ui/Card';
import { formatINR } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';
import { SalesmanPerformance } from '../types';

interface SalesStaffPerformanceProps {
  salesmen: SalesmanPerformance[];
  onManageStaff?: () => void;
}

export function SalesStaffPerformance({
  salesmen,
  onManageStaff,
}: SalesStaffPerformanceProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [search, setSearch] = useState('');

  const filteredSalesmen = useMemo(() => {
    if (!search.trim()) return salesmen;
    const q = search.toLowerCase();
    return salesmen.filter(
      (s) =>
        (s.name || s.salesmanName || '').toLowerCase().includes(q) ||
        (s.phone || '').includes(q),
    );
  }, [salesmen, search]);

  const totalStaffSales = useMemo(() => {
    const sum = salesmen.reduce((acc, s) => acc + (Number(s.totalSales) || 0), 0);
    return sum > 0 ? sum : 1;
  }, [salesmen]);

  if (salesmen.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Sales Staff Overview ({salesmen.length})</Text>
          <Text style={styles.sub}>Staff sales volume, ticket average & market share</Text>
        </View>
        {onManageStaff ? (
          <TouchableOpacity onPress={onManageStaff}>
            <Text style={styles.link}>Manage Staff →</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Search Input (shows if > 2 staff) */}
      {salesmen.length > 2 && (
        <View style={styles.searchBox}>
          <Ionicons name="search" size={15} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search staff by name or phone..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={15} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {filteredSalesmen.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No sales staff matched your search.</Text>
        </Card>
      ) : (
        filteredSalesmen.map((s) => {
          const staffId = s.id || s.salesmanId || '';
          const staffName = s.name || s.salesmanName || 'Staff';
          const phone = s.phone || '';
          const count = s.invoiceCount ?? s.invoicesCount ?? 0;
          const aov = s.avgOrderValue ?? s.averageTicket ?? 0;
          const total = s.totalSales ?? 0;
          const sharePct = Math.round(((Number(total) || 0) / totalStaffSales) * 100);

          return (
            <Card key={staffId} style={styles.card}>
              <View style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {staffName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
                      {staffName}
                    </Text>
                    <View style={styles.roleBadge}>
                      <Text style={styles.roleText}>{s.role === 'OWNER' ? 'DIRECTOR' : (s.role || 'SALESMAN')}</Text>
                    </View>
                  </View>
                  {phone ? <Text style={styles.phone} numberOfLines={1}>{phone}</Text> : null}
                  <Text style={styles.subText} numberOfLines={1} ellipsizeMode="tail">
                    {count} invoices • Avg ₹{Math.round(aov).toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                  <Text
                    style={styles.total}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {formatINR(total)}
                  </Text>
                  <Text style={styles.shareText}>{sharePct}% share</Text>
                </View>
              </View>
              {/* Sales Share Progress Track */}
              <View style={styles.shareTrack}>
                <View
                  style={[
                    styles.shareFill,
                    { width: `${Math.min(100, Math.max(3, sharePct))}%` },
                  ]}
                />
              </View>
            </Card>
          );
        })
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      marginTop: 14,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    title: {
      fontSize: 13.5,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.2,
    },
    sub: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    link: {
      fontSize: 11.5,
      fontWeight: '700',
      color: '#38BDF8',
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      height: 38,
      marginBottom: 10,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 12,
      color: colors.text,
    },
    card: {
      padding: 13,
      marginBottom: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    avatar: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.cardElevated,
      borderWidth: 1,
      borderColor: colors.borderMedium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.text,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    name: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      flexShrink: 1,
    },
    roleBadge: {
      backgroundColor: colors.cardElevated,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
      flexShrink: 0,
    },
    roleText: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.textTertiary,
    },
    phone: {
      fontSize: 10.5,
      color: colors.textTertiary,
      marginTop: 1,
    },
    subText: {
      fontSize: 10.5,
      color: colors.textSecondary,
      marginTop: 2,
    },
    total: {
      fontSize: 14.5,
      fontWeight: '800',
      color: '#10B981',
      flexShrink: 0,
    },
    shareText: {
      fontSize: 10,
      color: colors.textTertiary,
      marginTop: 2,
    },
    shareTrack: {
      height: 4,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.07)' : colors.border,
      borderRadius: 2,
      marginTop: 8,
      overflow: 'hidden',
    },
    shareFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 2,
    },
    emptyCard: {
      padding: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      fontSize: 11.5,
      color: colors.textSecondary,
    },
  });
