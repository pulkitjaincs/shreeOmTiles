import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Colors } from '@/constants/theme';
import { getInitials } from '@/lib/formatters';
import { StaffUser } from './types';

interface StaffCardProps {
  staff: StaffUser;
  onEdit: (staff: StaffUser) => void;
  onResetPassword: (staff: StaffUser) => void;
  onToggleStatus: (staff: StaffUser) => void;
  onDelete: (staff: StaffUser) => void;
}

export function StaffCard({
  staff,
  onEdit,
  onResetPassword,
  onToggleStatus,
  onDelete,
}: StaffCardProps) {
  const isOwner = staff.role === 'OWNER';

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'OWNER':
        return {
          bg: 'rgba(16, 185, 129, 0.12)',
          border: 'rgba(16, 185, 129, 0.25)',
          text: '#34D399',
        };
      case 'ADMIN':
        return {
          bg: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.25)',
          text: '#FBBF24',
        };
      case 'SALESMAN':
        return {
          bg: 'rgba(168, 85, 247, 0.12)',
          border: 'rgba(168, 85, 247, 0.25)',
          text: '#C084FC',
        };
      case 'DRIVER':
        return {
          bg: 'rgba(56, 189, 248, 0.12)',
          border: 'rgba(56, 189, 248, 0.25)',
          text: '#38BDF8',
        };
      default:
        return {
          bg: Colors.dark.secondary,
          border: Colors.dark.border,
          text: '#FFFFFF',
        };
    }
  };

  const roleStyle = getRoleBadgeStyle(staff.role);

  return (
    <Card elevated style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{getInitials(staff.name)}</Text>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.staffName} numberOfLines={1}>
            {staff.name}
          </Text>
          <View style={styles.phoneRow}>
            <Ionicons name="call-outline" size={12} color={Colors.dark.textSecondary} />
            <Text style={styles.staffPhone}>{staff.phone}</Text>
          </View>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.roleBadge,
                { backgroundColor: roleStyle.bg, borderColor: roleStyle.border },
              ]}
            >
              <Text style={[styles.roleBadgeText, { color: roleStyle.text }]}>
                {staff.role}
              </Text>
            </View>
            <StatusBadge status={staff.active ? 'ACTIVE' : 'INACTIVE'} size="sm" />
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.actionsRow}>
        <Button
          title="Edit"
          icon="pencil-outline"
          size="sm"
          variant="outline"
          onPress={() => onEdit(staff)}
          style={{ flex: 1 }}
        />
        <Button
          title="Password"
          icon="key-outline"
          size="sm"
          variant="outline"
          onPress={() => onResetPassword(staff)}
          style={{ flex: 1.1 }}
        />
        {!isOwner ? (
          <Button
            title={staff.active ? 'Deactivate' : 'Activate'}
            size="sm"
            variant={staff.active ? 'secondary' : 'primary'}
            onPress={() => onToggleStatus(staff)}
            style={{ flex: 1.2 }}
          />
        ) : null}
        {!isOwner ? (
          <Button
            title=""
            icon="trash-outline"
            size="sm"
            variant="danger"
            onPress={() => onDelete(staff)}
            style={styles.deleteBtn}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: Colors.dark.cardElevated,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: Colors.dark.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  staffName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  staffPhone: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontFamily: 'monospace',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  roleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginVertical: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deleteBtn: {
    minWidth: 38,
    paddingHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
