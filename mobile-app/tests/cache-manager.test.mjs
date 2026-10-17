import test from 'node:test';
import assert from 'node:assert/strict';

// Constants matching src/lib/cache-manager.ts
const CACHE_PREFIX = 'dhra_mobile_cache:';
const CACHE_CLEANUP_INTERVAL_DAYS = 7;
const CACHE_CLEANUP_INTERVAL_MS = CACHE_CLEANUP_INTERVAL_DAYS * 24 * 60 * 60 * 1000; // 604,800,000 ms
const LAST_CACHE_CLEANUP_KEY = 'dhra_cache_last_auto_cleaned_at';

// Formatter function matching src/lib/cache-manager.ts
function formatCleanupTime(timestamp, mockNow = Date.now()) {
  if (!timestamp) return 'Never';
  const diffMs = mockNow - timestamp;
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

// In-Memory Storage Mock to test full cache manager lifecycle
class MockAsyncStorage {
  constructor() {
    this.store = new Map();
  }

  async getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async setItem(key, value) {
    this.store.set(key, String(value));
  }

  async removeItem(key) {
    this.store.delete(key);
  }

  async getAllKeys() {
    return Array.from(this.store.keys());
  }

  async multiGet(keys) {
    return keys.map((k) => [k, this.store.has(k) ? this.store.get(k) : null]);
  }

  async multiRemove(keys) {
    for (const k of keys) {
      this.store.delete(k);
    }
  }

  clear() {
    this.store.clear();
  }
}

// Pure implementation of cache evaluator logic
async function evaluateAutoCleanup(storage, currentTime) {
  const rawLast = await storage.getItem(LAST_CACHE_CLEANUP_KEY);

  if (!rawLast) {
    await storage.setItem(LAST_CACHE_CLEANUP_KEY, String(currentTime));
    return {
      triggered: false,
      reason: 'INITIALIZED',
      lastCleanedAt: currentTime,
    };
  }

  const lastTime = parseInt(rawLast, 10);
  if (isNaN(lastTime)) {
    await storage.setItem(LAST_CACHE_CLEANUP_KEY, String(currentTime));
    return {
      triggered: false,
      reason: 'INITIALIZED',
      lastCleanedAt: currentTime,
    };
  }

  const elapsed = currentTime - lastTime;
  if (elapsed >= CACHE_CLEANUP_INTERVAL_MS) {
    // Purge only dhra_mobile_cache:* keys
    const allKeys = await storage.getAllKeys();
    const toRemove = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));
    await storage.multiRemove(toRemove);
    await storage.setItem(LAST_CACHE_CLEANUP_KEY, String(currentTime));

    return {
      triggered: true,
      reason: 'ELAPSED_7_DAYS',
      clearedKeysCount: toRemove.length,
      lastCleanedAt: currentTime,
    };
  }

  return {
    triggered: false,
    reason: 'WITHIN_INTERVAL',
    lastCleanedAt: lastTime,
  };
}

// Pure implementation of cache stats computation
async function computeCacheStats(storage, currentTime) {
  const allKeys = await storage.getAllKeys();
  const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));
  let approxBytes = 0;

  const pairs = await storage.multiGet(cacheKeys);
  for (const [, val] of pairs) {
    if (val) approxBytes += val.length;
  }

  const rawLast = await storage.getItem(LAST_CACHE_CLEANUP_KEY);
  let lastCleanedAt = null;
  if (rawLast) {
    const parsed = parseInt(rawLast, 10);
    if (!isNaN(parsed)) lastCleanedAt = parsed;
  }

  const approxKb = Math.round((approxBytes / 1024) * 10) / 10;
  const lastCleanedText = formatCleanupTime(lastCleanedAt, currentTime);

  let nextCleanupDueDays = CACHE_CLEANUP_INTERVAL_DAYS;
  if (lastCleanedAt) {
    const elapsedMs = currentTime - lastCleanedAt;
    const remainingMs = Math.max(0, CACHE_CLEANUP_INTERVAL_MS - elapsedMs);
    nextCleanupDueDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
  }

  return {
    keysCount: cacheKeys.length,
    approxKb,
    lastCleanedAt,
    lastCleanedText,
    nextCleanupDueDays,
  };
}

