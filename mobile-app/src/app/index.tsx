import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { Colors } from '@/constants/theme';

export default function AppEntryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace('/(tabs)');
      } else {
        router.replace('/login');
      }
    }
  }, [isLoading, isAuthenticated, router]);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 24),
          paddingBottom: Math.max(insets.bottom, 24),
        },
      ]}
    >
      <View style={styles.logoBadge}>
        <Text style={styles.logoText}>SO</Text>
      </View>
      <ActivityIndicator size="small" color="#FFFFFF" style={styles.spinner} />
      <Text style={styles.loadingText}>Loading Shree Om Tiles...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoText: {
    color: '#09090B',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -1,
  },
  spinner: {
    marginBottom: 12,
  },
  loadingText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
