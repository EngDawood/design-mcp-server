/**
 * Wikimedia Commons provider — open-licensed SVG files via the official
 * MediaWiki API (keyless). The API contract lives in ./wikimedia-core.ts;
 * this class is the thin adapter onto the unified Provider seam.
 */
import type { Provider, SearchParams, SearchResult } from "../types.js";
import { searchAssets, getAsset, type CommonsDeps } from "./wikimedia-core.js";

export class WikimediaProvider implements Provider {
  name = "wikimedia";
  available = true;
  description =
    "Open-licensed SVG icons and illustrations from Wikimedia Commons (official MediaWiki API, keyless)";

  constructor(private deps: CommonsDeps = {}) {}

  async search(params: SearchParams): Promise<SearchResult> {
    const assets = await searchAssets(params.query, {
      limit: params.limit ?? 12,
      offset: params.offset ?? 0,
      ...this.deps,
    });
    return { assets, total: assets.length, provider: this.name, query: params.query };
  }

  async getById(id: string) {
    return getAsset(id, this.deps);
  }
}
