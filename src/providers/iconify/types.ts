/**
 * Iconify API payload types, copied from better-icons (MIT) src/types.ts —
 * the two interfaces this provider uses. (The icon-set types, IconSet /
 * IconData, live in icon-utils.ts with the helpers that consume them,
 * exactly as upstream.)
 */
export interface IconifySearchResult {
  icons: string[];
  total: number;
  limit: number;
  start: number;
  collections: Record<string, number>;
}

export interface IconifyCollection {
  name: string;
  total: number;
  author?: { name: string; url?: string };
  license?: { title: string; spdx?: string; url?: string };
  samples?: string[];
  height?: number | number[];
  category?: string;
  palette?: boolean;
}
