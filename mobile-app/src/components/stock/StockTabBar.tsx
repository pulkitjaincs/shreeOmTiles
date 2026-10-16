import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

interface StockTabBarProps {
  activeTab: 'STOCK' | 'PRODUCTS';
  onTabChange: (tab: 'STOCK' | 'PRODUCTS') => void;
  stockCount: number;
  productCount: number;
}

export function StockTabBar({
  activeTab,
  onTabChange,
  stockCount,
  productCount,
}: StockTabBarProps) {
  return (
    <View style={styles.viewToggleBar}>
      <TouchableOpacity
        style={[styles.toggleTab, activeTab === 'STOCK' && styles.toggleTabActive]}
        onPress={() => onTabChange('STOCK')}
        activeOpacity={0.7}
      >
        <Ionicons
          name="cube-outline"
          size={16}
          color={activeTab === 'STOCK' ? '#09090B' : Colors.dark.textSecondary}
        />
        <Text
          style={[styles.toggleTabText, activeTab === 'STOCK' && styles.toggleTabTextActive]}
          numberOfLines={1}
        >
          Live Stock ({stockCount})
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.toggleTab, activeTab === 'PRODUCTS' && styles.toggleTabActive]}
        onPress={() => onTabChange('PRODUCTS')}
        activeOpacity={0.7}
      >
        <Ionicons
          name="layers-outline"
          size={16}
          color={activeTab === 'PRODUCTS' ? '#09090B' : Colors.dark.textSecondary}
        />
        <Text
          style={[styles.toggleTabText, activeTab === 'PRODUCTS' && styles.toggleTabTextActive]}
          numberOfLines={1}
        >
          Product Catalog ({productCount})
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  viewToggleBar: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 3,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
  },
  toggleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  toggleTabActive: {
    backgroundColor: '#FFFFFF',
  },
  toggleTabText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  toggleTabTextActive: {
    color: '#09090B',
  },
});
