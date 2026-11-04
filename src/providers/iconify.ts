/**
 * Copied from asset-finder-mcp (MIT, Erfangit23) — see THIRD_PARTY.md.
 */
import type { Asset, Provider, SearchParams, SearchResult } from "../types.js";
import { LRUCache } from "../utils/cache.js";

/**
 * Iconify provider — 200,000+ icons across 150+ icon sets.
 * Free, no API key required.
 * API docs: https://iconify.design/docs/api/
 */

const API_BASE = "https://api.iconify.design";
const CACHE = new LRUCache<SearchResult>(300, 30 * 60 * 1000); // 30 min cache

interface IconifyCollection {
  prefix: string;
  name: string;
  total: number;
  license?: { title: string; spdx?: string; url?: string };
}

interface IconifySearchResponse {
  icons: string[];
  limit: number;
  start: number;
  total: number;
  collections?: Record<string, IconifyCollection>;
}

function mapLicense(license?: { title: string; spdx?: string; url?: string }): {
  license: import("../types.js").LicenseType;
  licenseUrl?: string;
} {
  if (!license) return { license: "unknown" };
  const spdx = license.spdx?.toLowerCase() ?? "";
  if (spdx.includes("mit")) return { license: "mit", licenseUrl: license.url };
  if (spdx.includes("cc0")) return { license: "cc0", licenseUrl: license.url };
  if (spdx.includes("cc-by-nc")) return { license: "cc-by-nc", licenseUrl: license.url };
  if (spdx.includes("cc-by-sa")) return { license: "cc-by-sa", licenseUrl: license.url };
  if (spdx.includes("cc-by")) return { license: "cc-by", licenseUrl: license.url };
  if (license.title.toLowerCase().includes("open source")) return { license: "free-for-commercial", licenseUrl: license.url };
  return { license: "unknown", licenseUrl: license.url };
}

export class IconifyProvider implements Provider {
  name = "iconify";
  available = true;

  async search(params: SearchParams): Promise<SearchResult> {
    const { query, limit = 20, offset = 0 } = params;
    const cacheKey = `iconify:${query}:${limit}:${offset}`;

    const cached = CACHE.get(cacheKey);
    if (cached) return cached;

    const url = new URL(`${API_BASE}/search`);
    url.searchParams.set("query", query);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("start", String(offset));
    url.searchParams.set("includeCollections", "true");

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Iconify API error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as IconifySearchResponse;
    const collections = data.collections ?? {};

    const assets: Asset[] = data.icons.map((iconName) => {
      const prefix = iconName.split(":")[0] ?? "";
      const collection = collections[prefix];
      const { license, licenseUrl } = mapLicense(collection?.license);

      return {
        id: `iconify:${iconName}`,
        type: "icon" as const,
        title: iconName,
        description: collection ? `${collection.name} icon set` : undefined,
        url: `${API_BASE}/${iconName}.svg`,
        previewUrl: `${API_BASE}/${iconName}.svg?color=%236667eb`,
        downloadUrl: `${API_BASE}/${iconName}.svg`,
        format: "svg" as const,
        source: "Iconify",
        sourceUrl: collection ? `https://icon-sets.iconify.design/${prefix}/` : "https://iconify.design",
        license,
        licenseUrl,
        tags: [prefix ?? ""],
      };
    });

    const result: SearchResult = {
      assets,
      total: data.total,
      provider: this.name,
      query,
    };

    CACHE.set(cacheKey, result);
    return result;
  }

  async getById(id: string): Promise<Asset | null> {
    if (!id.startsWith("iconify:")) return null;
    const iconName = id.replace("iconify:", "");
    return {
      id,
      type: "icon",
      title: iconName,
      url: `${API_BASE}/${iconName}.svg`,
      previewUrl: `${API_BASE}/${iconName}.svg?color=%236667eb`,
      downloadUrl: `${API_BASE}/${iconName}.svg`,
      format: "svg",
      source: "Iconify",
      sourceUrl: "https://iconify.design",
      license: "unknown",
    };
  }
}
