import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SearchBar } from '@/components/ui/SearchBar';
import { FilterPills } from '@/components/ui/FilterPills';
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
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Stats matching Web's UserStatsGrid
  const stats = useMemo(() => {
    const total = staffList.length;
    const active = staffList.filter((s) => s.active).length;
    const drivers = staffList.filter((s) => s.role === 'DRIVER' && s.active).length;
    const salesmen = staffList.filter((s) => s.role === 'SALESMAN' && s.active).length;
    return { total, active, drivers, salesmen };
  }, [staffList]);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cleanPhone = search.replace(/\D/g, '');

    return staffList.filter((st) => {
      if (roleFilter !== 'ALL' && st.role !== roleFilter) return false;
      if (statusFilter === 'ACTIVE' && !st.active) return false;
      if (statusFilter === 'INACTIVE' && st.active) return false;

      if (q) {
        const matchesName = st.name.toLowerCase().includes(q);
        const matchesPhone = cleanPhone ? st.phone.replace(/\D/g, '').includes(cleanPhone) : false;
        const matchesRole = st.role.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesRole) return false;
      }

      return true;
    });
  }, [staffList, search, roleFilter, statusFilter]);

  const hasActiveFilters = search.trim() !== '' || roleFilter !== 'ALL' || statusFilter !== 'ALL';

  const clearFilters = () => {
    setSearch('');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
  };

  return (
    <View style={styles.container}>
      {/* Top Metrics Row */}
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

      {/* Search Input */}
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search staff by name, mobile, or role..."
      />

      {/* Role Filter Pills */}
      <FilterPills
        options={[
          { label: 'All Roles', value: 'ALL', count: staffList.length },
          { label: 'Drivers', value: 'DRIVER', count: stats.drivers },
          { label: 'Salesmen', value: 'SALESMAN', count: stats.salesmen },
          { label: 'Admins', value: 'ADMIN' },
        ]}
        selected={roleFilter}
        onSelect={setRoleFilter}
      />

      {/* Status Filter Pills */}
      <FilterPills
        options={[
          { label: 'All Statuses', value: 'ALL' },
          { label: 'Active', value: 'ACTIVE' },
          { label: 'Inactive', value: 'INACTIVE' },
        ]}
        selected={statusFilter}
        onSelect={setStatusFilter}
      />

      {/* Action Header Row */}
      <View style={styles.actionHeaderRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.sectionTitle}>
            Staff Accounts ({filteredStaff.length})
          </Text>
          {hasActiveFilters ? (
            <TouchableOpacity onPress={clearFilters} hitSlop={8}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          ) : null}
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
          />
        </View>
      </View>

      {/* Staff Cards List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.loadingText}>Fetching staff directory...</Text>
        </View>
      ) : filteredStaff.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="people-outline" size={40} color={Colors.dark.textTertiary} />
          <Text style={styles.emptyTitle}>No Staff Members Found</Text>
          <Text style={styles.emptySub}>
            {hasActiveFilters
              ? 'No staff members match the selected filters.'
              : 'Add your first salesman, driver, or manager to grant system access.'}
          </Text>
          {hasActiveFilters ? (
            <Button
              title="Clear Filters"
              size="sm"
              variant="outline"
              onPress={clearFilters}
              style={{ marginTop: 12 }}
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
    paddingBottom: 24,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    backgroundColor: Colors.dark.cardElevated,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  actionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  clearText: {
    fontSize: 11,
    color: Colors.dark.primary,
    fontWeight: '700',
  },
  refreshIconBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  centerBox: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  emptyCard: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.card,
    marginTop: 8,
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
