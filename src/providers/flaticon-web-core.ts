/**
 * Flaticon-web provider core: Flaticon's UNOFFICIAL web contract behind
 * plain functions. No API key, no official API — this parses the public
 * website and builds image URLs from the public CDN pattern.
 *
 * Contract (investigated 2026-11-04; evidence in the agent report):
 * - Search: GET https://www.flaticon.com/search?word=<q>&page=<n> serves
 *   server-rendered HTML. Results link to icon pages
 *   (https://www.flaticon.com/free-icon/<slug>_<id>) and embed previews
 *   from the public PNG CDN. The parser anchors on those two URL
 *   patterns — not on CSS classes, which are not a contract.
 * - CDN: https://cdn-icons-png.flaticon.com/<size>/<floor(id/1000)>/<id>.png
 *   Sizes run 16..512. The pattern is confirmed by dozens of in-the-wild
 *   hotlinks, and the CDN itself is a plain public CDN: real assets
 *   answer 200, unknown ids a plain 404 (both verified live).
 * - SVG has NO public CDN pattern: free-icon SVG delivery stays behind
 *   Flaticon's gated download flow, so this provider serves PNG only.
 * - www.flaticon.com is guarded by a bot filter (Akamai). From this
 *   project's own sandbox egress, EVERY www page — search and homepage
 *   alike — returns HTTP 403 with a "security filter flagged something"
 *   page. Search therefore fails loudly (FlaticonWebError naming the
 *   block) wherever the filter refuses the network, and the cross-
 *   provider tools isolate that failure per provider.
 *
 * Attribution: Flaticon's license requires crediting the author named
 * on the icon's page. Search markup carries the author only sometimes;
 * when it doesn't, `author` stays absent — never invented — and the
 * Asset keeps the license + license URL via the adapter.
 */
import { FLATICON_LICENSE_URL } from "./flaticon-core.js";

export { FLATICON_LICENSE_URL };

/** Fetch implementation shape (the global fetch, or a test fake). */
export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<Response>;

export class FlaticonWebError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "FlaticonWebError";
    this.status = status;
  }
}

export const FLATICON_WEB_BASE = "https://www.flaticon.com";
export const FLATICON_CDN_BASE = "https://cdn-icons-png.flaticon.com";

/** The largest PNG size Flaticon's CDN serves. */
export const FLATICON_CDN_MAX_SIZE = 512;
/** A mid-size preview, always constructible from the same pattern. */
export const FLATICON_CDN_PREVIEW_SIZE = 128;

/**
 * Build the public CDN URL for an icon id at a size. The middle path
 * segment is floor(id / 1000) — verified against every in-the-wild
 * example found (ids from 5 to 8 digits).
 */
export function cdnPngUrl(id: number | string, size: number = FLATICON_CDN_MAX_SIZE): string {
  const n = Number(id);
  return `${FLATICON_CDN_BASE}/${size}/${Math.floor(n / 1000)}/${n}.png`;
}

/** Browser-ish headers: the site serves its filter page to obvious bots. */
const WEB_HEADERS: Record<string, string> = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
};

/** Markers of the bot-filter / challenge pages (never of a results page). */
const BLOCK_MARKERS = [
  "security filter flagged",
  "you don't have permission to access this page",
  "access denied",
  "attention required",
  "just a moment...",
  "are you a robot",
  "verify you are human",
];

function looksBlocked(body: string): boolean {
  const lower = body.toLowerCase();
  return BLOCK_MARKERS.some((marker) => lower.includes(marker));
}

