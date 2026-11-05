/**
 * Flaticon provider core: the Flaticon API v3 contract behind plain functions.
 *
 * Contract (verified against working v3 clients — the official Raycast
 * extension and independent API clients — the docs portal is a JS app):
 * - Auth:  POST https://api.flaticon.com/v3/app/authentication
 *          JSON body { apikey } -> { data: { token, expires } }
 * - Search: GET https://api.flaticon.com/v3/search/icons?q=&limit=&page=
 *          header "Authorization: Bearer <token>" -> { data: [icon, ...] }
 * - Detail: GET https://api.flaticon.com/v3/item/icon/{id} -> { data: {...} }
 * - Download: GET https://api.flaticon.com/v3/item/icon/download/{id}?format=svg
 *          (or ?size=512 for PNG) -> the file itself, or JSON { data: { url } }
 *          carrying a signed URL.
 *
 * `expires` friction: clients in the wild read it both as an absolute Unix
 * timestamp (seconds) and as a TTL in seconds. `expiryFromResponse` accepts
 * either, and the re-auth-on-401 path covers any remaining misread.
 *
 * The API key is only ever read from the caller (env upstream). It is never
 * logged and never embedded in error messages.
 *
 * Migration note (asset-finder root): results map onto the unified `Asset`
 * in `src/types.ts` — id carries the "flaticon:" prefix, the license enum
 * value is "free-for-commercial" (Flaticon's own license permits commercial
 * use with attribution; the author name is always kept on the Asset).
 */
import type { Asset, LicenseType } from "../types.js";

export const FLATICON_LICENSE_URL = "https://www.flaticon.com/legal";

/** Flaticon content is under the Flaticon License: free with attribution, commercial use allowed. */
export function flaticonLicense(): LicenseType {
  return "free-for-commercial";
}

export const FLATICON_API_BASE = "https://api.flaticon.com/v3";

/** Fetch implementation shape (the global fetch, or a test fake). */
export type FetchLike = typeof fetch;

export interface CachedToken {
  token: string;
  /** Absolute expiry, epoch milliseconds, already net of the safety margin. */
  expiresAtMs: number;
}

/** Dependencies are accepted, not created, so tests can substitute them. */
export interface FlaticonDeps {
  fetch?: FetchLike;
  /** Token cache; one per isolate in production, fresh per test in tests. */
  cache?: Map<string, CachedToken>;
  /** Clock override for deterministic expiry tests. Epoch milliseconds. */
  now?: () => number;
}

export class FlaticonError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "FlaticonError";
    this.status = status;
  }
}

const TOKEN_SAFETY_MARGIN_MS = 60_000;
const DEFAULT_TOKEN_TTL_MS = 3_600_000;
const defaultCache = new Map<string, CachedToken>();

/**
 * Interpret the auth response's `expires` value. A value that lands within
 * the next 7 days when read as an absolute epoch (seconds) is absolute;
 * anything smaller is a TTL in seconds; anything larger falls back to the
 * default TTL (the 401 retry is the backstop).
 */
function expiryFromResponse(expires: unknown, nowMs: number): number {
  if (typeof expires === "number" && Number.isFinite(expires) && expires > 0) {
    const asAbsoluteMs = expires * 1000;
    if (asAbsoluteMs > nowMs && asAbsoluteMs < nowMs + 7 * 24 * 3_600_000) return asAbsoluteMs;
    if (expires < 7 * 24 * 3600) return nowMs + expires * 1000;
  }
  return nowMs + DEFAULT_TOKEN_TTL_MS;
}

async function authenticate(apiKey: string, fetchImpl: FetchLike, nowMs: number): Promise<CachedToken> {
  const response = await fetchImpl(`${FLATICON_API_BASE}/app/authentication`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ apikey: apiKey }),
  });
  if (!response.ok) {
    throw new FlaticonError(`Flaticon authentication failed: HTTP ${response.status}`, response.status);
  }
  const body = (await response.json().catch(() => null)) as {
    data?: { token?: string; expires?: number };
    error?: string;
  } | null;
  if (!body || body.error || !body.data?.token) {
    throw new FlaticonError(`Flaticon authentication failed: ${body?.error ?? "no token in response"}`);
  }
  const issuedToken = body.data.token;
  return {
    token: issuedToken,
    expiresAtMs: expiryFromResponse(body.data.expires, nowMs) - TOKEN_SAFETY_MARGIN_MS,
  };
}

/**
 * Return a valid bearer token for the API key, authenticating only when the
 * cached token is missing or expired. The cache is per-isolate module state
 * unless a cache is injected.
 */
