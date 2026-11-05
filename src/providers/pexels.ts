/**
 * Copied from asset-finder-mcp (MIT, Erfangit23) — see THIRD_PARTY.md.
 */
import type { Asset, Provider, ProviderConfig, SearchParams, SearchResult } from "../types.js";
import { LRUCache } from "../utils/cache.js";

/**
 * Pexels provider — free stock photos and videos.
 * Requires API key. Free tier: 200 requests/hour, 20,000/month.
 * API docs: https://www.pexels.com/api/
 */

const API_BASE = "https://api.pexels.com/v1";
const CACHE = new LRUCache<SearchResult>(200, 15 * 60 * 1000); // 15 min

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  src: {
    original: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
  alt: string;
}

interface PexelsResponse {
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
  total_results: number;
}

export class PexelsProvider implements Provider {
  name = "pexels";
  available = false;
  private apiKey: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.pexelsApiKey ?? "";
    this.available = !!this.apiKey;
  }

  async search(params: SearchParams): Promise<SearchResult> {
    if (!this.available) {
      return { assets: [], total: 0, provider: this.name, query: params.query };
    }

    const { query, limit = 20, offset = 0, color } = params;
    const page = Math.floor(offset / limit) + 1;
    const cacheKey = `pexels:${query}:${limit}:${page}:${color ?? "any"}`;

    const cached = CACHE.get(cacheKey);
    if (cached) return cached;

    const url = new URL(`${API_BASE}/search`);
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", String(limit));
    url.searchParams.set("page", String(page));
    if (color) {
      url.searchParams.set("color", color.replace("#", ""));
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: this.apiKey },
    });

    if (!res.ok) {
      throw new Error(`Pexels API error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as PexelsResponse;

    const assets: Asset[] = data.photos.map((photo) => ({
      id: `pexels:${photo.id}`,
      type: "stock-photo" as const,
      title: photo.alt || `Photo by ${photo.photographer}`,
      description: photo.alt,
      url: photo.url,
      previewUrl: photo.src.medium,
      downloadUrl: photo.src.large,
      format: "jpg" as const,
      width: photo.width,
      height: photo.height,
      author: photo.photographer,
      authorUrl: photo.photographer_url,
      source: "Pexels",
      sourceUrl: "https://www.pexels.com",
      license: "free-for-commercial" as const,
      licenseUrl: "https://www.pexels.com/license/",
    }));

    const result: SearchResult = {
      assets,
      total: data.total_results,
      provider: this.name,
      query,
    };

    CACHE.set(cacheKey, result);
    return result;
  }
}
