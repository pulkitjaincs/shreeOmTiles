import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { getInitials } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  rightAction?: {
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  };
  showBrand?: boolean;
}

export function Header({
  title,
  subtitle,
  rightAction,
  showBrand = true,
}: HeaderProps) {
  const { user } = useAuth();

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        {showBrand ? (
          <View style={styles.brandContainer}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>SO</Text>
            </View>
            <View>
              <Text style={styles.brandTitle}>{title || 'Shree Om Tiles'}</Text>
              <Text style={styles.brandSubtitle}>
                {subtitle || (user?.role ? `${user.role} Portal` : 'Tiles & Sanitaryware')}
              </Text>
            </View>
          </View>
        ) : (
          <View>
            {title ? <Text style={styles.pageTitle}>{title}</Text> : null}
            {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
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
            <Ionicons name={rightAction.icon} size={18} color="#FFFFFF" />
          </TouchableOpacity>
        ) : null}

        {user ? (
          <View style={styles.userBadge}>
            <Text style={styles.userInitials}>{getInitials(user.name)}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 60,
    backgroundColor: Colors.dark.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  left: {
    flex: 1,
    justifyContent: 'center',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#09090B',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  brandSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 10.5,
    fontWeight: '500',
  },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    color: Colors.dark.textSecondary,
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
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.dark.cardElevated,
    borderWidth: 1,
    borderColor: Colors.dark.borderMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInitials: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
