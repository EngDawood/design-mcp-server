/**
 * Unified type definitions — the seam of design-mcp-server.
 *
 * Copied from asset-finder-mcp (MIT, Erfangit23) — see THIRD_PARTY.md —
 * with three migration deltas, marked [design-mcp-server] below:
 *   1. ProviderConfig gains `flaticonApiKey` (our Flaticon provider).
 *   2. Provider gains optional `description` / `note` metadata so
 *      list_providers can describe providers (and flag experimental
 *      ones) without a hardcoded table doing all the work.
 *   3. Provider gains the optional `registerTools` escape hatch, and
 *      ProviderEnv names the Worker-env shape it receives.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type AssetType =
  | "icon"
  | "logo"
  | "stock-photo"
  | "vector"
  | "emoji"
  | "illustration";

export type LicenseType =
  | "mit"
  | "cc0"
  | "cc-by"
  | "cc-by-sa"
  | "cc-by-nc"
  | "free-for-commercial"
  | "personal-only"
  | "unknown";

export type ImageFormat = "svg" | "png" | "jpg" | "webp" | "gif" | "base64";

export type AssetSize = "small" | "medium" | "large";

export interface Asset {
  id: string;
  type: AssetType;
  title: string;
  description?: string;
  url: string;
  previewUrl?: string;
  downloadUrl?: string;
  format: ImageFormat;
  width?: number;
  height?: number;
  author?: string;
  authorUrl?: string;
  license: LicenseType;
  licenseUrl?: string;
  source: string;
  sourceUrl?: string;
  tags?: string[];
  colorPalette?: string[];
}

export interface SearchParams {
  query: string;
  limit?: number;
  offset?: number;
  license?: LicenseType;
  format?: ImageFormat;
  color?: string;
  size?: AssetSize;
}

export interface SearchResult {
  assets: Asset[];
  total: number;
  provider: string;
  query: string;
}

/** [design-mcp-server] Environment as the core sees it: Worker env vars/secrets by name. */
export type ProviderEnv = Record<string, string | undefined>;

export interface Provider {
  name: string;
  available: boolean;
  search(params: SearchParams): Promise<SearchResult>;
  getById?(id: string): Promise<Asset | null>;
  /** [design-mcp-server] One line: what this provider serves. Shown by list_providers. */
  description?: string;
  /**
   * [design-mcp-server] Caveat shown verbatim by list_providers — e.g. the
   * SVG Repo provider is experimental because SVG Repo has no official API.
   */
  note?: string;
  /**
   * [design-mcp-server] Escape hatch for tool-rich providers whose value
   * does not fit search/getById (Storyset's palette extraction and SVG
   * recoloring). A provider implements this ONLY when it has such tools;
   * everyone else stays on the two-method seam above. Called once per
   * server instance, after the cross-provider tools are registered.
   */
  registerTools?(server: McpServer, env: ProviderEnv): void;
}

export interface ProviderConfig {
  pexelsApiKey?: string;
  unsplashApiKey?: string;
  pixabayApiKey?: string;
  logoDevToken?: string;
  /** [design-mcp-server] Flaticon API key (env FLATICON_API_KEY). */
  flaticonApiKey?: string;
}
