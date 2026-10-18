import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const rawApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const normalizedUrl = rawApiUrl ? rawApiUrl.replace(/\/+$/, '') : '';
export const API_BASE =
  normalizedUrl && Platform.OS === 'android' && (normalizedUrl.includes('localhost') || normalizedUrl.includes('127.0.0.1'))
    ? normalizedUrl.replace('localhost', '10.0.2.2').replace('127.0.0.1', '10.0.2.2')
    : normalizedUrl ||
      Platform.select({
        android: 'http://10.0.2.2:3001',
        ios: 'http://localhost:3001',
        default: 'http://localhost:3001',
      });

export const CACHE_PREFIX = 'dhra_mobile_cache:';

// Default network timeout. Heavy list endpoints can pass a larger `timeoutMs`.
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

// Android's AsyncStorage (SQLite) cannot read a single row larger than ~2MB back
// ("Row too big to fit into CursorWindow") and the whole DB is capped at ~6MB.
// Anything bigger than this is kept in memory by the screen only, never persisted.
const MAX_PERSISTED_CACHE_CHARS = 1_500_000;
const CACHE_STORAGE_TIMEOUT_MS = 1500;
let memToken: string | null = null;
let memUser: AuthUser | null = null;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  role: 'OWNER' | 'DIRECTOR' | 'ADMIN' | 'ACCOUNTANT' | 'SALESMAN' | 'DRIVER' | 'SUPERVISOR';
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

// In-flight request deduplication map to prevent redundant concurrent queries
const pendingMobileRequests = new Map<string, Promise<any>>();
// Listeners map to notify multiple subscribers of fresh background data
const revalidateListeners = new Map<string, Set<(freshData: any) => void>>();
// Generation counter and global epoch to detect and discard stale in-flight responses that resolve after a mutation
let globalMutationEpoch = 1;
const cacheKeyGenerations = new Map<string, number>();

function getCacheGeneration(key: string): number {
  return cacheKeyGenerations.get(key) || 0;
}

function bumpCacheGeneration(prefix?: string): void {
  globalMutationEpoch += 1;
  if (!prefix) {
    for (const k of cacheKeyGenerations.keys()) {
      cacheKeyGenerations.set(k, globalMutationEpoch);
    }
    return;
  }
  for (const k of cacheKeyGenerations.keys()) {
    if (k.includes(prefix)) {
      cacheKeyGenerations.set(k, globalMutationEpoch);
    }
  }
  cacheKeyGenerations.set(prefix, globalMutationEpoch);
}

// Global App Sync Event Emitter for reactive screen refreshes
export type SyncListener = () => void;
const syncListeners = new Set<SyncListener>();

export function subscribeToAppSync(listener: SyncListener): () => void {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

export function notifyAppSync(): void {
  syncListeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.warn('[Sync] Listener callback error:', err);
    }
  });
}

export async function clearMobileAuth(): Promise<void> {
  memToken = null;
  memUser = null;
  await AsyncStorage.multiRemove(['authToken', 'authUser']);
  pendingMobileRequests.clear();
  revalidateListeners.clear();
  await invalidateMobileApiCache();
}

