import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { useTheme, useThemedStyles } from '@/lib/theme-context';
import { getInitials } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  rightAction?: {
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  };
  onBack?: () => void;
  showBrand?: boolean;
}

export function Header({
  title,
  subtitle,
  rightAction,
  onBack,
  showBrand = true,
}: HeaderProps) {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0,
  );

  const styles = useThemedStyles((c, dark) =>
    StyleSheet.create({
      header: {
        backgroundColor: c.background,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
      },
      headerContent: {
        height: 58,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
      },
      left: {
        flex: 1,
        justifyContent: 'center',
      },
      backRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      },
      backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: c.cardElevated,
        borderWidth: 1,
        borderColor: c.border,
        alignItems: 'center',
        justifyContent: 'center',
      },
      brandContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      },
      logoBadge: {
        width: 36,
        height: 36,
        borderRadius: 9,
        backgroundColor: dark ? '#000000' : '#FFFFFF',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: c.borderMedium,
        alignItems: 'center',
        justifyContent: 'center',
      },
      logoImage: {
        width: 34,
        height: 34,
        borderRadius: 7,
      },
      brandTitle: {
        color: c.text,
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: -0.2,
      },
      brandSubtitle: {
        color: c.textSecondary,
        fontSize: 10.5,
        fontWeight: '500',
      },
      pageTitle: {
        color: c.text,
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: -0.3,
      },
      pageSubtitle: {
        color: c.textSecondary,
        fontSize: 11,
      },
      right: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      },
      actionBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.border,
        alignItems: 'center',
        justifyContent: 'center',
      },
      userBadge: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: c.cardElevated,
        borderWidth: 1,
        borderColor: c.borderMedium,
        alignItems: 'center',
        justifyContent: 'center',
      },
      userInitials: {
        color: c.text,
        fontSize: 12,
        fontWeight: '800',
      },
    })
  );

  return (
    <View style={[styles.header, { paddingTop: topPadding }]}>
      <View style={styles.headerContent}>
        <View style={styles.left}>
          {onBack ? (
            <View style={styles.backRow}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={onBack}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="arrow-back" size={20} color={colors.text} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                {title ? (
                  <Text style={styles.pageTitle} numberOfLines={1}>
                    {title}
                  </Text>
                ) : null}
                {subtitle ? (
                  <Text style={styles.pageSubtitle} numberOfLines={1}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : showBrand ? (
            <View style={styles.brandContainer}>
              <View style={styles.logoBadge}>
                <Image
                  source={require('@/assets/images/icon.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.brandTitle} numberOfLines={1}>
                  {title || 'Shree Om Tiles'}
                </Text>
                <Text style={styles.brandSubtitle} numberOfLines={1}>
                  {subtitle || (user?.role ? `${user.role === 'OWNER' || (user.role as any) === 'DIRECTOR' ? 'Director' : user.role} Portal` : 'ERP Portal')}
                </Text>
              </View>
            </View>
          ) : (
            <View>
              {title ? (
                <Text style={styles.pageTitle} numberOfLines={1}>
                  {title}
                </Text>
              ) : null}
              {subtitle ? (
                <Text style={styles.pageSubtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          )}
        </View>

        <View style={styles.right}>
          {rightAction ? (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={rightAction.onPress}
              activeOpacity={0.7}
            >
              <Ionicons name={rightAction.icon} size={18} color={colors.text} />
            </TouchableOpacity>
          ) : null}

          {user ? (
            <View style={styles.userBadge}>
              <Text style={styles.userInitials}>{getInitials(user.name)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
