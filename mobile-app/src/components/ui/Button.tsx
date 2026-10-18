import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
  StyleProp,
} from 'react-native';
import { useTheme, useThemedStyles } from '@/lib/theme-context';
import { Ionicons } from '@expo/vector-icons';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
}: ButtonProps) {
  const { colors, isDark } = useTheme();
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isOutline = variant === 'outline';
  const isDanger = variant === 'danger';
  const isGhost = variant === 'ghost';

  const isSmall = size === 'sm';
  const isLarge = size === 'lg';

  const styles = useThemedStyles((c) =>
    StyleSheet.create({
      base: {
        height: 48,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
      },
      sm: {
        height: 38,
        paddingHorizontal: 12,
        borderRadius: 8,
      },
      lg: {
        height: 54,
        paddingHorizontal: 20,
        borderRadius: 14,
      },
      primary: {
        backgroundColor: c.primary,
      },
      secondary: {
        backgroundColor: c.secondary,
        borderWidth: 1,
        borderColor: c.borderMedium,
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: c.borderMedium,
      },
      danger: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
      },
      ghost: {
        backgroundColor: 'transparent',
      },
      disabled: {
        opacity: 0.45,
      },
      content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
      },
      icon: {
        marginRight: 8,
      },
      text: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.2,
      },
      textSm: {
        fontSize: 12.5,
      },
      textLg: {
        fontSize: 15.5,
      },
    })
  );

  const containerStyles: StyleProp<ViewStyle> = [
    styles.base,
    isSmall ? styles.sm : null,
    isLarge ? styles.lg : null,
    isPrimary ? styles.primary : null,
    isSecondary ? styles.secondary : null,
    isOutline ? styles.outline : null,
    isDanger ? styles.danger : null,
    isGhost ? styles.ghost : null,
    disabled || loading ? styles.disabled : null,
    style,
  ];

  let textColor: string = colors.primaryForeground;
  if (isSecondary || isOutline || isGhost) textColor = colors.text;
  if (isDanger) textColor = isDark ? '#FCA5A5' : '#DC2626';

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      style={containerStyles}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isPrimary ? colors.primaryForeground : colors.text}
        />
      ) : (
        <View style={styles.content}>
          {icon ? (
            <Ionicons
              name={icon}
              size={isSmall ? 16 : isLarge ? 20 : 18}
              color={textColor}
              style={styles.icon}
            />
          ) : null}
          <Text
            style={[
              styles.text,
              { color: textColor },
              isSmall && styles.textSm,
              isLarge && styles.textLg,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
