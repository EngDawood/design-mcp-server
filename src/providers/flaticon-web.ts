/**
 * Flaticon-web provider — icons from Flaticon (Freepik) through the
 * public website, WITHOUT the official API and without an API key.
 * The whole unofficial web contract (search-page parsing, CDN URL
 * pattern, block detection) lives in ./flaticon-web-core.ts; this
 * class is the thin adapter onto the unified Provider seam.
 *
 * EXPERIMENTAL by design: flaticon.com's bot filter blocks many
 * networks outright (this project's own sandbox included, verified
 * 2026-11-04), and the page markup is undocumented. Search failures
 * throw and are isolated per provider by the cross-provider tools;
 * getById rides the public CDN, which answers normally. When a
 * FLATICON_API_KEY is available, prefer the `flaticon` provider.
 *
 * Attribution: every Asset carries the Flaticon license + license URL,
 * and the author whenever the page markup names one — Flaticon's
 * license requires crediting the author named on the icon's page.
 */
import type { Asset, Provider, SearchParams, SearchResult } from "../types.js";
import {
  searchIcons,
  getIcon,
  largestImageUrl,
  FLATICON_LICENSE_URL,
  type FlaticonWebDeps,
} from "./flaticon-web-core.js";
import { flaticonLicense } from "./flaticon-core.js";

export class FlaticonWebProvider implements Provider {
  name = "flaticon-web";
  available = true;
  description =
    "Millions of icons from Flaticon via its public web pages — EXPERIMENTAL keyless access, no API key";
  note =
    "Experimental: unofficial web access, no API key — parses flaticon.com's public search pages and builds image URLs from its public CDN pattern (PNG only; SVG stays behind Flaticon's gated download flow). The site's bot filter blocks many networks outright and the undocumented markup can change or break at any time. Attribution to each icon's author is required under the Flaticon License; prefer the flaticon provider (official API) when a key is available.";

  constructor(private deps: FlaticonWebDeps = {}) {}

  async search(params: SearchParams): Promise<SearchResult> {
    const limit = params.limit ?? 32;
    // The cross-provider seam pages by offset; the web search pages by number.
    const page =
      params.offset !== undefined && limit > 0 ? Math.floor(params.offset / limit) + 1 : undefined;
    const result = await searchIcons(params.query, { limit, page, ...this.deps });
    return {
      assets: result.icons.map((icon) => {
        const largest = largestImageUrl(icon.images);
        const asset: Asset = {
          id: `flaticon-web:${icon.id}`,
          type: "icon",
          title: icon.title,
          url: largest ?? "",
          previewUrl: icon.images["256"] ?? largest,
          downloadUrl: largest,
          format: "png",
          ...(icon.author ? { author: icon.author } : {}),
          license: flaticonLicense(),
          licenseUrl: FLATICON_LICENSE_URL,
          source: "Flaticon",
          sourceUrl: icon.pageUrl,
        };
        return asset;
      }),
      total: result.total,
      provider: this.name,
      query: params.query,
    };
  }

  async getById(id: string): Promise<Asset | null> {
    const nativeId = id.startsWith("flaticon-web:") ? id.slice("flaticon-web:".length) : id;
    const detail = await getIcon(nativeId, this.deps);
    if (!detail) return null;
    return {
      id: `flaticon-web:${detail.id}`,
      type: "icon",
      // The CDN pattern resolves the file, not the metadata: the title
      // and author live on the icon's page, which the bot filter may
      // refuse. They stay absent rather than invented.
      title: "",
      url: detail.imageUrl,
      previewUrl: detail.previewUrl,
      downloadUrl: detail.imageUrl,
      format: "png",
      license: flaticonLicense(),
      licenseUrl: FLATICON_LICENSE_URL,
      source: "Flaticon",
    };
  }
}
