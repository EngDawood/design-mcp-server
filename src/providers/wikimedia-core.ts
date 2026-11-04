/**
 * Wikimedia Commons provider — core.
 *
 * Plain functions over the official MediaWiki API on commons.wikimedia.org
 * (keyless). Ported from the previous design-mcp-server root (the owner's
 * Wikimedia provider module), re-mapped onto the unified `Asset` shape in
 * `src/types.ts` during the asset-finder migration.
 *
 * This module is the deep part of the provider: the whole API contract
 * (generator=search with a filetype:svg filter, imageinfo properties,
 * extmetadata licensing) is hidden behind `searchAssets` / `getAsset`.
 *
 * Fetch is injected (`deps.fetchFn`) so tests exercise this seam without
 * the network; in the Worker it defaults to the global fetch.
 */
import type { Asset, LicenseType } from "../types.js";

export type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string> }
) => Promise<Response>;

export interface CommonsDeps {
  fetchFn?: FetchLike;
}

const API_ENDPOINT = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT =
  "design-mcp-server/0.2 (https://github.com/EngDawood/design-mcp-server)";
const SVG_MIME = "image/svg+xml";

interface CommonsImageInfo {
  url?: string;
  descriptionurl?: string;
  thumburl?: string;
  mime?: string;
  extmetadata?: Record<string, { value?: string } | undefined>;
}

interface CommonsPage {
  pageid?: number;
  title?: string;
  /** Rank within generator=search results. */
  index?: number;
  missing?: boolean | string;
  imageinfo?: CommonsImageInfo[];
}

function apiUrl(params: Record<string, string>): string {
  const url = new URL(API_ENDPOINT);
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function queryApi(
  params: Record<string, string>,
  deps: CommonsDeps
): Promise<CommonsPage[]> {
  const fetchFn = deps.fetchFn ?? (globalThis.fetch as FetchLike);
  const response = await fetchFn(apiUrl(params), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      `Wikimedia Commons API request failed: ${response.status} ${response.statusText}`
    );
  }
  const data = (await response.json()) as {
    query?: { pages?: CommonsPage[] };
  };
  return data.query?.pages ?? [];
}

/** Strip the small HTML snippets Commons embeds in extmetadata values. */
function plainText(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const text = value.replace(/<[^>]*>/g, "").trim();
  return text.length > 0 ? text : undefined;
}

/**
 * Map a Commons license label ("LGPL", "CC BY-SA 4.0", "Public domain", …)
 * onto the unified LicenseType enum. Copyleft/open-source licenses that
 * permit commercial use land on "free-for-commercial"; anything unmapped
 * is "unknown" rather than guessed.
 */
export function mapCommonsLicense(label: string | undefined): LicenseType {
  if (!label) return "unknown";
  const l = label.toLowerCase();
  if (l.includes("cc0") || l.includes("public domain")) return "cc0";
  if (l.includes("cc-by-nc") || l.includes("cc by-nc")) return "cc-by-nc";
  if (l.includes("cc-by-sa") || l.includes("cc by-sa")) return "cc-by-sa";
  if (l.includes("cc-by") || l.includes("cc by")) return "cc-by";
  if (l.includes("mit")) return "mit";
  if (
    l.includes("lgpl") ||
    l.includes("gpl") ||
    l.includes("apache") ||
    l.includes("bsd") ||
    l.includes("fdl") ||
    l.includes("free art")
  ) {
    return "free-for-commercial";
  }
  return "unknown";
}

/** Map one API page to the unified Asset, or null when it is not an SVG file page. */
function pageToAsset(page: CommonsPage): Asset | null {
  if (page.missing !== undefined || !page.title) return null;
  const info = page.imageinfo?.[0];
  if (!info?.url || info.mime !== SVG_MIME) return null;
  const title = page.title.replace(/^File:/, "").replace(/\.svg$/i, "");
  const licenseLabel = plainText(info.extmetadata?.LicenseShortName?.value);
  return {
    id: `wikimedia:${page.title}`,
    type: "icon",
    title,
    url: info.url,
    previewUrl: info.thumburl,
    downloadUrl: info.url,
    format: "svg",
    author: plainText(info.extmetadata?.Artist?.value),
    license: mapCommonsLicense(licenseLabel),
    licenseUrl: plainText(info.extmetadata?.LicenseUrl?.value),
    source: "Wikimedia Commons",
    sourceUrl: info.descriptionurl,
  };
}

const IMAGEINFO_PARAMS: Record<string, string> = {
  action: "query",
  prop: "imageinfo",
  iiprop: "url|mime|extmetadata",
  iiurlwidth: "320",
};

/**
 * Search Commons for SVG files matching `query`.
 * Returns unified Assets in search-rank order; an empty list when nothing
 * matches (an empty result is not an error).
 */
export async function searchAssets(
  query: string,
  opts: { limit?: number; offset?: number } & CommonsDeps = {}
): Promise<Asset[]> {
  const pages = await queryApi(
    {
      ...IMAGEINFO_PARAMS,
      generator: "search",
      gsrsearch: `${query} filetype:svg`,
      gsrnamespace: "6", // File:
      gsrlimit: String(opts.limit ?? 12),
      ...(opts.offset ? { gsroffset: String(opts.offset) } : {}),
    },
    opts
  );
  return [...pages]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map(pageToAsset)
    .filter((a): a is Asset => a !== null);
}

/**
 * Resolve one file to its Asset. `id` is the provider-native id returned
 * by search (a "File:…" title, optionally still carrying the "wikimedia:"
 * prefix the unified shape adds); a bare file name is normalized to a
 * File title. Returns null when the file does not exist.
 */
export async function getAsset(
  id: string,
  deps: CommonsDeps = {}
): Promise<Asset | null> {
  const native = id.startsWith("wikimedia:") ? id.slice("wikimedia:".length) : id;
  const title = native.startsWith("File:") ? native : `File:${native}`;
  const pages = await queryApi({ ...IMAGEINFO_PARAMS, titles: title }, deps);
  const page = pages[0];
  return page ? pageToAsset(page) : null;
}
