import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform, StatusBar as RNStatusBar, Alert, AppState } from 'react-native';
import * as Updates from 'expo-updates';
import { AuthProvider } from '@/lib/auth-context';
import { setupNotificationListeners } from '@/lib/notifications';
import { notifyAppSync } from '@/lib/api';
import { Colors } from '@/constants/theme';
import { checkAndRunAutoCacheCleanup } from '@/lib/cache-manager';

function AppStateSyncListenerWrapper() {
  const appState = React.useRef(AppState.currentState);

  useEffect(() => {
    // Check and run 7-day automatic cache purge on app launch
    checkAndRunAutoCacheCleanup().catch((err) => {
      console.warn('[CacheManager] Auto cache check failed on startup:', err);
    });

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App resumed to foreground: revalidate active screen in background without destroying offline cache
        notifyAppSync();
        // Check if 7-day threshold elapsed while app was backgrounded
        checkAndRunAutoCacheCleanup().catch((err) => {
          console.warn('[CacheManager] Auto cache check failed on foreground resume:', err);
        });
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return null;
}

function NotificationListenerWrapper() {
  useEffect(() => {
    const unsubscribe = setupNotificationListeners();
    return () => {
      unsubscribe();
    };
  }, []);

  return null;
}

function OtaUpdateListenerWrapper() {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;

    let isMounted = true;
    async function checkForUpdates() {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable && isMounted) {
          const fetchResult = await Updates.fetchUpdateAsync();
          if (fetchResult.isNew && isMounted) {
            Alert.alert(
              'Update Available',
              'A new ERP update has been downloaded. Restart the app now to apply the changes?',
              [
                { text: 'Later', style: 'cancel' },
                {
                  text: 'Restart Now',
                  onPress: () => {
                    Updates.reloadAsync().catch((err) => {
                      console.warn('[OTA] Failed to reload:', err);
                    });
                  },
                },
              ]
            );
          }
        }
      } catch (error) {
        // Suppress network errors in offline mode
        console.warn('[OTA] Update check failed or offline:', error);
      }
    }

    // Run check 3 seconds after launch to ensure initial render completes smoothly
    const timer = setTimeout(() => {
      checkForUpdates();
    }, 3000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  return null;
}

export default function RootLayout() {
  if (Platform.OS === 'android') {
    RNStatusBar.setBackgroundColor(Colors.dark.background, true);
    RNStatusBar.setBarStyle('light-content', true);
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppStateSyncListenerWrapper />
        <NotificationListenerWrapper />
        <OtaUpdateListenerWrapper />
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.dark.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

