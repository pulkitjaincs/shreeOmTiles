import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { Platform } from 'react-native';
import { CACHE_PREFIX, invalidateMobileApiCache, notifyAppSync } from './api';

export const CACHE_CLEANUP_INTERVAL_DAYS = 7;
export const CACHE_CLEANUP_INTERVAL_MS = CACHE_CLEANUP_INTERVAL_DAYS * 24 * 60 * 60 * 1000; // 604,800,000 ms
export const LAST_CACHE_CLEANUP_KEY = 'dhra_cache_last_auto_cleaned_at';

export interface CacheStats {
  keysCount: number;
  approxKb: number;
  lastCleanedAt: number | null;
  lastCleanedText: string;
  nextCleanupDueDays: number;
}

/**
 * Formats a unix timestamp into human-readable relative or date string
 */
export function formatCleanupTime(timestamp: number | null): string {
  if (!timestamp) return 'Never';
  const now = Date.now();
  const diffMs = now - timestamp;
  if (diffMs < 0) return 'Just now';
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  const d = new Date(timestamp);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Safely deletes temporary files stored in FileSystem.cacheDirectory (e.g. downloaded PDF invoices)
 */
async function clearTemporaryFiles(): Promise<number> {
  if (Platform.OS === 'web' || !FileSystem.cacheDirectory) {
    return 0;
  }
  let filesRemoved = 0;
  try {
    const dir = FileSystem.cacheDirectory;
    const items = await FileSystem.readDirectoryAsync(dir);
    for (const item of items) {
      try {
        const itemPath = `${dir}${item}`;
        await FileSystem.deleteAsync(itemPath, { idempotent: true });
        filesRemoved += 1;
      } catch {
        // Individual file delete failure ignored
      }
    }
  } catch (err) {
    console.warn('[CacheManager] Error reading/clearing cache directory:', err);
  }
  return filesRemoved;
}

/**
 * Asynchronously clears expo-image memory and disk cache
 */
async function clearImageCache(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (typeof Image.clearMemoryCache === 'function') {
      await Image.clearMemoryCache();
    }
    if (typeof Image.clearDiskCache === 'function') {
      await Image.clearDiskCache();
    }
  } catch (err) {
    console.warn('[CacheManager] Error clearing image cache:', err);
  }
}

/**
 * Computes live statistics on cached data in the mobile app
 */
export async function getCacheStats(): Promise<CacheStats> {
  let keysCount = 0;
  let approxBytes = 0;
  let lastCleanedAt: number | null = null;

  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));
    keysCount = cacheKeys.length;

    if (cacheKeys.length > 0) {
      const pairs = await AsyncStorage.multiGet(cacheKeys);
      for (const [, val] of pairs) {
        if (val) {
          approxBytes += val.length;
        }
      }
    }

    const rawLast = await AsyncStorage.getItem(LAST_CACHE_CLEANUP_KEY);
    if (rawLast) {
      const parsed = parseInt(rawLast, 10);
      if (!isNaN(parsed)) {
        lastCleanedAt = parsed;
      }
    }
  } catch (err) {
    console.warn('[CacheManager] Error computing cache stats:', err);
  }

  const approxKb = Math.round((approxBytes / 1024) * 10) / 10;
  const lastCleanedText = formatCleanupTime(lastCleanedAt);

  let nextCleanupDueDays = CACHE_CLEANUP_INTERVAL_DAYS;
  if (lastCleanedAt) {
    const elapsedMs = Date.now() - lastCleanedAt;
    const remainingMs = Math.max(0, CACHE_CLEANUP_INTERVAL_MS - elapsedMs);
    nextCleanupDueDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
  }

  return {
    keysCount,
    approxKb,
    lastCleanedAt,
    lastCleanedText,
    nextCleanupDueDays,
  };
}

/**
 * Performs a complete purge of local API cache, temporary PDF files, and image buffers.
 * Preserves user authentication credentials ('authToken', 'authUser') and push notification settings.
 */
export async function clearMobileAppCache(): Promise<{
  clearedKeysCount: number;
  clearedFilesCount: number;
  timestamp: number;
}> {
  let clearedKeysCount = 0;
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));
    clearedKeysCount = cacheKeys.length;

    // Purge AsyncStorage cache keys & in-flight request deduplication map
    await invalidateMobileApiCache();
  } catch (err) {
    console.warn('[CacheManager] Error clearing AsyncStorage cache:', err);
  }

  // Purge temporary files from FileSystem.cacheDirectory (PDFs, temp exports)
  const clearedFilesCount = await clearTemporaryFiles();

  // Purge expo-image caches
  await clearImageCache();

  // Update last cleaned timestamp
  const now = Date.now();
  try {
    await AsyncStorage.setItem(LAST_CACHE_CLEANUP_KEY, String(now));
  } catch (err) {
    console.warn('[CacheManager] Error updating cleanup timestamp:', err);
  }

  // Proactively notify subscribed active screens to refresh fresh data
  try {
    notifyAppSync();
  } catch (err) {
    console.warn('[CacheManager] Error notifying app sync:', err);
  }

  return {
    clearedKeysCount,
    clearedFilesCount,
    timestamp: now,
  };
}

/**
 * Checks if 7 days have passed since the last cache purge.
 * If >= 7 days have elapsed, clears cache automatically and records current timestamp.
 * If running for the first time, initializes timestamp to now without clearing.
 */
export async function checkAndRunAutoCacheCleanup(): Promise<{
  triggered: boolean;
  reason?: 'ELAPSED_7_DAYS' | 'INITIALIZED' | 'WITHIN_INTERVAL';
  clearedKeysCount?: number;
  clearedFilesCount?: number;
  lastCleanedAt: number;
}> {
  try {
    const rawLast = await AsyncStorage.getItem(LAST_CACHE_CLEANUP_KEY);
    const now = Date.now();

    if (!rawLast) {
      // First run: initialize timestamp to now so first purge occurs in 7 days
      await AsyncStorage.setItem(LAST_CACHE_CLEANUP_KEY, String(now));
      return {
        triggered: false,
        reason: 'INITIALIZED',
        lastCleanedAt: now,
      };
    }

    const lastTime = parseInt(rawLast, 10);
    if (isNaN(lastTime)) {
      await AsyncStorage.setItem(LAST_CACHE_CLEANUP_KEY, String(now));
      return {
        triggered: false,
        reason: 'INITIALIZED',
        lastCleanedAt: now,
      };
    }

    const elapsed = now - lastTime;
    if (elapsed >= CACHE_CLEANUP_INTERVAL_MS) {
      console.log(
        `[CacheManager] 7-day threshold reached (${Math.round(elapsed / (1000 * 60 * 60 * 24))} days since last cleanup). Executing auto-purge...`,
      );
      const res = await clearMobileAppCache();
      return {
        triggered: true,
        reason: 'ELAPSED_7_DAYS',
        clearedKeysCount: res.clearedKeysCount,
        clearedFilesCount: res.clearedFilesCount,
        lastCleanedAt: res.timestamp,
      };
    }

    return {
      triggered: false,
      reason: 'WITHIN_INTERVAL',
      lastCleanedAt: lastTime,
    };
  } catch (err) {
    console.warn('[CacheManager] Auto cache check failed:', err);
    return {
      triggered: false,
      lastCleanedAt: Date.now(),
    };
  }
}
