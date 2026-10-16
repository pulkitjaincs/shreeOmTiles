import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Image } from 'react-native';
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
        <Image
          source={require('@/assets/images/icon.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
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
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#000000',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoImage: {
    width: 60,
    height: 60,
    borderRadius: 16,
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
