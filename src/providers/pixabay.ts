/**
 * Copied from asset-finder-mcp (MIT, Erfangit23) — see THIRD_PARTY.md.
 */
import type { Asset, Provider, ProviderConfig, SearchParams, SearchResult } from "../types.js";
import { LRUCache } from "../utils/cache.js";

/**
 * Pixabay provider — free photos, vectors, and illustrations.
 * Requires API key. Free tier: 100 requests/min.
 * API docs: https://pixabay.com/api/docs/
 */

const API_BASE = "https://pixabay.com/api";
const CACHE = new LRUCache<SearchResult>(200, 15 * 60 * 1000);

interface PixabayHit {
  id: number;
  pageURL: string;
  type: string;
  tags: string;
  previewURL: string;
  previewWidth: number;
  previewHeight: number;
  webformatURL: string;
  webformatWidth: number;
  webformatHeight: number;
  largeImageURL: string;
  fullHDURL: string;
  imageURL: string;
  imageWidth: number;
  imageHeight: number;
  imageSize: number;
  views: number;
  downloads: number;
  favorites: number;
  likes: number;
  comments: number;
  user_id: number;
  user: string;
  userImageURL: string;
}

interface PixabayResponse {
  total: number;
  totalHits: number;
  hits: PixabayHit[];
}

export class PixabayProvider implements Provider {
  name = "pixabay";
  available = false;
  private apiKey: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.pixabayApiKey ?? "";
    this.available = !!this.apiKey;
  }

  async search(params: SearchParams): Promise<SearchResult> {
    if (!this.available) {
      return { assets: [], total: 0, provider: this.name, query: params.query };
    }

    const { query, limit = 20, offset = 0, color } = params;
    const page = Math.floor(offset / limit) + 1;
    const cacheKey = `pixabay:${query}:${limit}:${page}:${color ?? "any"}`;

    const cached = CACHE.get(cacheKey);
    if (cached) return cached;

    const url = new URL(`${API_BASE}/`);
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("q", query);
    url.searchParams.set("per_page", String(Math.min(limit, 200)));
    url.searchParams.set("page", String(page));
    if (color) {
      url.searchParams.set("colors", color.replace("#", ""));
    }
    // Include all image types
    url.searchParams.set("image_type", "all");

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Pixabay API error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as PixabayResponse;

    const assets: Asset[] = data.hits.map((hit) => {
      const type = hit.type === "vector" ? "vector" as const
        : hit.type === "illustration" ? "illustration" as const
        : "stock-photo" as const;

      return {
        id: `pixabay:${hit.id}`,
        type,
        title: hit.tags.split(",").slice(0, 3).join(", "),
        description: hit.tags,
        url: hit.pageURL,
        previewUrl: hit.previewURL,
        downloadUrl: hit.largeImageURL,
        format: "jpg" as const,
        width: hit.imageWidth,
        height: hit.imageHeight,
        author: hit.user,
        source: "Pixabay",
        sourceUrl: "https://pixabay.com",
        license: "free-for-commercial" as const,
        licenseUrl: "https://pixabay.com/service/license/",
        tags: hit.tags.split(",").map((t) => t.trim()),
      };
    });

    const result: SearchResult = {
      assets,
      total: data.totalHits,
      provider: this.name,
      query,
    };

    CACHE.set(cacheKey, result);
    return result;
  }
}
