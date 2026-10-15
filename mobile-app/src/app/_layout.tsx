import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform, StatusBar as RNStatusBar } from 'react-native';
import { AuthProvider } from '@/lib/auth-context';
import { setupNotificationListeners } from '@/lib/notifications';
import { Colors } from '@/constants/theme';

function NotificationListenerWrapper() {
  useEffect(() => {
    const unsubscribe = setupNotificationListeners();
    return () => {
      unsubscribe();
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
        <NotificationListenerWrapper />
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