export async function getToken(apiKey: string, deps: FlaticonDeps = {}): Promise<string> {
  if (!apiKey) throw new FlaticonError("Flaticon API key is required");
  const fetchImpl = deps.fetch ?? fetch;
  const cache = deps.cache ?? defaultCache;
  const now = deps.now ?? Date.now;

  const cached = cache.get(apiKey);
  if (cached && cached.expiresAtMs > now()) return cached.token;

  const fresh = await authenticate(apiKey, fetchImpl, now());
  cache.set(apiKey, fresh);
  return fresh.token;
}

/**
 * Run an authenticated request. On a 401 the cached token is discarded,
 * a fresh one is issued, and the request is retried exactly once.
 */
async function withAuth<T>(
  apiKey: string,
  deps: FlaticonDeps,
  run: (token: string, fetchImpl: FetchLike) => Promise<{ status: number; value: T }>,
): Promise<T> {
  const fetchImpl = deps.fetch ?? fetch;
  const cache = deps.cache ?? defaultCache;

  const first = await run(await getToken(apiKey, deps), fetchImpl);
  if (first.status !== 401) return first.value;

  cache.delete(apiKey);
  const second = await run(await getToken(apiKey, deps), fetchImpl);
  if (second.status === 401) {
    throw new FlaticonError("Flaticon rejected the credentials (401) after re-authentication", 401);
  }
  return second.value;
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  return (await response.json().catch(() => null)) as Record<string, unknown> | null;
}

function apiError(context: string, status: number, body: Record<string, unknown> | null): FlaticonError {
  const message =
    (typeof body?.message === "string" && body.message) ||
    (typeof body?.error === "string" && body.error) ||
    `HTTP ${status}`;
  return new FlaticonError(`Flaticon ${context} failed: ${message}`, status);
}

interface AuthedJson {
  status: number;
  ok: boolean;
  body: Record<string, unknown> | null;
}

