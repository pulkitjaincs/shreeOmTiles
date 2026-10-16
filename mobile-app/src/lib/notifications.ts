import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { router } from 'expo-router';
import { mobileApiRequest } from './api';

// Configure foreground notification behavior safely
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  });
} catch (err: any) {
  console.warn('[Push] setNotificationHandler warning:', err?.message || err);
}


/**
 * Configure Android notification channels for heads-up alerts and custom vibration
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS === 'android' && !isRunningInExpoGo()) {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'DhraERP Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#D97706',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    } catch (err: any) {
      console.warn('[Push] Channel setup warning:', err?.message || err);
    }
  }
}

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
    console.warn('[Push] Could not register push token with backend:', err.message);
    return false;
  }
}

/**
 * Clear push notification token from dhraERP backend upon logout
 */
export async function unregisterPushTokenWithBackend(): Promise<boolean> {
  try {
    await mobileApiRequest('/users/profile/push-token', {
      method: 'PATCH',
      body: JSON.stringify({ pushToken: '' }),
    });
    return true;
  } catch (err: any) {
    console.warn('[Push] Could not unregister push token:', err.message);
    return false;
  }
}

/**
 * Set up push notifications dynamically using Expo Notifications
 * Prompts user for permission, retrieves device Expo Push Token, and updates backend
 */
export async function setupPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    await setupNotificationChannels();

    if (!Device.isDevice) {
      console.log('[Push] Physical device required for push notifications');
      return null;
    }

    if (isRunningInExpoGo()) {
      console.log('[Push] Running in Expo Go: remote push token registration is not supported on Android in Expo Go. Skipping remote token registration. (Use standalone APK / EAS dev build for full push notifications).');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Push notification permission denied or dismissed');
      return null;
    }

    // EAS Project ID from app.json
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      '7a84db34-9091-4aeb-b253-fd5636418ecb';

    const tokenObj = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const token = tokenObj?.data;

    if (token) {
      await registerPushTokenWithBackend(token);
    }

    return token;
  } catch (err: any) {
    console.warn('[Push] Setup push notification error:', err?.message || err);
    return null;
  }
}

/**
 * Setup notification response / click listeners for deep linking
 * Routes drivers to delivery tab on assignment and admins to invoices/deliveries on sales/collections
 */
export function setupNotificationListeners(): () => void {
  if (Platform.OS === 'web') {
    return () => {};
  }

  try {
    // Foreground notification handler
    const notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[Push] Received in foreground:', notification.request.content.title);
    });

    // Tapped notification interaction handler
    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log('[Push] Notification tapped with payload:', data);

      if (
        data?.type === 'DELIVERY_ASSIGNED' ||
        data?.type === 'CASH_COLLECTED' ||
        data?.type === 'CASH_HANDED_OVER' ||
        data?.type === 'DELIVERY_COMPLETED' ||
        data?.type === 'DELIVERY_CANCELLED'
      ) {
        router.push('/(tabs)/deliveries');
      } else if (
        data?.type === 'NEW_INVOICE' ||
        data?.type === 'CREDIT_NOTE_ISSUED'
      ) {
        router.push('/(tabs)/invoices');
      } else if (data?.type === 'PAYMENT_RECEIVED') {
        router.push('/(tabs)/transactions');
      }
    });

    return () => {
      try {
        notificationListener.remove();
        responseListener.remove();
      } catch {}
    };
  } catch (err: any) {
    console.warn('[Push] Failed to register notification listeners:', err?.message || err);
    return () => {};
  }
}

/**
 * Triggers a local test alert to immediately verify banner, sound, and vibration on device
 */
export async function testLocalNotification(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    await setupNotificationChannels();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 DhraERP Notification Test',
        body: 'Push alerts, sound, and vibration are active and working on this device.',
        sound: 'default',
        data: { type: 'TEST' },
      },
      trigger: null,
    });
    return true;
  } catch (err: any) {
    console.warn('[Push] Test notification error:', err?.message || err);
    return false;
  }
}

