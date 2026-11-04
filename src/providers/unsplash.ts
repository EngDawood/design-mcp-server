/**
 * Copied from asset-finder-mcp (MIT, Erfangit23) — see THIRD_PARTY.md.
 */
import type { Asset, Provider, ProviderConfig, SearchParams, SearchResult } from "../types.js";
import { LRUCache } from "../utils/cache.js";

/**
 * Unsplash provider — free stock photos.
 * Requires API key (Access Key). Free tier: 50 requests/hour.
 * API docs: https://unsplash.com/developers
 */

const API_BASE = "https://api.unsplash.com";
const CACHE = new LRUCache<SearchResult>(150, 15 * 60 * 1000);

interface UnsplashPhoto {
  id: string;
  width: number;
  height: number;
  description: string | null;
  alt_description: string | null;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  user: {
    name: string;
    links: { html: string };
  };
  links: {
    html: string;
    download: string;
  };
  color: string | null;
  tags?: { title: string }[];
}

interface UnsplashResponse {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
}

export class UnsplashProvider implements Provider {
  name = "unsplash";
  available = false;
  private apiKey: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.unsplashApiKey ?? "";
    this.available = !!this.apiKey;
  }

  async search(params: SearchParams): Promise<SearchResult> {
    if (!this.available) {
      return { assets: [], total: 0, provider: this.name, query: params.query };
    }

    const { query, limit = 20, offset = 0, color } = params;
    const page = Math.floor(offset / limit) + 1;
    const cacheKey = `unsplash:${query}:${limit}:${page}:${color ?? "any"}`;

    const cached = CACHE.get(cacheKey);
    if (cached) return cached;

    const url = new URL(`${API_BASE}/search/photos`);
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", String(Math.min(limit, 30)));
    url.searchParams.set("page", String(page));
    if (color) {
      url.searchParams.set("color", color.replace("#", ""));
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Client-ID ${this.apiKey}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Unsplash API error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as UnsplashResponse;

    const assets: Asset[] = data.results.map((photo) => ({
      id: `unsplash:${photo.id}`,
      type: "stock-photo" as const,
      title: photo.alt_description || photo.description || `Photo by ${photo.user.name}`,
      description: photo.alt_description ?? photo.description ?? undefined,
      url: photo.links.html,
      previewUrl: photo.urls.small,
      downloadUrl: photo.urls.full,
      format: "jpg" as const,
      width: photo.width,
      height: photo.height,
      author: photo.user.name,
      authorUrl: photo.user.links.html,
      source: "Unsplash",
      sourceUrl: "https://unsplash.com",
      license: "free-for-commercial" as const,
      licenseUrl: "https://unsplash.com/license",
      tags: photo.tags?.map((t) => t.title),
      colorPalette: photo.color ? [photo.color] : undefined,
    }));

    const result: SearchResult = {
      assets,
      total: data.total,
      provider: this.name,
      query,
    };

    CACHE.set(cacheKey, result);
    return result;
  }
}
