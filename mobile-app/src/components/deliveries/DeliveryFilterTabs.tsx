import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '@/lib/theme-context';
import { FilterTab, DeliveryCounts } from './types';

interface DeliveryFilterTabsProps {
  activeFilter: FilterTab;
  onSelectFilter: (tab: FilterTab) => void;
  counts: DeliveryCounts;
  isDriver?: boolean;
}

export function DeliveryFilterTabs({
  activeFilter,
  onSelectFilter,
  counts,
  isDriver,
}: DeliveryFilterTabsProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* 1. All */}
      <TouchableOpacity
        style={[styles.tabChip, activeFilter === 'ALL' && styles.tabChipActiveAll]}
        onPress={() => onSelectFilter('ALL')}
        activeOpacity={0.7}
      >
        <Ionicons
          name="layers-outline"
          size={13}
          color={activeFilter === 'ALL' ? colors.background : colors.textSecondary}
        />
        <Text style={[styles.tabText, activeFilter === 'ALL' && styles.tabTextActiveAll]}>
          All
        </Text>
        <View style={[styles.countBadge, activeFilter === 'ALL' && styles.countBadgeActiveAll]}>
          <Text style={[styles.countText, activeFilter === 'ALL' && styles.countTextActiveAll]}>
            {counts.total}
          </Text>
        </View>
      </TouchableOpacity>

      {/* 2. Pending / Ready for Pickup */}
      <TouchableOpacity
        style={[styles.tabChip, activeFilter === 'PENDING' && styles.tabChipActiveAmber]}
        onPress={() => onSelectFilter('PENDING')}
        activeOpacity={0.7}
      >
        <Ionicons
          name="time-outline"
          size={13}
          color={activeFilter === 'PENDING' ? '#F59E0B' : colors.textSecondary}
        />
        <Text style={[styles.tabText, activeFilter === 'PENDING' && styles.tabTextActiveAmber]}>
          {isDriver ? 'Ready for Pickup' : 'Pending Dispatch'}
        </Text>
        <View style={[styles.countBadge, activeFilter === 'PENDING' && styles.countBadgeActiveAmber]}>
          <Text style={[styles.countText, activeFilter === 'PENDING' && styles.countTextActiveAmber]}>
            {counts.pending}
          </Text>
        </View>
      </TouchableOpacity>

      {/* 3. Out for Pickup */}
      <TouchableOpacity
        style={[styles.tabChip, activeFilter === 'OUT_FOR_PICKUP' && styles.tabChipActivePurple]}
        onPress={() => onSelectFilter('OUT_FOR_PICKUP')}
        activeOpacity={0.7}
      >
        <Ionicons
          name="cube-outline"
          size={13}
          color={activeFilter === 'OUT_FOR_PICKUP' ? '#A855F7' : colors.textSecondary}
        />
        <Text
          style={[styles.tabText, activeFilter === 'OUT_FOR_PICKUP' && styles.tabTextActivePurple]}
        >
          Out for Pickup
        </Text>
        <View
          style={[
            styles.countBadge,
            activeFilter === 'OUT_FOR_PICKUP' && styles.countBadgeActivePurple,
          ]}
        >
          <Text
            style={[
              styles.countText,
              activeFilter === 'OUT_FOR_PICKUP' && styles.countTextActivePurple,
            ]}
          >
            {counts.outForPickup}
          </Text>
        </View>
      </TouchableOpacity>

      {/* 4. Out for Delivery */}
      <TouchableOpacity
        style={[styles.tabChip, activeFilter === 'OUT_FOR_DELIVERY' && styles.tabChipActiveBlue]}
        onPress={() => onSelectFilter('OUT_FOR_DELIVERY')}
        activeOpacity={0.7}
      >
        <Ionicons
          name="bicycle-outline"
          size={13}
          color={activeFilter === 'OUT_FOR_DELIVERY' ? '#38BDF8' : colors.textSecondary}
        />
        <Text
          style={[styles.tabText, activeFilter === 'OUT_FOR_DELIVERY' && styles.tabTextActiveBlue]}
        >
          Out for Delivery
        </Text>
        <View
          style={[
            styles.countBadge,
            activeFilter === 'OUT_FOR_DELIVERY' && styles.countBadgeActiveBlue,
          ]}
        >
          <Text
            style={[
              styles.countText,
              activeFilter === 'OUT_FOR_DELIVERY' && styles.countTextActiveBlue,
            ]}
          >
            {counts.outForDelivery}
          </Text>
        </View>
      </TouchableOpacity>

      {/* 5. Delivered */}
      <TouchableOpacity
        style={[styles.tabChip, activeFilter === 'DELIVERED' && styles.tabChipActiveGreen]}
        onPress={() => onSelectFilter('DELIVERED')}
        activeOpacity={0.7}
      >
        <Ionicons
          name="checkmark-circle-outline"
          size={13}
          color={activeFilter === 'DELIVERED' ? '#10B981' : colors.textSecondary}
        />
        <Text style={[styles.tabText, activeFilter === 'DELIVERED' && styles.tabTextActiveGreen]}>
          Delivered
        </Text>
        <View
          style={[
            styles.countBadge,
            activeFilter === 'DELIVERED' && styles.countBadgeActiveGreen,
          ]}
        >
          <Text
            style={[
              styles.countText,
              activeFilter === 'DELIVERED' && styles.countTextActiveGreen,
            ]}
          >
            {counts.delivered}
          </Text>
        </View>
      </TouchableOpacity>

      {/* 6. Cancelled (Only if > 0) */}
      {counts.cancelled > 0 && (
        <TouchableOpacity
          style={[styles.tabChip, activeFilter === 'CANCELLED' && styles.tabChipActiveRed]}
          onPress={() => onSelectFilter('CANCELLED')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="close-circle-outline"
            size={13}
            color={activeFilter === 'CANCELLED' ? '#EF4444' : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeFilter === 'CANCELLED' && styles.tabTextActiveRed]}>
            Cancelled
          </Text>
          <View
            style={[
              styles.countBadge,
              activeFilter === 'CANCELLED' && styles.countBadgeActiveRed,
            ]}
          >
            <Text
              style={[
                styles.countText,
                activeFilter === 'CANCELLED' && styles.countTextActiveRed,
              ]}
            >
              {counts.cancelled}
            </Text>
          </View>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      marginVertical: 6,
    },
    content: {
      paddingHorizontal: 16,
      gap: 8,
    },
    tabChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 7,
      paddingHorizontal: 11,
      borderRadius: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabChipActiveAll: {
      backgroundColor: colors.text,
      borderColor: colors.text,
    },
    tabChipActiveAmber: {
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
      borderColor: '#F59E0B',
    },
    tabChipActivePurple: {
      backgroundColor: 'rgba(168, 85, 247, 0.12)',
      borderColor: '#A855F7',
    },
    tabChipActiveBlue: {
      backgroundColor: 'rgba(56, 189, 248, 0.12)',
      borderColor: '#38BDF8',
    },
    tabChipActiveGreen: {
      backgroundColor: 'rgba(16, 185, 129, 0.12)',
      borderColor: '#10B981',
    },
    tabChipActiveRed: {
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
      borderColor: '#EF4444',
    },
    tabText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    tabTextActiveAll: {
      color: colors.background,
    },
    tabTextActiveAmber: {
      color: '#F59E0B',
    },
    tabTextActivePurple: {
      color: '#A855F7',
    },
    tabTextActiveBlue: {
      color: '#38BDF8',
    },
    tabTextActiveGreen: {
      color: '#10B981',
    },
    tabTextActiveRed: {
      color: '#EF4444',
    },
    countBadge: {
      paddingVertical: 1,
      paddingHorizontal: 5,
      borderRadius: 10,
      backgroundColor: colors.cardElevated,
    },
    countBadgeActiveAll: {
      backgroundColor: 'rgba(0, 0, 0, 0.15)',
    },
    countBadgeActiveAmber: {
      backgroundColor: 'rgba(245, 158, 11, 0.2)',
    },
    countBadgeActivePurple: {
      backgroundColor: 'rgba(168, 85, 247, 0.2)',
    },
    countBadgeActiveBlue: {
      backgroundColor: 'rgba(56, 189, 248, 0.2)',
    },
    countBadgeActiveGreen: {
      backgroundColor: 'rgba(16, 185, 129, 0.2)',
    },
    countBadgeActiveRed: {
      backgroundColor: 'rgba(239, 68, 68, 0.2)',
    },
    countText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    countTextActiveAll: {
      color: colors.background,
    },
    countTextActiveAmber: {
      color: '#F59E0B',
    },
    countTextActivePurple: {
      color: '#A855F7',
    },
    countTextActiveBlue: {
      color: '#38BDF8',
    },
    countTextActiveGreen: {
      color: '#10B981',
    },
    countTextActiveRed: {
      color: '#EF4444',
    },
  });
