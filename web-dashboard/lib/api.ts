const RAW_API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const API_BASE = RAW_API_BASE.replace(/\/+$/, '');
const CACHE_PREFIX = 'shreeom_cache:';

export interface ApiError {
  message: string;
  statusCode?: number;
}

export interface CachedRequestOptions<T = unknown> extends RequestInit {
  ttlMs?: number;
  forceRefresh?: boolean;
  onRevalidate?: (freshData: T) => void;
}

/**
 * Invalidate client device cache entries stored in localStorage.
 * If endpointPrefix is provided, only matching keys are cleared.
 */
export function invalidateApiCache(endpointPrefix?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    const targetPrefix = endpointPrefix ? `${CACHE_PREFIX}${endpointPrefix}` : CACHE_PREFIX;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(targetPrefix)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch (e) {
    console.warn('Failed to invalidate client device cache', e);
  }
}

/**
 * Standard API request with automatic token injection and mutation cache invalidation.
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  retryCount: number = 0,
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${cleanEndpoint}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch {
    // If network fails (e.g. cloud server waking up from sleep), automatically retry up to 2 times
    if (retryCount < 2) {
      console.warn(`[API] Server waking up or network delay for ${endpoint}. Retrying in 2.5s (attempt ${retryCount + 1})...`);
      await new Promise((resolve) => setTimeout(resolve, 2500));
      return apiRequest<T>(endpoint, options, retryCount + 1);
    }
    throw new Error('Unable to connect to cloud server. The service may be waking up from overnight sleep, please retry.');
  }

  if (!res.ok) {
    let errorMsg = 'An unexpected error occurred';
    try {
      const errData = (await res.json()) as { message?: string | string[]; error?: string };
      if (errData.message) {
        errorMsg = Array.isArray(errData.message) ? errData.message.join(', ') : errData.message;
      } else if (errData.error) {
        errorMsg = errData.error;
      }
    } catch {
      errorMsg = res.statusText || errorMsg;
    }

    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = '/login';
    }

    throw new Error(errorMsg);
  }

  // Invalidate device cache automatically if a mutation was executed
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    if (endpoint.includes('/invoices')) {
      invalidateApiCache('/invoices');
      invalidateApiCache('/stock');
      invalidateApiCache('/analytics');
      invalidateApiCache('/payments');
    } else if (endpoint.includes('/products')) {
      invalidateApiCache('/products');
      invalidateApiCache('/stock');
      invalidateApiCache('/analytics');
    } else if (endpoint.includes('/stock')) {
      invalidateApiCache('/stock');
      invalidateApiCache('/products');
      invalidateApiCache('/analytics');
    } else if (endpoint.includes('/payments')) {
      invalidateApiCache('/payments');
      invalidateApiCache('/invoices');
      invalidateApiCache('/analytics');
    } else if (endpoint.includes('/delivery')) {
      invalidateApiCache('/delivery');
      invalidateApiCache('/analytics');
    } else if (endpoint.includes('/parties')) {
      invalidateApiCache('/parties');
    } else if (endpoint.includes('/warehouses')) {
      invalidateApiCache('/warehouses');
      invalidateApiCache('/stock');
      invalidateApiCache('/products');
      invalidateApiCache('/analytics');
    } else if (endpoint.includes('/users')) {
      invalidateApiCache('/users');
      invalidateApiCache('/analytics');
    } else if (endpoint.includes('/settings')) {
      invalidateApiCache('/settings');
    }
  }

  // If response is a blob/file (e.g. PDF download)
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/pdf')) {
    const blob = await res.blob();
    return blob as unknown as T;
  }

  return (await res.json()) as T;
}

// In-flight request deduplication map to prevent multiple identical concurrent requests
const pendingRequests = new Map<string, Promise<unknown>>();

function fetchAndCache<T>(
  endpoint: string,
  options: CachedRequestOptions<T>,
  cacheKey: string,
): Promise<T> {
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey) as Promise<T>;
  }

  const reqPromise = apiRequest<T>(endpoint, options)
    .then((freshData) => {
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({
              data: freshData,
              timestamp: Date.now(),
            }),
          );
        } catch {
          // Gracefully prune older cache entries rather than wiping the entire cache
          try {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && k.startsWith(CACHE_PREFIX) && k !== cacheKey) {
                keysToRemove.push(k);
              }
            }
            keysToRemove.slice(0, Math.ceil(keysToRemove.length / 2)).forEach((k) => localStorage.removeItem(k));
          } catch {
            // Storage unavailable or full, continue gracefully
          }
        }
      }
      return freshData;
    })
    .finally(() => {
      pendingRequests.delete(cacheKey);
    });

  pendingRequests.set(cacheKey, reqPromise);
  return reqPromise;
}

function revalidateInBackground<T>(
  endpoint: string,
  options: CachedRequestOptions<T>,
  cacheKey: string,
): void {
  if (pendingRequests.has(cacheKey)) return;

  fetchAndCache<T>(endpoint, options, cacheKey)
    .then((freshData) => {
      if (options.onRevalidate) {
        options.onRevalidate(freshData);
      }
    })
    .catch((err) => {
      console.warn(`[SWR] Background revalidation failed for ${endpoint}:`, err);
    });
}

/**
 * Client-side Device Cache Request with Stale-While-Revalidate (SWR) support.
 * 1. Checks localStorage: if fresh within ttlMs, returns instantaneously (0ms network roundtrip).
 * 2. If stale but cached data exists, returns cached data immediately (0ms UI render)
 *    and silently revalidates with the server in the background, updating localStorage
 *    and firing options.onRevalidate(freshData).
 * 3. Falls back to network on cache miss or forceRefresh: true.
 * 4. Deduplicates simultaneous in-flight requests for identical endpoints.
 */
export async function cachedApiRequest<T = unknown>(
  endpoint: string,
  options: CachedRequestOptions<T> = {},
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    return apiRequest<T>(endpoint, options);
  }

  const ttlMs = options.ttlMs ?? 60_000; // default 1 minute device cache
  const forceRefresh = options.forceRefresh ?? false;
  const cacheKey = `${CACHE_PREFIX}${endpoint}`;

  if (!forceRefresh && typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as { data: T; timestamp: number };
        const age = Date.now() - parsed.timestamp;
        const isFresh = age < ttlMs;

        if (isFresh) {
          return parsed.data;
        }

        // Stale-While-Revalidate: Return cached data immediately, revalidate in background
        revalidateInBackground<T>(endpoint, options, cacheKey);
        return parsed.data;
      }
    } catch {
      // JSON or storage parse error, fall through to network
    }
  }

  return fetchAndCache<T>(endpoint, options, cacheKey);
}
