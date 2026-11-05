/**
 * Copied from asset-finder-mcp (MIT, Erfangit23) — see THIRD_PARTY.md.
 */
import type { Asset, Provider, SearchParams, SearchResult } from "../types.js";
import { LRUCache } from "../utils/cache.js";

/**
 * SVG Repo provider — 500,000+ open-licensed SVGs.
 * Free, no API key required.
 * API docs: https://www.svgrepo.com/api/
 */

const API_BASE = "https://www.svgrepo.com";
const CACHE = new LRUCache<SearchResult>(200, 30 * 60 * 1000);

interface SVGRepoItem {
  id: number;
  title: string;
  url: string;
  license: string;
  license_url?: string;
  uploader?: string;
  uploaded_at?: string;
}

interface SVGRepoResponse {
  data: SVGRepoItem[];
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
}

function mapLicense(license: string): import("../types.js").LicenseType {
  const l = license.toLowerCase();
  if (l.includes("cc0")) return "cc0";
  if (l.includes("cc-by-nc")) return "cc-by-nc";
  if (l.includes("cc-by-sa")) return "cc-by-sa";
  if (l.includes("cc-by")) return "cc-by";
  if (l.includes("public domain")) return "cc0";
  if (l.includes("free for commercial")) return "free-for-commercial";
  return "unknown";
}

export class SVGRepoProvider implements Provider {
  name = "svgrepo";
  available = true;
  description = "500,000+ open-licensed SVG vectors and illustrations (SVG Repo)";
  /**
   * [design-mcp-server] Our own research (2026-11-04) found SVG Repo has
   * NO official public API: no developer docs, the site sits behind a
   * Vercel checkpoint, and the /api/v1/search endpoint this provider
   * calls is undocumented. Kept from upstream asset-finder-mcp, but
   * flagged experimental — do not rely on it as a stable source.
   */
  note =
    "Experimental: SVG Repo exposes no official API — this provider uses its undocumented /api/v1/search endpoint, which may break or be blocked without notice. Wikimedia Commons is the stable keyless SVG source on this server.";

  async search(params: SearchParams): Promise<SearchResult> {
    const { query, limit = 20, offset = 0 } = params;
    const page = Math.floor(offset / limit) + 1;
    const cacheKey = `svgrepo:${query}:${limit}:${page}`;

    const cached = CACHE.get(cacheKey);
    if (cached) return cached;

    const url = new URL(`${API_BASE}/api/v1/search`);
    url.searchParams.set("search", query);
    url.searchParams.set("per_page", String(limit));
    url.searchParams.set("page", String(page));

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`SVG Repo API error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as SVGRepoResponse;

    const assets: Asset[] = data.data.map((item) => ({
      id: `svgrepo:${item.id}`,
      type: "vector" as const,
      title: item.title,
      url: item.url,
      previewUrl: `${API_BASE}/download/${item.id}.svg`,
      downloadUrl: `${API_BASE}/download/${item.id}.svg`,
      format: "svg" as const,
      author: item.uploader,
      source: "SVG Repo",
      sourceUrl: "https://www.svgrepo.com",
      license: mapLicense(item.license),
      licenseUrl: item.license_url,
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
