/**
 * Copied from asset-finder-mcp (MIT, Erfangit23) — see THIRD_PARTY.md.
 */
import type { Asset, Provider, ProviderConfig, SearchParams, SearchResult } from "../types.js";
import { LRUCache } from "../utils/cache.js";

/**
 * Logo.dev provider — logos for 50,000+ brands and companies.
 * Requires token. Free tier available.
 * API docs: https://logo.dev/
 */

const CDN_BASE = "https://img.logo.dev";
const CACHE = new LRUCache<SearchResult>(200, 60 * 60 * 1000); // 1 hour

export class LogoDevProvider implements Provider {
  name = "logo-dev";
  available = false;
  private token: string;

  constructor(config: ProviderConfig) {
    this.token = config.logoDevToken ?? "";
    this.available = !!this.token;
  }

  private buildCdnUrl(domain: string, size: number): string {
    return `${CDN_BASE}/${domain}?token=${encodeURIComponent(this.token)}&size=${size}`;
  }

  async search(params: SearchParams): Promise<SearchResult> {
    if (!this.available) {
      return { assets: [], total: 0, provider: this.name, query: params.query };
    }

    const { query, limit = 10 } = params;
    const cacheKey = `logo-dev:${query}:${limit}`;

    const cached = CACHE.get(cacheKey);
    if (cached) return cached;

    // Logo.dev doesn't have a public search API — try common domain patterns
    const cleanName = query.toLowerCase().replace(/[^a-z0-9]/g, "");
    const domains = [
      `${cleanName}.com`,
      `${cleanName}.io`,
      `${cleanName}.org`,
      `${cleanName}.net`,
      `${cleanName}.co`,
      `get${cleanName}.com`,
      `www.${cleanName}.com`,
    ].slice(0, limit);

    // Verify which domains actually have logos by checking the CDN
    const assets: Asset[] = [];

    for (const domain of domains) {
      const logoUrl = this.buildCdnUrl(domain, 256);
      try {
        const checkRes = await fetch(logoUrl, { method: "HEAD" });
        if (checkRes.ok && checkRes.headers.get("content-type")?.startsWith("image/")) {
          assets.push({
            id: `logo-dev:${domain}`,
            type: "logo" as const,
            title: query,
            description: `${query} brand logo (${domain})`,
            url: `https://${domain}`,
            previewUrl: this.buildCdnUrl(domain, 128),
            downloadUrl: this.buildCdnUrl(domain, 512),
            format: "png" as const,
            source: "Logo.dev",
            sourceUrl: "https://logo.dev",
            license: "free-for-commercial" as const,
            licenseUrl: "https://logo.dev/terms",
            tags: [domain],
          });

          if (assets.length >= limit) break;
        }
      } catch {
        // Skip failed domains
      }
    }

    const result: SearchResult = {
      assets,
      total: assets.length,
      provider: this.name,
      query,
    };

    CACHE.set(cacheKey, result);
    return result;
  }
}