function blockedError(status: number): FlaticonWebError {
  return new FlaticonWebError(
    `Flaticon web access blocked: flaticon.com returned HTTP ${status} with its security-filter page (bot protection). The experimental flaticon-web provider cannot fetch search pages from this network.`,
    status,
  );
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/** One icon as the web contract presents it: page fields kept, no Asset yet. */
export interface FlaticonWebIcon {
  id: number;
  title: string;
  /** Canonical icon page: https://www.flaticon.com/free-icon/<slug>_<id> */
  pageUrl: string;
  /** Author display name when the results markup carries it — attribution. */
  author?: string;
  /** Per-size PNG URLs keyed by size ("128", "256", "512"), as found on the page. */
  images: Record<string, string>;
}

export interface FlaticonWebSearchResult {
  total: number;
  icons: FlaticonWebIcon[];
}

export interface SearchIconsOptions {
  limit?: number;
  page?: number;
  fetchFn?: FetchLike;
}

/** Dependencies are accepted, not created, so tests can substitute them. */
export interface FlaticonWebDeps {
  fetchFn?: FetchLike;
}

interface PartialIcon {
  id: number;
  order: number;
  slug?: string;
  pageUrl?: string;
  anchorTitle?: string;
  alt?: string;
  author?: string;
  images: Record<string, string>;
}

function humanizeSlug(slug: string): string {
  const words = slug.replace(/-/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "";
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Parse a search-results page. Anchors on the two stable URL patterns
 * (icon-page links and CDN image URLs) and merges them by icon id, in
 * document order. Author links are searched in the window between one
 * result's anchor and the next result's anchor.
 */
function parseSearchHtml(html: string): FlaticonWebIcon[] {
  const byId = new Map<number, PartialIcon>();
  const get = (id: number, order: number): PartialIcon => {
    let item = byId.get(id);
    if (!item) {
      item = { id, order, images: {} };
      byId.set(id, item);
    }
    return item;
  };

  // Icon-page anchors: slug, id, optional title attribute.
  const anchorRe =
    /<a\b[^>]*href="https:\/\/www\.flaticon\.com\/free-icon\/([a-z0-9-]+)_(\d+)"[^>]*>/gi;
  const anchors: { index: number; id: number }[] = [];
  for (const match of html.matchAll(anchorRe)) {
    const id = Number(match[2]);
    const item = get(id, match.index);
    item.slug = match[1];
    item.pageUrl = `https://www.flaticon.com/free-icon/${match[1]}_${id}`;
    const titleAttr = match[0].match(/\btitle="([^"]*)"/i);
    if (titleAttr?.[1] && !item.anchorTitle) item.anchorTitle = titleAttr[1];
    anchors.push({ index: match.index, id });
  }

  // Author links, attributed to the nearest preceding result anchor.
  const authorRe = /<a\b[^>]*href="https:\/\/www\.flaticon\.com\/authors\/[a-z0-9-]+"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(authorRe)) {
    const owner = [...anchors].reverse().find((a) => a.index < match.index);
    if (!owner) continue;
    const item = byId.get(owner.id);
    const name = stripTags(match[1] ?? "");
    if (item && name && !item.author) item.author = name;
  }

  // CDN images, from src and srcset alike: size, shard, id.
  const imgTagRe = /<img\b[^>]*>/gi;
  const cdnRe = /cdn-icons-png\.flaticon\.com\/(\d+)\/(\d+)\/(\d+)\.png/g;
  for (const tag of html.matchAll(imgTagRe)) {
    const alt = tag[0].match(/\balt="([^"]*)"/i)?.[1];
    for (const cdn of tag[0].matchAll(cdnRe)) {
      const id = Number(cdn[3]);
      const item = get(id, tag.index);
      item.images[cdn[1]!] = `https://${cdn[0]}`;
      if (alt && !item.alt) item.alt = alt;
    }
  }

  return [...byId.values()]
    .filter((item) => item.pageUrl !== undefined)
    .sort((a, b) => a.order - b.order)
    .map((item) => ({
      id: item.id,
      title:
        item.anchorTitle ??
        (item.slug ? humanizeSlug(item.slug) : undefined) ??
        item.alt ??
        `Icon ${item.id}`,
      pageUrl: item.pageUrl!,
      ...(item.author ? { author: item.author } : {}),
      images: item.images,
    }));
}

