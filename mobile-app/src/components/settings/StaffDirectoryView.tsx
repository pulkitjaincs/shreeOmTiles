import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SearchBar } from '@/components/ui/SearchBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/theme';
import { StaffUser } from './types';
import { StaffCard } from './StaffCard';

interface StaffDirectoryViewProps {
  staffList: StaffUser[];
  loading: boolean;
  onRefresh: () => void;
  onAddStaff: () => void;
  onEditStaff: (staff: StaffUser) => void;
  onResetPassword: (staff: StaffUser) => void;
  onToggleStatus: (staff: StaffUser) => void;
  onDeleteStaff: (staff: StaffUser) => void;
}

export function StaffDirectoryView({
  staffList,
  loading,
  onRefresh,
  onAddStaff,
  onEditStaff,
  onResetPassword,
  onToggleStatus,
  onDeleteStaff,
}: StaffDirectoryViewProps) {
  const [search, setSearch] = useState('');

  // Stats matching Web's UserStatsGrid
  const stats = useMemo(() => {
    const total = staffList.length;
    const active = staffList.filter((s) => s.active).length;
    const drivers = staffList.filter((s) => s.role === 'DRIVER' && s.active).length;
    const salesmen = staffList.filter((s) => s.role === 'SALESMAN' && s.active).length;
    return { total, active, drivers, salesmen };
  }, [staffList]);

  // Filtered staff list (name, phone, role)
  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cleanPhone = search.replace(/\D/g, '');

    if (!q) return staffList;

    return staffList.filter((st) => {
      const matchesName = st.name?.toLowerCase().includes(q);
      const matchesPhone = cleanPhone && st.phone ? st.phone.replace(/\D/g, '').includes(cleanPhone) : false;
      const matchesRole = st.role?.toLowerCase().includes(q);
      return matchesName || matchesPhone || matchesRole;
    });
  }, [staffList, search]);

  return (
    <View style={styles.container}>
      {/* 1. Top Metrics Row */}
      <View style={styles.metricsGrid}>
        <Card elevated style={styles.metricCard}>
          <Text style={styles.metricLabel}>Total Staff</Text>
          <Text style={styles.metricValue}>{stats.total}</Text>
        </Card>
        <Card elevated style={styles.metricCard}>
          <Text style={styles.metricLabel}>Active</Text>
          <Text style={[styles.metricValue, { color: '#34D399' }]}>{stats.active}</Text>
        </Card>
        <Card elevated style={styles.metricCard}>
          <Text style={styles.metricLabel}>Drivers</Text>
          <Text style={[styles.metricValue, { color: '#38BDF8' }]}>{stats.drivers}</Text>
        </Card>
        <Card elevated style={styles.metricCard}>
          <Text style={styles.metricLabel}>Salesmen</Text>
          <Text style={[styles.metricValue, { color: '#C084FC' }]}>{stats.salesmen}</Text>
        </Card>
      </View>

      {/* 2. Action Header Row */}
      <View style={styles.actionHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>
            Staff Accounts ({filteredStaff.length})
          </Text>
          <Text style={styles.sectionSubtitle}>
            Manage role-based system access & accounts
          </Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.refreshIconBtn}
            onPress={onRefresh}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="refresh-outline" size={18} color={Colors.dark.textSecondary} />
          </TouchableOpacity>
          <Button
            title="+ Add Staff"
            size="sm"
            variant="primary"
            onPress={onAddStaff}
            style={styles.addStaffBtn}
          />
        </View>
      </View>

      {/* 3. Search Bar */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search staff by name, mobile, or role..."
        />
      </View>

      {/* Active Search Result / Clear Row */}
      {search.trim().length > 0 ? (
        <View style={styles.resultsInfoRow}>
          <Text style={styles.resultsCountText}>
            Showing <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{filteredStaff.length}</Text> of {staffList.length} staff members
          </Text>
          <TouchableOpacity
            onPress={() => setSearch('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.resetFilterText}>Clear Search</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* 4. Staff Cards List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.loadingText}>Fetching staff directory...</Text>
        </View>
      ) : filteredStaff.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="people-outline" size={40} color={Colors.dark.textTertiary} />
          <Text style={styles.emptyTitle}>No Staff Members Found</Text>
          <Text style={styles.emptySub}>
            {search.trim().length > 0
              ? 'No staff members match your search query.'
              : 'Add your first salesman, driver, or manager to grant system access.'}
          </Text>
          {search.trim().length > 0 ? (
            <Button
              title="Clear Search"
              size="sm"
              variant="outline"
              onPress={() => setSearch('')}
              style={{ marginTop: 12, height: 36, borderRadius: 8 }}
            />
          ) : null}
        </View>
      ) : (
        filteredStaff.map((staff) => (
          <StaffCard
            key={staff.id}
            staff={staff}
            onEdit={onEditStaff}
            onResetPassword={onResetPassword}
            onToggleStatus={onToggleStatus}
            onDelete={onDeleteStaff}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    paddingBottom: 24,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 2,
  },
  metricCard: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: Colors.dark.card,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.borderMedium,
  },
  metricLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  actionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.borderMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addStaffBtn: {
    height: 38,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchContainer: {
    marginBottom: 2,
  },
  resultsInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  resultsCountText: {
    fontSize: 11.5,
    color: Colors.dark.textSecondary,
  },
  resetFilterText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#38BDF8',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  emptyCard: {
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.borderMedium,
    backgroundColor: Colors.dark.card,
    marginTop: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
});
