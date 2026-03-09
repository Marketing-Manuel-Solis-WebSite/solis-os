// ================================================================
// Reusable in-memory rate limiter (per-key sliding window)
// ================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

// Clean stale entries every 5 minutes per store
setInterval(() => {
  const now = Date.now();
  for (const store of stores.values()) {
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }
}, 300_000);

/**
 * Check rate limit for a given key within a named store.
 * Returns { allowed, remaining, resetAt }.
 */
export function checkRateLimit(
  storeName: string,
  key: string,
  maxRequests: number,
  windowMs = 60_000,
): { allowed: boolean; remaining: number; resetAt: number } {
  if (!stores.has(storeName)) stores.set(storeName, new Map());
  const store = stores.get(storeName)!;

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}