/** "Showing <b>2</b> Cat icons" → 2. Best-effort; falls back to the parsed count. */
function parseTotal(html: string, fallback: number): number {
  const match = html.match(/showing[\s\S]{0,120}?([\d,]+)[\s\S]{0,60}?\bicons\b/i);
  if (match?.[1]) {
    const n = Number(match[1].replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

/** The URL of the largest size in a per-size image map. */
export function largestImageUrl(images: Record<string, string>): string | undefined {
  let best: string | undefined;
  let bestSize = -1;
  for (const [size, url] of Object.entries(images)) {
    const n = Number(size);
    if (Number.isFinite(n) && n > bestSize) {
      bestSize = n;
      best = url;
    }
  }
  return best;
}

/**
 * Search Flaticon through its public search page. Throws FlaticonWebError
 * when the bot filter refuses the request (naming the block), when the
 * HTTP call fails, or when a 200 page matches no known shape — never a
 * silent empty result for a broken contract. A genuine no-results page
 * returns an empty result.
 */
export async function searchIcons(
  query: string,
  opts: SearchIconsOptions = {},
): Promise<FlaticonWebSearchResult> {
  const fetchFn = opts.fetchFn ?? fetch;
  const params = new URLSearchParams({ word: query });
  if (opts.page !== undefined) params.set("page", String(opts.page));
  const url = `${FLATICON_WEB_BASE}/search?${params}`;

  const response = await fetchFn(url, { headers: WEB_HEADERS });
  const body = await response.text().catch(() => "");

  if (!response.ok) {
    if (response.status === 401 || response.status === 403 || response.status === 429) {
      throw blockedError(response.status);
    }
    throw new FlaticonWebError(
      `Flaticon web search failed: HTTP ${response.status}`,
      response.status,
    );
  }
  if (looksBlocked(body)) throw blockedError(response.status);

  const icons = parseSearchHtml(body);
  if (icons.length === 0) {
    if (/no results/i.test(body)) return { total: 0, icons: [] };
    throw new FlaticonWebError(
      "Flaticon web search returned a page with no parseable icons (HTTP 200) — the unofficial page contract may have changed.",
      response.status,
    );
  }
  const limit = opts.limit ?? 32;
  return { total: parseTotal(body, icons.length), icons: icons.slice(0, limit) };
}

// ---------------------------------------------------------------------------
// Icon resolution via the public CDN
// ---------------------------------------------------------------------------

export interface FlaticonWebIconDetail {
  id: number;
  /** Largest PNG (512) on the public CDN. */
  imageUrl: string;
  /** 128px PNG on the public CDN. */
  previewUrl: string;
}

export interface GetIconOptions {
  fetchFn?: FetchLike;
}

/**
 * Resolve one icon by id. The CDN pattern makes the URLs constructible
 * without any page fetch; a HEAD request verifies existence — the CDN
 * answers a plain 404 for unknown ids (verified live), which maps to
 * null. PNG only: no public SVG pattern exists.
 */
export async function getIcon(
  iconId: number | string,
  opts: GetIconOptions = {},
): Promise<FlaticonWebIconDetail | null> {
  const fetchFn = opts.fetchFn ?? fetch;
  const id = Number(iconId);
  const imageUrl = cdnPngUrl(id, FLATICON_CDN_MAX_SIZE);

  const response = await fetchFn(imageUrl, { method: "HEAD", headers: WEB_HEADERS });
  if (response.status === 404) return null;
  if (!response.ok) {
    if (response.status === 401 || response.status === 403 || response.status === 429) {
      throw blockedError(response.status);
    }
    throw new FlaticonWebError(
      `Flaticon web icon check failed: HTTP ${response.status}`,
      response.status,
    );
  }
  return { id, imageUrl, previewUrl: cdnPngUrl(id, FLATICON_CDN_PREVIEW_SIZE) };
}