/** GET a JSON endpoint with the bearer token, via the 401-retry helper. */
async function authedJson(
  apiKey: string,
  deps: FlaticonDeps,
  url: string,
): Promise<AuthedJson> {
  return withAuth(apiKey, deps, async (token, fetchImpl) => {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    return {
      status: response.status,
      value: { status: response.status, ok: response.ok, body: await readJson(response) },
    };
  });
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/** One icon as the provider presents it: API fields kept, Asset attached. */
export interface FlaticonIcon {
  id: number;
  description: string;
  tags: string[];
  /** Author/team name exactly as the API returns it — attribution, kept. */
  author?: string;
  packName?: string;
  familyName?: string;
  styleName?: string;
  /** Per-size PNG URLs keyed by size ("16".."512"), as the API returns them. */
  images: Record<string, string>;
  /** The unified cross-provider shape. */
  asset: Asset;
}

export interface FlaticonSearchResult {
  total: number;
  icons: FlaticonIcon[];
}

export interface SearchIconsOptions {
  limit?: number;
  page?: number;
}

interface RawIcon {
  id?: number | string;
  description?: string;
  tags?: string | string[];
  team_name?: string;
  author?: { name?: string } | string;
  pack_name?: string;
  family_name?: string;
  style?: { name?: string } | string;
  styleName?: string;
  images?: Record<string, string>;
}

function largestImageUrl(images: Record<string, string>): string | undefined {
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

function mapIcon(raw: RawIcon): FlaticonIcon {
  const id = Number(raw.id);
  const images = raw.images ?? {};
  const tags =
    typeof raw.tags === "string"
      ? raw.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : (raw.tags ?? []);
  const author =
    raw.team_name ??
    (typeof raw.author === "string" ? raw.author : raw.author?.name);
  const asset: Asset = {
    id: `flaticon:${id}`,
    type: "icon",
    title: raw.description ?? "",
    url: largestImageUrl(images) ?? "",
    previewUrl: images["256"] ?? largestImageUrl(images),
    downloadUrl: largestImageUrl(images),
    format: "png",
    ...(author ? { author } : {}),
    license: flaticonLicense(),
    licenseUrl: FLATICON_LICENSE_URL,
    source: "Flaticon",
    tags,
  };
  return {
    id,
    description: raw.description ?? "",
    tags,
    author,
    packName: raw.pack_name,
    familyName: raw.family_name,
    styleName: typeof raw.style === "string" ? raw.style : (raw.style?.name ?? raw.styleName),
    images,
    asset,
  };
}

/**
 * Search Flaticon icons. `total` comes from the response metadata when the
 * API provides it, else the number of returned icons.
 */
export async function searchIcons(
  apiKey: string,
  query: string,
  opts: SearchIconsOptions = {},
  deps: FlaticonDeps = {},
): Promise<FlaticonSearchResult> {
  const params = new URLSearchParams({ q: query, limit: String(opts.limit ?? 32) });
  if (opts.page !== undefined) params.set("page", String(opts.page));
  const url = `${FLATICON_API_BASE}/search/icons?${params}`;

  const { status, ok, body } = await authedJson(apiKey, deps, url);
  if (!ok) throw apiError("search", status, body);
  if (body?.status === "error") throw apiError("search", status, body);
  const data = Array.isArray(body?.data) ? (body.data as RawIcon[]) : [];
  const metadata = body?.metadata as { total?: number } | undefined;
  return { total: metadata?.total ?? data.length, icons: data.map(mapIcon) };
}

// ---------------------------------------------------------------------------
// Icon detail + download-URL resolution
// ---------------------------------------------------------------------------

export interface FlaticonDownload {
  format: "svg" | "png";
  size?: number;
  /** Fetchable URL. When `requiresAuth` is true, send the bearer token. */
  url: string;
  requiresAuth: boolean;
}

export interface FlaticonIconDetail {
  id: number;
  description?: string;
  /** Author name exactly as the API returns it — attribution, kept. */
  author?: string;
  pageUrl?: string;
  /** License label when the detail response provides one. */
  license?: string;
  download: FlaticonDownload;
}

export interface GetIconOptions {
  format?: "svg" | "png";
  /** PNG size in px (the API serves 16..512). Ignored for SVG. */
  size?: number;
}

type DownloadOutcome =
  | { kind: "resolved"; url: string; requiresAuth: boolean }
  | { kind: "error"; status: number; body: Record<string, unknown> | null };

/**
 * Resolve one icon: its download URL (signed-URL JSON form, or the endpoint
 * itself when the API hands back the file) plus best-effort detail metadata.
 * A failing detail lookup never fails the resolution.
 */
export async function getIcon(
  apiKey: string,
  iconId: number | string,
  opts: GetIconOptions = {},
  deps: FlaticonDeps = {},
): Promise<FlaticonIconDetail> {
  const id = String(iconId);
  const format = opts.format ?? "svg";
  const params = new URLSearchParams({ format });
  if (format === "png" && opts.size !== undefined) params.set("size", String(opts.size));
  const downloadUrl = `${FLATICON_API_BASE}/item/icon/download/${id}?${params}`;

  const outcome = await withAuth(apiKey, deps, async (token, fetchImpl) => {
    const response = await fetchImpl(downloadUrl, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    const contentType = response.headers.get("Content-Type") ?? "";
    if (!response.ok) {
      return {
        status: response.status,
        value: { kind: "error", status: response.status, body: await readJson(response) } as DownloadOutcome,
      };
    }
    if (contentType.includes("json")) {
      const body = await readJson(response);
      const signed = (body?.data as { url?: string } | undefined)?.url;
      if (signed) {
        return {
          status: response.status,
          value: { kind: "resolved", url: signed, requiresAuth: false } as DownloadOutcome,
        };
      }
      return {
        status: response.status,
        value: { kind: "error", status: response.status, body } as DownloadOutcome,
      };
    }
    // The API returned the file itself: the endpoint is the download URL,
    // and fetching it requires the bearer token.
    return {
      status: response.status,
      value: { kind: "resolved", url: downloadUrl, requiresAuth: true } as DownloadOutcome,
    };
  });
  if (outcome.kind === "error") throw apiError("download", outcome.status, outcome.body);

  const detail: FlaticonIconDetail = {
    id: Number(id),
    download: {
      format,
      ...(format === "png" && opts.size !== undefined ? { size: opts.size } : {}),
      url: outcome.url,
      requiresAuth: outcome.requiresAuth,
    },
  };

  try {
    const { ok, body } = await authedJson(apiKey, deps, `${FLATICON_API_BASE}/item/icon/${id}`);
    const data = ok ? (body?.data as Record<string, unknown> | undefined) : undefined;
    if (data) {
      if (typeof data.description === "string") detail.description = data.description;
      const author = data.author as { name?: string } | string | undefined;
      const authorName = typeof author === "string" ? author : author?.name;
      if (authorName) detail.author = authorName;
      if (typeof data.url === "string") detail.pageUrl = data.url;
      const license = data.license as string | { name?: string } | undefined;
      const licenseName = typeof license === "string" ? license : license?.name;
      if (licenseName) detail.license = licenseName;
    }
  } catch {
    // Metadata is a nicety; a missing author must not fail a good resolution.
  }
  return detail;
}
