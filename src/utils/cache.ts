/**
 * Copied from asset-finder-mcp (MIT, Erfangit23) — see THIRD_PARTY.md.
 */
/**
 * Simple in-memory LRU cache for API responses.
 * Icons and logos don't change often, so caching is very effective.
 */

interface CacheEntry<T> {
  value: T;
  expires: number;
}

export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private defaultTtl: number;

  constructor(maxSize = 500, defaultTtlMs = 10 * 60 * 1000) {
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtlMs;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      value,
      expires: Date.now() + (ttlMs ?? this.defaultTtl),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
