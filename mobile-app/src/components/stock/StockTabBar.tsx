import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/lib/theme-context';

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
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);

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
          color={activeTab === 'STOCK' ? (isDark ? '#09090B' : '#FFFFFF') : colors.textSecondary}
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
          color={activeTab === 'PRODUCTS' ? (isDark ? '#09090B' : '#FFFFFF') : colors.textSecondary}
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

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    viewToggleBar: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
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
      backgroundColor: isDark ? '#FFFFFF' : '#09090B',
    },
    toggleTabText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    toggleTabTextActive: {
      color: isDark ? '#09090B' : '#FFFFFF',
    },
  });
