import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const norm = (status || '').toUpperCase().replace(/\s+/g, '_');

  let bg: string = 'rgba(255, 255, 255, 0.08)';
  let text: string = Colors.dark.textSecondary;
  let label: string = status;

  switch (norm) {
    case 'PAID':
    case 'DELIVERED':
    case 'CONFIRMED':
    case 'SETTLED':
      bg = Colors.dark.statusPaidBg;
      text = Colors.dark.statusPaid;
      break;
    case 'PENDING':
    case 'PARTIAL':
    case 'DRAFT':
    case 'UNPAID':
      bg = Colors.dark.statusPendingBg;
      text = Colors.dark.statusPending;
      break;
    case 'ASSIGNED':
      bg = Colors.dark.statusAssignedBg;
      text = Colors.dark.statusAssigned;
      break;
    case 'OUT_FOR_PICKUP':
    case 'PICKED_UP':
    case 'OUT_FOR_DELIVERY':
      bg = Colors.dark.statusDeliveryBg;
      text = Colors.dark.statusDelivery;
      break;
    case 'CANCELLED':
    case 'FAILED':
    case 'OVERDUE':
      bg = Colors.dark.statusCancelledBg;
      text = Colors.dark.statusCancelled;
      break;
    case 'CREATED':
      bg = 'rgba(255, 255, 255, 0.1)';
      text = '#FFFFFF';
      break;
    default:
      bg = 'rgba(255, 255, 255, 0.08)';
      text = Colors.dark.textSecondary;
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
