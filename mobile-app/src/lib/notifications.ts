import { Platform } from 'react-native';
import { mobileApiRequest } from './api';

/**
 * Register push notification token with dhraERP backend
 */
export async function registerPushTokenWithBackend(pushToken: string): Promise<boolean> {
  if (!pushToken) return false;
  try {
    await mobileApiRequest('/users/profile/push-token', {
      method: 'PATCH',
      body: JSON.stringify({ pushToken }),
    });
    return true;
  } catch (err: any) {
    console.warn('Could not register push token with backend:', err.message);
    return false;
  }
}

/**
 * Set up push notifications dynamically using Expo Notifications if available
 */
export async function setupPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    // Dynamic require with runtime checking
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Device = require('expo-device');

    if (!Device?.isDevice) {
      console.log('Push notifications require physical device');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token permission');
      return null;
    }

    const tokenObj = await Notifications.getExpoPushTokenAsync();
    const token = tokenObj?.data;

    if (token) {
      await registerPushTokenWithBackend(token);
    }

    return token;
  } catch {
    // Graceful fallback for simulator / web / development environment
    return null;
  }
}
