/**
 * Copied from asset-finder-mcp (MIT, Erfangit23) — see THIRD_PARTY.md.
 */
import type { Asset, Provider, SearchParams, SearchResult } from "../types.js";
import { LRUCache } from "../utils/cache.js";

/**
 * OpenMoji provider — open-source emoji set.
 * Free, CC BY-SA 4.0 license, no API key required.
 * https://openmoji.org/
 */

const API_BASE = "https://openmoji.org/api/v1";
const CDN_BASE = "https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@latest";
const CACHE = new LRUCache<SearchResult>(100, 60 * 60 * 1000); // 1 hour

interface OpenMojiItem {
  emoji: string;
  hexcode: string;
  annotation: string;
  tags?: string;
  group: string;
  subgroups: string;
  openmoji_tags?: string;
}

export class OpenMojiProvider implements Provider {
  name = "openmoji";
  available = true;

  async search(params: SearchParams): Promise<SearchResult> {
    const { query, limit = 20, offset = 0 } = params;
    const cacheKey = `openmoji:${query}:${limit}:${offset}`;

    const cached = CACHE.get(cacheKey);
    if (cached) return cached;

    // Search via the annotation/tags
    const url = new URL(`${API_BASE}/search`);
    url.searchParams.set("annotation", query);
    url.searchParams.set("limit", String(limit + offset));

    const res = await fetch(url.toString());
    if (!res.ok) {
      // Fallback: load all and filter
      return this.fallbackSearch(params);
    }

    const data = (await res.json()) as OpenMojiItem[];
    const sliced = data.slice(offset, offset + limit);

    const assets: Asset[] = sliced.map((item) => ({
      id: `openmoji:${item.hexcode}`,
      type: "emoji" as const,
      title: item.annotation,
      description: item.tags,
      url: `${CDN_BASE}/svg/${item.hexcode}.svg`,
      previewUrl: `${CDN_BASE}/color/svg/${item.hexcode}.svg`,
      downloadUrl: `${CDN_BASE}/color/svg/${item.hexcode}.svg`,
      format: "svg" as const,
      source: "OpenMoji",
      sourceUrl: "https://openmoji.org",
      license: "cc-by-sa" as const,
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      tags: item.tags ? item.tags.split(",") : [],
    }));

    const result: SearchResult = {
      assets,
      total: data.length,
      provider: this.name,
      query,
    };

    CACHE.set(cacheKey, result);
    return result;
  }

  private async fallbackSearch(params: SearchParams): Promise<SearchResult> {
    const { query, limit = 20, offset = 0 } = params;

    const url = new URL(`${API_BASE}/all`);
    const res = await fetch(url.toString());
    if (!res.ok) {
      return { assets: [], total: 0, provider: this.name, query };
    }

    const all = (await res.json()) as OpenMojiItem[];
    const lowerQuery = query.toLowerCase();
    const filtered = all.filter(
      (item) =>
        item.annotation.toLowerCase().includes(lowerQuery) ||
        (item.tags && item.tags.toLowerCase().includes(lowerQuery)) ||
        item.group.toLowerCase().includes(lowerQuery)
    );
    const sliced = filtered.slice(offset, offset + limit);

    const assets: Asset[] = sliced.map((item) => ({
      id: `openmoji:${item.hexcode}`,
      type: "emoji" as const,
      title: item.annotation,
      description: item.tags,
      url: `${CDN_BASE}/svg/${item.hexcode}.svg`,
      previewUrl: `${CDN_BASE}/color/svg/${item.hexcode}.svg`,
      downloadUrl: `${CDN_BASE}/color/svg/${item.hexcode}.svg`,
      format: "svg" as const,
      source: "OpenMoji",
      sourceUrl: "https://openmoji.org",
      license: "cc-by-sa" as const,
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      tags: item.tags ? item.tags.split(",") : [],
    }));

    return { assets, total: filtered.length, provider: this.name, query };
  }
}
