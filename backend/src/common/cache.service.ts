import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly store = new Map<string, CacheEntry<any>>();
  private readonly MAX_ENTRIES = 1000;

  /**
   * Retrieve cached value if present and unexpired.
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Store value with specific TTL in seconds.
   */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    // Evict oldest entries if map grows beyond safety threshold
    if (this.store.size >= this.MAX_ENTRIES) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) {
        this.store.delete(oldestKey);
      }
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000,
    });
  }

  /**
   * Fetch from cache or compute and cache if absent/expired.
   */
  async wrap<T>(
    key: string,
    ttlSeconds: number,
    computation: () => Promise<T>,
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const fresh = await computation();
    this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  /**
   * Invalidate all keys matching a given prefix.
   */
  invalidatePrefix(prefix: string): number {
    let deletedCount = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  /**
   * Delete an exact key.
   */
  invalidate(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear entire cache.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Current size of cache store.
   */
  size(): number {
    return this.store.size;
  }
}
