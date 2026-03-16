// ================================================================
// Simple in-memory TTL cache for server-side use
// ================================================================
// Used to cache frequently-read, rarely-changed data like members
// and teams. Each entry has an independent TTL.
// ================================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TTLCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private defaultTTL: number;

  /** @param defaultTTL Default TTL in milliseconds */
  constructor(defaultTTL: number) {
    this.defaultTTL = defaultTTL;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttl ?? this.defaultTTL),
    });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidateAll(): void {
    this.store.clear();
  }
}
