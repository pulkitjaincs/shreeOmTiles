import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/lib/theme-context';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const { colors, isDark } = useTheme();
  const norm = (status || '').toUpperCase().replace(/\s+/g, '_');

  let bg: string = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  let text: string = colors.textSecondary;
  let label: string = status;

  switch (norm) {
    case 'PAID':
    case 'DELIVERED':
    case 'CONFIRMED':
    case 'SETTLED':
      bg = colors.statusPaidBg;
      text = colors.statusPaid;
      break;
    case 'PENDING':
    case 'PARTIAL':
    case 'DRAFT':
    case 'UNPAID':
      bg = colors.statusPendingBg;
      text = colors.statusPending;
      break;
    case 'ASSIGNED':
      bg = colors.statusAssignedBg;
      text = colors.statusAssigned;
      break;
    case 'OUT_FOR_PICKUP':
    case 'PICKED_UP':
    case 'OUT_FOR_DELIVERY':
      bg = colors.statusDeliveryBg;
      text = colors.statusDelivery;
      break;
    case 'CANCELLED':
    case 'FAILED':
    case 'OVERDUE':
      bg = colors.statusCancelledBg;
      text = colors.statusCancelled;
      break;
    case 'CREATED':
      bg = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
      text = colors.text;
      break;
    default:
      bg = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
      text = colors.textSecondary;
  }

  const isSmall = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: bg }, isSmall && styles.badgeSm]}>
      <View style={[styles.dot, { backgroundColor: text }]} />
      <Text style={[styles.text, { color: text }, isSmall && styles.textSm]}>
        {label.replace(/_/g, ' ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    gap: 5,
  },
  badgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  textSm: {
    fontSize: 9.5,
  },
});