test('1. Interval constant accuracy: exactly 7 days in milliseconds', () => {
  assert.equal(CACHE_CLEANUP_INTERVAL_DAYS, 7);
  assert.equal(CACHE_CLEANUP_INTERVAL_MS, 7 * 24 * 60 * 60 * 1000);
  assert.equal(CACHE_CLEANUP_INTERVAL_MS, 604800000);
});

test('2. First run / Fresh installation: initializes timestamp without deleting cache', async () => {
  const storage = new MockAsyncStorage();
  const startTime = 1700000000000;

  // Add dummy cache data
  await storage.setItem(`${CACHE_PREFIX}user1:/invoices`, '{"data":[{"id":"inv-1"}]}');
  await storage.setItem('authToken', 'secret-jwt-token');
  await storage.setItem('authUser', '{"id":"usr-1","role":"OWNER"}');

  const result = await evaluateAutoCleanup(storage, startTime);

  assert.equal(result.triggered, false);
  assert.equal(result.reason, 'INITIALIZED');
  assert.equal(result.lastCleanedAt, startTime);

  // Cache entries and auth must be intact
  assert.equal(await storage.getItem(`${CACHE_PREFIX}user1:/invoices`), '{"data":[{"id":"inv-1"}]}');
  assert.equal(await storage.getItem('authToken'), 'secret-jwt-token');
  assert.equal(await storage.getItem('authUser'), '{"id":"usr-1","role":"OWNER"}');
  assert.equal(await storage.getItem(LAST_CACHE_CLEANUP_KEY), String(startTime));
});

test('3. Within 7-day interval: does NOT trigger purge (< 7 days)', async () => {
  const storage = new MockAsyncStorage();
  const startTime = 1700000000000;

  await storage.setItem(LAST_CACHE_CLEANUP_KEY, String(startTime));
  await storage.setItem(`${CACHE_PREFIX}user1:/stock`, '{"data":["stk-1"]}');

  // Test 1 day later
  const day1 = startTime + 1 * 24 * 60 * 60 * 1000;
  const resDay1 = await evaluateAutoCleanup(storage, day1);
  assert.equal(resDay1.triggered, false);
  assert.equal(resDay1.reason, 'WITHIN_INTERVAL');
  assert.ok(await storage.getItem(`${CACHE_PREFIX}user1:/stock`));

  // Test 6 days, 23 hours later (1 hour before 7-day threshold)
  const almost7Days = startTime + (7 * 24 - 1) * 60 * 60 * 1000;
  const resAlmost = await evaluateAutoCleanup(storage, almost7Days);
  assert.equal(resAlmost.triggered, false);
  assert.equal(resAlmost.reason, 'WITHIN_INTERVAL');
  assert.ok(await storage.getItem(`${CACHE_PREFIX}user1:/stock`));
});

test('4. Threshold reached: triggers auto-purge when elapsed >= 7 days', async () => {
  const storage = new MockAsyncStorage();
  const startTime = 1700000000000;

  await storage.setItem(LAST_CACHE_CLEANUP_KEY, String(startTime));
  await storage.setItem(`${CACHE_PREFIX}user1:/invoices`, '{"invoices":[]}');
  await storage.setItem(`${CACHE_PREFIX}user1:/parties`, '{"parties":[]}');
  await storage.setItem('authToken', 'my-auth-token');
  await storage.setItem('authUser', '{"id":"usr-1"}');

  // Exactly 7 days later
  const exact7Days = startTime + CACHE_CLEANUP_INTERVAL_MS;
  const res = await evaluateAutoCleanup(storage, exact7Days);

  assert.equal(res.triggered, true);
  assert.equal(res.reason, 'ELAPSED_7_DAYS');
  assert.equal(res.clearedKeysCount, 2);
  assert.equal(res.lastCleanedAt, exact7Days);

  // Cache entries removed
  assert.equal(await storage.getItem(`${CACHE_PREFIX}user1:/invoices`), null);
  assert.equal(await storage.getItem(`${CACHE_PREFIX}user1:/parties`), null);

  // Authentication session strictly preserved!
  assert.equal(await storage.getItem('authToken'), 'my-auth-token');
  assert.equal(await storage.getItem('authUser'), '{"id":"usr-1"}');

  // Timestamp updated
  assert.equal(await storage.getItem(LAST_CACHE_CLEANUP_KEY), String(exact7Days));
});

