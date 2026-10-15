import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors } from '@/constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
  onPress?: () => void;
}

export function Card({ children, style, elevated = false, onPress }: CardProps) {
  const cardStyles: StyleProp<ViewStyle> = [
    styles.card,
    elevated ? styles.elevated : styles.standard,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={onPress}
        style={cardStyles}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyles}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 16,
    marginBottom: 12,
  },
  standard: {
    backgroundColor: Colors.dark.card,
  },
  elevated: {
    backgroundColor: Colors.dark.cardElevated,
    borderColor: Colors.dark.borderMedium,
  },
});
