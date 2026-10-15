import React from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { ActiveTabType } from './types';

interface TransactionTabsBarProps {
  activeTab: ActiveTabType;
  onTabChange: (tab: ActiveTabType) => void;
  duesCount: number;
  payablesCount: number;
  allCount: number;
  inflowsCount: number;
  creditsCount: number;
}

export function TransactionTabsBar({
  activeTab,
  onTabChange,
  duesCount,
  payablesCount,
  allCount,
  inflowsCount,
  creditsCount,
}: TransactionTabsBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabsScroll}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Tab 1: Customer Dues */}
      <TouchableOpacity
        style={[styles.tabChip, activeTab === 'dues' && styles.tabChipActiveRose]}
        onPress={() => onTabChange('dues')}
        activeOpacity={0.7}
      >
        <Ionicons
          name="time-outline"
          size={14}
          color={activeTab === 'dues' ? '#EF4444' : Colors.dark.textSecondary}
        />
        <Text
          style={[styles.tabChipText, activeTab === 'dues' && styles.tabChipTextActiveRose]}
        >
          Customer Dues ({duesCount})
        </Text>
      </TouchableOpacity>

      {/* Tab 2: Store Payables */}
      <TouchableOpacity
        style={[styles.tabChip, activeTab === 'payables' && styles.tabChipActiveAmber]}
        onPress={() => onTabChange('payables')}
        activeOpacity={0.7}
      >
        <Ionicons
          name="arrow-up-circle-outline"
          size={14}
          color={activeTab === 'payables' ? '#F59E0B' : Colors.dark.textSecondary}
        />
        <Text
          style={[
            styles.tabChipText,
            activeTab === 'payables' && styles.tabChipTextActiveAmber,
          ]}
        >
          Store Payables ({payablesCount})
        </Text>
      </TouchableOpacity>

      {/* Tab 3: All Transactions */}
      <TouchableOpacity
        style={[styles.tabChip, activeTab === 'all' && styles.tabChipActivePrimary]}
        onPress={() => onTabChange('all')}
        activeOpacity={0.7}
      >
        <Ionicons
          name="swap-horizontal"
          size={14}
          color={activeTab === 'all' ? '#09090B' : Colors.dark.textSecondary}
        />
        <Text
          style={[styles.tabChipText, activeTab === 'all' && styles.tabChipTextActivePrimary]}
        >
          All Transactions ({allCount})
        </Text>
      </TouchableOpacity>

      {/* Tab 4: Settled Inflows */}
      <TouchableOpacity
        style={[styles.tabChip, activeTab === 'inflows' && styles.tabChipActiveEmerald]}
        onPress={() => onTabChange('inflows')}
        activeOpacity={0.7}
      >
        <Ionicons
          name="checkmark-circle-outline"
          size={14}
          color={activeTab === 'inflows' ? '#10B981' : Colors.dark.textSecondary}
        />
        <Text
          style={[
            styles.tabChipText,
            activeTab === 'inflows' && styles.tabChipTextActiveEmerald,
          ]}
        >
          Settled Inflows ({inflowsCount})
        </Text>
      </TouchableOpacity>

      {/* Tab 5: Credit Ledger */}
      <TouchableOpacity
        style={[styles.tabChip, activeTab === 'credits' && styles.tabChipActiveAmber]}
        onPress={() => onTabChange('credits')}
        activeOpacity={0.7}
      >
        <Ionicons
          name="book-outline"
          size={14}
          color={activeTab === 'credits' ? '#F59E0B' : Colors.dark.textSecondary}
        />
        <Text
          style={[
            styles.tabChipText,
            activeTab === 'credits' && styles.tabChipTextActiveAmber,
          ]}
        >
          Credit Ledger ({creditsCount})
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabsScroll: {
    marginVertical: 6,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 6,
  },
  tabChipActiveRose: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  tabChipActiveAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  tabChipActivePrimary: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  tabChipActiveEmerald: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  tabChipTextActiveRose: {
    color: '#EF4444',
    fontWeight: '800',
  },
  tabChipTextActiveAmber: {
    color: '#F59E0B',
    fontWeight: '800',
  },
  tabChipTextActivePrimary: {
    color: '#09090B',
    fontWeight: '800',
  },
  tabChipTextActiveEmerald: {
    color: '#10B981',
    fontWeight: '800',
  },
});