export async function invalidateMobileApiCache(prefix?: string): Promise<void> {
  try {
    bumpCacheGeneration(prefix);
    if (prefix) {
      for (const key of pendingMobileRequests.keys()) {
        if (key.includes(prefix)) {
          pendingMobileRequests.delete(key);
          revalidateListeners.delete(key);
        }
      }
    } else {
      pendingMobileRequests.clear();
      revalidateListeners.clear();
    }

    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter(
      (k) => k.startsWith(CACHE_PREFIX) && (!prefix || k.includes(prefix)),
    );
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
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const {
    ttlMs: _ttl,
    forceRefresh: _force,
    onRevalidate: _onRev,
    timeoutMs,
    headers: optHeaders,
    ...restOptions
  } = options as any;

  const requestTimeoutMs =
    typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : DEFAULT_REQUEST_TIMEOUT_MS;
  const requestMethod = String(restOptions.method || 'GET').toUpperCase();
  // Only reads are safe to replay. Retrying a POST/PATCH/DELETE after a timeout can
  // apply it twice on the server (duplicate customers, duplicate payments, ...).
  const isIdempotent = requestMethod === 'GET' || requestMethod === 'HEAD';
  const maxAttempts = isIdempotent ? 3 : 1;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(optHeaders as Record<string, string>),
  };

  const token = await getMobileToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE}${cleanEndpoint}`;

  const callerSignal = (restOptions as any)?.signal as AbortSignal | undefined;
  if (callerSignal?.aborted) {
    const abortErr = new Error('Aborted');
    abortErr.name = 'AbortError';
    throw abortErr;
  }

  let res: Response;
  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    const onCallerAbort = () => {
      try {
        controller.abort();
      } catch {
        // ignore
      }
    };
    if (callerSignal) {
      callerSignal.addEventListener('abort', onCallerAbort, { once: true });
    }

    try {
      res = await fetch(url, { ...restOptions, headers, signal: controller.signal });
      clearTimeout(timer);
      if (callerSignal) {
        callerSignal.removeEventListener('abort', onCallerAbort);
      }
      break;
    } catch (error: any) {
      clearTimeout(timer);
      if (callerSignal) {
        callerSignal.removeEventListener('abort', onCallerAbort);
      }
      if (callerSignal?.aborted) {
        throw error;
      }
      const timedOut = error?.name === 'AbortError';
      // A timeout means the server/network is slow: replaying the request would only
      // multiply the wait (and re-download a large body), so fail fast instead.
      if (timedOut) {
        throw new Error('The server took too long to respond. Please check your connection and try again.');
      }
      if (attempt + 1 >= maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1500));
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

  // Automatically invalidate cache across all interdependent domains on mutations
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    if (endpoint.includes('/delivery')) {
      await invalidateMobileApiCache('/delivery');
      await invalidateMobileApiCache('/parties');
      await invalidateMobileApiCache('/invoices');
      await invalidateMobileApiCache('/payments');
      await invalidateMobileApiCache('/analytics');
      await invalidateMobileApiCache('/stock');
    } else if (endpoint.includes('/invoices')) {
      await invalidateMobileApiCache('/invoices');
      await invalidateMobileApiCache('/stock');
      await invalidateMobileApiCache('/analytics');
      await invalidateMobileApiCache('/payments');
      await invalidateMobileApiCache('/parties');
      await invalidateMobileApiCache('/quotations');
      await invalidateMobileApiCache('/delivery');
    } else if (endpoint.includes('/stock') || endpoint.includes('/warehouses') || endpoint.includes('/products')) {
      await invalidateMobileApiCache('/stock');
      await invalidateMobileApiCache('/products');
      await invalidateMobileApiCache('/warehouses');
      await invalidateMobileApiCache('/analytics');
      await invalidateMobileApiCache('/invoices');
    } else if (endpoint.includes('/payments') || endpoint.includes('/parties')) {
      await invalidateMobileApiCache('/payments');
      await invalidateMobileApiCache('/parties');
      await invalidateMobileApiCache('/analytics');
      await invalidateMobileApiCache('/invoices');
    } else if (endpoint.includes('/purchases')) {
      await invalidateMobileApiCache('/purchases');
      await invalidateMobileApiCache('/stock');
      await invalidateMobileApiCache('/analytics');
      await invalidateMobileApiCache('/payments');
      await invalidateMobileApiCache('/parties');
      await invalidateMobileApiCache('/warehouses');
    } else if (endpoint.includes('/expenses')) {
      await invalidateMobileApiCache('/expenses');
      await invalidateMobileApiCache('/analytics');
      await invalidateMobileApiCache('/payments');
    } else if (endpoint.includes('/quotations')) {
      await invalidateMobileApiCache('/quotations');
      await invalidateMobileApiCache('/invoices');
      await invalidateMobileApiCache('/analytics');
      await invalidateMobileApiCache('/stock');
      await invalidateMobileApiCache('/delivery');
      await invalidateMobileApiCache('/payments');
      await invalidateMobileApiCache('/parties');
    } else if (endpoint.includes('/users')) {
      await invalidateMobileApiCache('/users');
      await invalidateMobileApiCache('/analytics');
    } else if (endpoint.includes('/settings')) {
      await invalidateMobileApiCache('/settings');
    }

    // Notify all active screens and subscribers that state has changed
    notifyAppSync();
  }

  return res.json();
}

export interface CachedMobileRequestOptions<T = any> extends RequestInit {
  ttlMs?: number;
  timeoutMs?: number;
  forceRefresh?: boolean;
  onRevalidate?: (freshData: T) => void;
}

async function fetchAndCacheMobile<T>(
  endpoint: string,
  options: CachedMobileRequestOptions<T>,
  cacheKey: string,
): Promise<T> {
  if (options.signal?.aborted) {
    const abortErr = new Error('Aborted');
    abortErr.name = 'AbortError';
    return Promise.reject(abortErr);
  }

  if (!cacheKeyGenerations.has(cacheKey)) {
    cacheKeyGenerations.set(cacheKey, globalMutationEpoch);
  }
  const initialGen = cacheKeyGenerations.get(cacheKey)!;

  if (options.onRevalidate) {
    if (!revalidateListeners.has(cacheKey)) {
      revalidateListeners.set(cacheKey, new Set());
    }
    revalidateListeners.get(cacheKey)!.add(options.onRevalidate);
  }

  if (options.forceRefresh) {
    pendingMobileRequests.delete(cacheKey);
  } else if (pendingMobileRequests.has(cacheKey)) {
    return pendingMobileRequests.get(cacheKey) as Promise<T>;
  }

  const reqPromise = mobileApiRequest<T>(endpoint, options)
    .then(async (fresh) => {
      // Discard writing to cache if invalidated while request was in-flight
      if (getCacheGeneration(cacheKey) !== initialGen) {
        return fresh;
      }

      const serialized = JSON.stringify({ data: fresh, timestamp: Date.now() });
      const persist = serialized.length <= MAX_PERSISTED_CACHE_CHARS
        ? AsyncStorage.setItem(cacheKey, serialized)
        : AsyncStorage.removeItem(cacheKey);
      withTimeout(persist, CACHE_STORAGE_TIMEOUT_MS, undefined).catch(() => {
        // Cache persistence is best effort; the network response must not be blocked.
      });

      // Notify all registered listeners for this cache key
      const listeners = revalidateListeners.get(cacheKey);
      if (listeners && listeners.size > 0) {
        listeners.forEach((callback) => {
          try {
            callback(fresh);
          } catch (err) {
            console.warn('[Mobile SWR] Listener callback error:', err);
          }
        });
      }

      return fresh;
    })
    .finally(() => {
      pendingMobileRequests.delete(cacheKey);
      revalidateListeners.delete(cacheKey);
    });

  pendingMobileRequests.set(cacheKey, reqPromise);
  return reqPromise;
}

function revalidateMobileInBackground<T>(
  endpoint: string,
  options: CachedMobileRequestOptions<T>,
  cacheKey: string,
): void {
  fetchAndCacheMobile<T>(endpoint, options, cacheKey).catch((err: any) => {
    if (err?.name === 'AbortError') return;
    console.warn(`[Mobile SWR] Background revalidation failed for ${endpoint}:`, err);
  });
}

/**
 * Mobile Device Cache Request with Stale-While-Revalidate (SWR).
 * 1. Checks AsyncStorage: if fresh within ttlMs (default 5s), returns in 0ms without network roundtrip.
 * 2. If stale but cached data exists, returns cached data immediately (0ms UI render)
 *    and silently revalidates with the backend in the background, updating AsyncStorage
 *    and firing options.onRevalidate(freshData).
 * 3. Falls back to network on cache miss or forceRefresh: true.
 * 4. Deduplicates simultaneous in-flight requests and notifies all subscriber callbacks.
 * 5. Uses user-scoped cache keys to prevent cross-account cache collisions on shared devices.
 */
export async function cachedMobileApiRequest<T = any>(
  endpoint: string,
  options: CachedMobileRequestOptions<T> = {},
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    return mobileApiRequest<T>(endpoint, options);
  }

  const ttlMs = options.ttlMs ?? 5_000;
  const forceRefresh = options.forceRefresh ?? false;
  const user = await getMobileUser();
  const userPrefix = user?.id ? `${user.id}:` : '';
  const cacheKey = `${CACHE_PREFIX}${userPrefix}${endpoint}`;

  if (!forceRefresh) {
    try {
      const cached = await withTimeout(
        AsyncStorage.getItem(cacheKey),
        CACHE_STORAGE_TIMEOUT_MS,
        null,
      );
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