test('5. Beyond 7 days (e.g. 14 days or device unopened for a month)', async () => {
  const storage = new MockAsyncStorage();
  const startTime = 1700000000000;

  await storage.setItem(LAST_CACHE_CLEANUP_KEY, String(startTime));
  await storage.setItem(`${CACHE_PREFIX}user1:/deliveries`, '{"data":["del-1"]}');

  // 14 days later
  const day14 = startTime + 14 * 24 * 60 * 60 * 1000;
  const res = await evaluateAutoCleanup(storage, day14);

  assert.equal(res.triggered, true);
  assert.equal(res.clearedKeysCount, 1);
  assert.equal(await storage.getItem(`${CACHE_PREFIX}user1:/deliveries`), null);
  assert.equal(await storage.getItem(LAST_CACHE_CLEANUP_KEY), String(day14));
});

test('6. Session Safety: Non-cache keys are NEVER purged', async () => {
  const storage = new MockAsyncStorage();
  const startTime = 1700000000000;

  await storage.setItem(LAST_CACHE_CLEANUP_KEY, String(startTime));
  await storage.setItem(`${CACHE_PREFIX}u1:/cache1`, 'data');
  await storage.setItem('authToken', 'jwt_session_token_xyz');
  await storage.setItem('authUser', '{"name":"Admin User"}');
  await storage.setItem('devicePushToken', 'ExponentPushToken[12345]');
  await storage.setItem('userThemePreference', 'dark');

  const after7Days = startTime + CACHE_CLEANUP_INTERVAL_MS + 5000;
  await evaluateAutoCleanup(storage, after7Days);

  // Only the cache entry was purged
  assert.equal(await storage.getItem(`${CACHE_PREFIX}u1:/cache1`), null);
  assert.equal(await storage.getItem('authToken'), 'jwt_session_token_xyz');
  assert.equal(await storage.getItem('authUser'), '{"name":"Admin User"}');
  assert.equal(await storage.getItem('devicePushToken'), 'ExponentPushToken[12345]');
  assert.equal(await storage.getItem('userThemePreference'), 'dark');
});

test('7. Cache statistics and next scheduled days calculation', async () => {
  const storage = new MockAsyncStorage();
  const now = 1700000000000;

  // No cache initially
  const statsEmpty = await computeCacheStats(storage, now);
  assert.equal(statsEmpty.keysCount, 0);
  assert.equal(statsEmpty.approxKb, 0);
  assert.equal(statsEmpty.lastCleanedText, 'Never');
  assert.equal(statsEmpty.nextCleanupDueDays, 7);

  // Add 2 cache records
  const samplePayload1 = 'A'.repeat(1024); // 1 KB
  const samplePayload2 = 'B'.repeat(2048); // 2 KB
  await storage.setItem(`${CACHE_PREFIX}u1:/stock`, samplePayload1);
  await storage.setItem(`${CACHE_PREFIX}u1:/invoices`, samplePayload2);

  // Set last cleaned to 2 days ago
  const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;
  await storage.setItem(LAST_CACHE_CLEANUP_KEY, String(twoDaysAgo));

  const statsActive = await computeCacheStats(storage, now);
  assert.equal(statsActive.keysCount, 2);
  assert.equal(statsActive.approxKb, 3); // ~3 KB
  assert.equal(statsActive.lastCleanedText, '2d ago');
  assert.equal(statsActive.nextCleanupDueDays, 5); // 7 - 2 = 5 days left
});

test('8. Formatter formatting precision for human readability', () => {
  const now = 1700000000000;
  assert.equal(formatCleanupTime(null, now), 'Never');
  assert.equal(formatCleanupTime(now - 30 * 1000, now), 'Just now');
  assert.equal(formatCleanupTime(now - 15 * 60 * 1000, now), '15m ago');
  assert.equal(formatCleanupTime(now - 4 * 60 * 60 * 1000, now), '4h ago');
  assert.equal(formatCleanupTime(now - 24 * 60 * 60 * 1000, now), 'Yesterday');
  assert.equal(formatCleanupTime(now - 3 * 24 * 60 * 60 * 1000, now), '3d ago');
  assert.equal(formatCleanupTime(now - 6 * 24 * 60 * 60 * 1000, now), '6d ago');
});
