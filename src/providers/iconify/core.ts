/**
 * Iconify provider core: the whole Iconify API contract behind three
 * functions. Adapted from better-icons (MIT) src/worker-server.ts — the
 * in-memory learned-preferences sorting and usage tracking were dropped;
 * results come back in the API's own stable order.
 */
import { resolveIconAlias, buildSvg, type IconSet } from "./icon-utils.js";
import type { IconifySearchResult, IconifyCollection } from "./types.js";

export const ICONIFY_API = "https://api.iconify.design";

function parseSearchResult(data: unknown): IconifySearchResult | null {
  if (
    typeof data === "object" &&
    data !== null &&
    "icons" in data &&
    Array.isArray((data as Record<string, unknown>).icons) &&
    "total" in data &&
    typeof (data as Record<string, unknown>).total === "number"
  ) {
    return data as IconifySearchResult;
  }
  return null;
}

function parseIconSet(data: unknown): IconSet | null {
  if (typeof data === "object" && data !== null && ("icons" in data || "aliases" in data)) {
    return data as IconSet;
  }
  return null;
}

export async function searchIconsCore(opts: {
  query: string;
  limit?: number;
  prefix?: string;
  category?: string;
}): Promise<{ total: number; icons: string[] }> {
  const params = new URLSearchParams({
    query: opts.query,
    limit: (opts.limit ?? 32).toString(),
  });
  if (opts.prefix) params.set("prefix", opts.prefix);
  if (opts.category) params.set("category", opts.category);
  const response = await fetch(`${ICONIFY_API}/search?${params}`);
  if (!response.ok) throw new Error(`Iconify search failed: ${response.status} ${response.statusText}`);
  const data = parseSearchResult(await response.json());
  if (!data) throw new Error("Iconify returned an invalid API response format");
  return { total: data.total, icons: data.icons };
}

export async function getIconCore(opts: {
  icon_id: string;
  color?: string;
  size?: number;
}): Promise<{ svg: string; width: number; height: number }> {
  const [prefix, name] = opts.icon_id.split(":");
  if (!prefix || !name) throw new Error("Invalid icon ID for Iconify. Use 'prefix:name' format.");
  const dataResponse = await fetch(`${ICONIFY_API}/${prefix}.json?icons=${name}`);
  if (!dataResponse.ok) throw new Error(`Iconify fetch failed: ${dataResponse.status} ${dataResponse.statusText}`);
  const iconSet = parseIconSet(await dataResponse.json());
  if (!iconSet) throw new Error("Iconify returned an invalid API response format");
  const resolvedName = resolveIconAlias(iconSet, name);
  const iconData = iconSet.icons?.[resolvedName];
  if (!iconData) throw new Error(`Iconify icon '${opts.icon_id}' not found`);
  const svg = buildSvg(iconData, { width: iconSet.width, height: iconSet.height }, { size: opts.size, color: opts.color });
  return {
    svg,
    width: iconData.width || iconSet.width || 24,
    height: iconData.height || iconSet.height || 24,
  };
}

export async function listCollectionsCore(opts: {
  category?: string;
  search?: string;
}): Promise<{ total: number; collections: { prefix: string; name: string; total: number; category?: string }[] }> {
  const response = await fetch(`${ICONIFY_API}/collections`);
  if (!response.ok) throw new Error(`Iconify collections failed: ${response.status} ${response.statusText}`);
  const raw = (await response.json()) as Record<string, IconifyCollection> | null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Iconify returned an invalid API response format");
  let filtered = Object.entries(raw);
  if (opts.category) {
    filtered = filtered.filter(([_, c]) => c.category?.toLowerCase().includes(opts.category!.toLowerCase()));
  }
  if (opts.search) {
    const s = opts.search.toLowerCase();
    filtered = filtered.filter(([p, c]) => p.toLowerCase().includes(s) || c.name.toLowerCase().includes(s));
  }
  filtered.sort((a, b) => b[1].total - a[1].total);
  return {
    total: filtered.length,
    collections: filtered
      .slice(0, 50)
      .map(([prefix, c]) => ({ prefix, name: c.name, total: c.total, category: c.category })),
  };
}
