/**
 * Flaticon provider — icons from Flaticon (Freepik) via the official
 * API v3. The whole API contract (auth token cache, re-auth on 401,
 * download-URL resolution) lives in ./flaticon-core.ts; this class is
 * the thin adapter onto the unified Provider seam.
 *
 * Available only when FLATICON_API_KEY is configured. Attribution: every
 * Asset keeps its author — Flaticon's license requires crediting the
 * named author unless a Premium plan covers the use.
 */
import type { Asset, Provider, ProviderConfig, SearchParams, SearchResult } from "../types.js";
import {
  searchIcons,
  getIcon,
  flaticonLicense,
  FLATICON_LICENSE_URL,
  type FlaticonDeps,
} from "./flaticon-core.js";

export class FlaticonProvider implements Provider {
  name = "flaticon";
  available = false;
  description =
    "Millions of icons from Flaticon (Freepik) via the official API v3 — attribution required";

  private apiKey: string;

  constructor(config: ProviderConfig, private deps: FlaticonDeps = {}) {
    this.apiKey = config.flaticonApiKey ?? "";
    this.available = !!this.apiKey;
  }

  async search(params: SearchParams): Promise<SearchResult> {
    if (!this.available) {
      return { assets: [], total: 0, provider: this.name, query: params.query };
    }
    const limit = params.limit ?? 32;
    // The cross-provider seam pages by offset; Flaticon pages by number.
    const page =
      params.offset !== undefined && limit > 0 ? Math.floor(params.offset / limit) + 1 : undefined;
    const result = await searchIcons(this.apiKey, params.query, { limit, page }, this.deps);
    return {
      assets: result.icons.map((i) => i.asset),
      total: result.total,
      provider: this.name,
      query: params.query,
    };
  }

  async getById(id: string): Promise<Asset | null> {
    if (!this.available) return null;
    const nativeId = id.startsWith("flaticon:") ? id.slice("flaticon:".length) : id;
    const detail = await getIcon(this.apiKey, nativeId, {}, this.deps);
    return {
      id: `flaticon:${detail.id}`,
      type: "icon",
      title: detail.description ?? "",
      url: detail.download.url,
      downloadUrl: detail.download.url,
      format: detail.download.format,
      ...(detail.author ? { author: detail.author } : {}),
      license: flaticonLicense(),
      licenseUrl: FLATICON_LICENSE_URL,
      source: "Flaticon",
      ...(detail.pageUrl ? { sourceUrl: detail.pageUrl } : {}),
    };
  }
}
