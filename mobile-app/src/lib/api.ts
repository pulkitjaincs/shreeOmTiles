import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const rawApiUrl = process.env.EXPO_PUBLIC_API_URL;
export const API_BASE =
  rawApiUrl && Platform.OS === 'android' && rawApiUrl.includes('localhost')
    ? rawApiUrl.replace('localhost', '10.0.2.2')
    : rawApiUrl ||
      Platform.select({
        android: 'http://10.0.2.2:3001',
        ios: 'http://localhost:3001',
        default: 'http://localhost:3001',
      });

const CACHE_PREFIX = 'dhra_mobile_cache:';
let memToken: string | null = null;
let memUser: AuthUser | null = null;

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  role: 'OWNER' | 'ADMIN' | 'SALESMAN' | 'DRIVER';
  scope?: string | null;
}

export async function setMobileAuth(token: string | null, user: AuthUser | null) {
  memToken = token;
  memUser = user;
  if (token && user) {
    await AsyncStorage.multiSet([
      ['authToken', token],
      ['authUser', JSON.stringify(user)],
    ]);
  } else {
    await AsyncStorage.multiRemove(['authToken', 'authUser']);
  }
}

export async function setMobileToken(token: string | null) {
  memToken = token;
  if (token) {
    await AsyncStorage.setItem('authToken', token);
  } else {
    await AsyncStorage.removeItem('authToken');
  }
}

export async function getMobileToken(): Promise<string | null> {
  if (!memToken) {
    memToken = await AsyncStorage.getItem('authToken');
  }
  return memToken;
}

export async function getMobileUser(): Promise<AuthUser | null> {
  if (!memUser) {
    const raw = await AsyncStorage.getItem('authUser');
    if (raw) {
      try {
        memUser = JSON.parse(raw) as AuthUser;
      } catch {
        memUser = null;
      }
    }
  }
  return memUser;
}

export async function clearMobileAuth(): Promise<void> {
  memToken = null;
  memUser = null;
  await AsyncStorage.multiRemove(['authToken', 'authUser']);
  await invalidateMobileApiCache();
}

export async function invalidateMobileApiCache(prefix?: string): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const target = prefix ? `${CACHE_PREFIX}${prefix}` : CACHE_PREFIX;
    const toRemove = keys.filter((k) => k.startsWith(target));
    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch (e) {
    console.warn('Failed to clear mobile cache', e);
  }
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setOnUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

export async function mobileApiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const token = await getMobileToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  let res: Response;
  for (let attempt = 0; ; attempt += 1) {
    try {
      res = await fetch(url, { ...options, headers });
      break;
    } catch (error) {
      if (attempt >= 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
  }

  if (!res.ok) {
    if (res.status === 401 && !endpoint.includes('/auth/login')) {
      await clearMobileAuth();
      if (unauthorizedHandler) {
        unauthorizedHandler();
      }
      throw new Error('Your session has expired. Please log in again.');
    }

    let errorMsg = 'An error occurred';
    try {
      const err = await res.json();
      errorMsg = err.message || errorMsg;
      if (Array.isArray(errorMsg)) errorMsg = errorMsg.join(', ');
    } catch {
      errorMsg = res.statusText || errorMsg;
    }
    throw new Error(errorMsg);
  }

  // Automatically invalidate cache on mutations
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    if (endpoint.includes('/delivery')) {
      await invalidateMobileApiCache('/delivery');
      await invalidateMobileApiCache('/analytics');
    } else if (endpoint.includes('/invoices')) {
      await invalidateMobileApiCache('/invoices');
      await invalidateMobileApiCache('/stock');
      await invalidateMobileApiCache('/analytics');
      await invalidateMobileApiCache('/payments');
    } else if (endpoint.includes('/stock') || endpoint.includes('/warehouses') || endpoint.includes('/products')) {
      await invalidateMobileApiCache('/stock');
      await invalidateMobileApiCache('/products');
      await invalidateMobileApiCache('/warehouses');
      await invalidateMobileApiCache('/analytics');
    } else if (endpoint.includes('/payments') || endpoint.includes('/parties')) {
      await invalidateMobileApiCache('/payments');
      await invalidateMobileApiCache('/parties');
      await invalidateMobileApiCache('/analytics');
    } else if (endpoint.includes('/users')) {
      await invalidateMobileApiCache('/users');
      await invalidateMobileApiCache('/analytics');
    } else if (endpoint.includes('/settings')) {
      await invalidateMobileApiCache('/settings');
    }
  }

  return res.json();
}

export interface CachedMobileRequestOptions<T = any> extends RequestInit {
  ttlMs?: number;
  forceRefresh?: boolean;
  onRevalidate?: (freshData: T) => void;
}

// In-flight request deduplication map to prevent redundant concurrent queries
const pendingMobileRequests = new Map<string, Promise<any>>();

async function fetchAndCacheMobile<T>(
  endpoint: string,
  options: CachedMobileRequestOptions<T>,
  cacheKey: string,
): Promise<T> {
  if (pendingMobileRequests.has(cacheKey)) {
    return pendingMobileRequests.get(cacheKey) as Promise<T>;
  }

  const reqPromise = mobileApiRequest<T>(endpoint, options)
    .then(async (fresh) => {
      try {
        await AsyncStorage.setItem(
          cacheKey,
          JSON.stringify({ data: fresh, timestamp: Date.now() }),
        );
      } catch {
        await invalidateMobileApiCache();
      }
      return fresh;
    })
    .finally(() => {
      pendingMobileRequests.delete(cacheKey);
    });

  pendingMobileRequests.set(cacheKey, reqPromise);
  return reqPromise;
}

function revalidateMobileInBackground<T>(
  endpoint: string,
  options: CachedMobileRequestOptions<T>,
  cacheKey: string,
): void {
  if (pendingMobileRequests.has(cacheKey)) return;

  fetchAndCacheMobile<T>(endpoint, options, cacheKey)
    .then((fresh) => {
      if (options.onRevalidate) {
        options.onRevalidate(fresh);
      }
    })
    .catch((err) => {
      console.warn(`[Mobile SWR] Background revalidation failed for ${endpoint}:`, err);
    });
}

/**
 * Mobile Device Cache Request with Stale-While-Revalidate (SWR).
 * 1. Checks AsyncStorage: if fresh within ttlMs, returns in 0ms without network roundtrip.
 * 2. If stale but cached data exists, returns cached data immediately (0ms UI render)
 *    and silently revalidates with the Render backend in the background, updating AsyncStorage
 *    and firing options.onRevalidate(freshData).
 * 3. Falls back to network on cache miss or forceRefresh: true.
 * 4. Deduplicates simultaneous in-flight requests for identical endpoints.
 */
export async function cachedMobileApiRequest<T = any>(
  endpoint: string,
  options: CachedMobileRequestOptions<T> = {},
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    return mobileApiRequest<T>(endpoint, options);
  }

  const ttlMs = options.ttlMs ?? 60_000;
  const forceRefresh = options.forceRefresh ?? false;
  const cacheKey = `${CACHE_PREFIX}${endpoint}`;

  if (!forceRefresh) {
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as { data: T; timestamp: number };
        const age = Date.now() - parsed.timestamp;
        const isFresh = age < ttlMs;

        if (isFresh) {
          return parsed.data;
        }

        // Stale-While-Revalidate: Return cached data immediately so mobile screen renders with 0ms delay!
        revalidateMobileInBackground<T>(endpoint, options, cacheKey);
        return parsed.data;
      }
    } catch {
      // Fall through to network
    }
  }

  return fetchAndCacheMobile<T>(endpoint, options, cacheKey);
}
