import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, useThemedStyles } from '@/lib/theme-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionTitle?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  description,
  actionTitle,
  onAction,
}: EmptyStateProps) {
  const { colors } = useTheme();

  const styles = useThemedStyles((c) =>
    StyleSheet.create({
      container: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        paddingHorizontal: 24,
      },
      iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
      },
      title: {
        fontSize: 16,
        fontWeight: '700',
        color: c.text,
        marginBottom: 6,
        textAlign: 'center',
      },
      description: {
        fontSize: 13,
        color: c.textSecondary,
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 16,
      },
      actionBtn: {
        minWidth: 130,
      },
    })
  );

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={32} color={colors.textSecondary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionTitle && onAction ? (
        <Button
          title={actionTitle}
          onPress={onAction}
          variant="secondary"
          size="sm"
          style={styles.actionBtn}
        />
      ) : null}
    </View>
  );
}
