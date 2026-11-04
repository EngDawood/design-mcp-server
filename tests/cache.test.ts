import { describe, it, expect } from "bun:test";
import { LRUCache } from "../src/utils/cache.js";

describe("LRUCache", () => {
  it("should store and retrieve values", () => {
    const cache = new LRUCache<string>(100);
    cache.set("key1", "value1");
    expect(cache.get("key1")).toBe("value1");
  });

  it("should return null for missing keys", () => {
    const cache = new LRUCache<string>(100);
    expect(cache.get("nonexistent")).toBeNull();
  });

  it("should evict oldest entries when full", () => {
    const cache = new LRUCache<string>(2);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3"); // should evict "a"
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBe("2");
    expect(cache.get("c")).toBe("3");
  });

  it("should expire entries after TTL", () => {
    const cache = new LRUCache<string>(100, 50); // 50ms TTL
    cache.set("key", "value");
    // Wait for expiry
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(cache.get("key")).toBeNull();
        resolve();
      }, 100);
    });
  });

  it("should move accessed entries to most recently used", () => {
    const cache = new LRUCache<string>(2);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.get("a"); // access "a" to make it most recently used
    cache.set("c", "3"); // should evict "b" now
    expect(cache.get("a")).toBe("1");
    expect(cache.get("b")).toBeNull();
    expect(cache.get("c")).toBe("3");
  });
});
