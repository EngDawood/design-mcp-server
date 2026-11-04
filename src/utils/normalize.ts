/**
 * Copied from asset-finder-mcp (MIT, Erfangit23) — see THIRD_PARTY.md.
 */
import type { Asset, SearchResult } from "../types.js";

/**
 * Normalizes various provider responses into unified Asset format.
 */

export function normalizeAssets(
  assets: Asset[],
  provider: string,
  query: string,
  total?: number
): SearchResult {
  return {
    assets,
    total: total ?? assets.length,
    provider,
    query,
  };
}

/**
 * Formats an asset for AI-friendly display.
 * AI agents can use this to reason about which asset to pick.
 */
export function formatAssetForAI(asset: Asset): string {
  const parts: string[] = [
    `[${asset.type.toUpperCase()}] ${asset.title}`,
    `  URL: ${asset.url}`,
    `  Format: ${asset.format}`,
    `  License: ${asset.license}${asset.licenseUrl ? ` (${asset.licenseUrl})` : ""}`,
    `  Source: ${asset.source}`,
  ];

  if (asset.width && asset.height) {
    parts.push(`  Dimensions: ${asset.width}x${asset.height}`);
  }
  if (asset.author) {
    parts.push(`  Author: ${asset.author}`);
  }
  if (asset.tags && asset.tags.length > 0) {
    parts.push(`  Tags: ${asset.tags.join(", ")}`);
  }
  if (asset.colorPalette && asset.colorPalette.length > 0) {
    parts.push(`  Colors: ${asset.colorPalette.join(", ")}`);
  }
  if (asset.description) {
    parts.push(`  Description: ${asset.description}`);
  }

  return parts.join("\n");
}

/**
 * Formats search results as a compact, AI-friendly text block.
 */
export function formatSearchResultsForAI(result: SearchResult): string {
  if (result.assets.length === 0) {
    return `No ${result.provider} results found for "${result.query}".`;
  }

  const lines: string[] = [
    `Found ${result.total} ${result.provider} results for "${result.query}" (showing ${result.assets.length}):`,
    "",
  ];

  result.assets.forEach((asset, i) => {
    lines.push(`${i + 1}. ${formatAssetForAI(asset)}`);
    lines.push("");
  });

  return lines.join("\n");
}
