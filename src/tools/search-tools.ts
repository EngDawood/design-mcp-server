/**
 * Adapted from asset-finder-mcp (MIT, Erfangit23) — see THIRD_PARTY.md.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Provider } from "../types.js";
import { filterByLicense } from "../utils/license-filter.js";
import { formatSearchResultsForAI } from "../utils/normalize.js";

/**
 * Registers all search tools on the MCP server.
 */
export function registerSearchTools(server: McpServer, providers: Provider[]) {
  // --- search_icons ---
  // [design-mcp-server] Upstream searched Iconify only; on this root the
  // icon tool also queries Flaticon (when configured), merged into one
  // formatted result — the cross-provider model working as intended.
  server.tool(
    "search_icons",
    "Search for icons from 200,000+ icons across 150+ icon sets (Iconify), plus Flaticon when configured. Returns SVG/PNG icons with license info. Perfect for finding UI icons, app icons, and symbols.",
    {
      query: z.string().describe("Search term for icons (e.g. 'settings gear', 'home', 'user avatar')"),
      limit: z.number().optional().default(10).describe("Max results per provider (default 10)"),
      license: z.string().optional().describe("Filter by license: mit, cc0, cc-by, free-for-commercial"),
    },
    async ({ query, limit, license }) => {
      const iconProviders = providers.filter(
        (p) => ["iconify", "flaticon"].includes(p.name) && p.available
      );
      if (iconProviders.length === 0) {
        return { content: [{ type: "text", text: "No icon providers available." }] };
      }

      const settled = await Promise.allSettled(
        iconProviders.map((p) => p.search({ query, limit: limit ?? 10 }))
      );
      const sections: string[] = [];
      settled.forEach((r, i) => {
        if (r.status === "fulfilled") {
          let result = r.value;
          if (license) {
            result = { ...result, assets: filterByLicense(result.assets, license as any) };
          }
          if (result.assets.length > 0) sections.push(formatSearchResultsForAI(result));
        } else {
          sections.push(`Provider "${iconProviders[i]?.name}" failed: ${r.reason?.message ?? "unknown error"}`);
        }
      });

      return {
        content: [{ type: "text", text: sections.length > 0 ? sections.join("\n\n---\n\n") : `No icon results found for "${query}".` }],
      };
    }
  );

  // --- search_logos ---
  server.tool(
    "search_logos",
    "Search for brand and company logos. Returns high-quality PNG logos for 50,000+ brands. Requires LOGO_DEV_TOKEN env var for full functionality.",
    {
      query: z.string().describe("Brand or company name (e.g. 'Google', 'Microsoft', 'Stripe')"),
      limit: z.number().optional().default(5).describe("Max results (default 5)"),
    },
    async ({ query, limit }) => {
      const logoDev = providers.find((p) => p.name === "logo-dev");
      if (!logoDev || !logoDev.available) {
        return {
          content: [{
            type: "text",
            text: "Logo provider not available. Set LOGO_DEV_TOKEN environment variable to enable brand logo search. Get a free token at https://logo.dev",
          }],
        };
      }

      const result = await logoDev.search({ query, limit: limit ?? 5 });
      return {
        content: [{ type: "text", text: formatSearchResultsForAI(result) }],
      };
    }
  );

  // --- search_stock_photos ---
  server.tool(
    "search_stock_photos",
    "Search for free stock photos from Pexels, Unsplash, and Pixabay. Photos are free for commercial use. Set PEXELS_API_KEY, UNSPLASH_ACCESS_KEY, or PIXABAY_API_KEY env vars to enable respective providers.",
    {
      query: z.string().describe("Search term (e.g. 'mountain landscape', 'office workspace', 'team meeting')"),
      limit: z.number().optional().default(10).describe("Max results per provider (default 10)"),
      color: z.string().optional().describe("Filter by hex color (e.g. '#3498db' or '3498db')"),
      license: z.string().optional().describe("Filter by license type"),
    },
    async ({ query, limit, color, license }) => {
      const stockProviders = providers.filter((p) =>
        ["pexels", "unsplash", "pixabay"].includes(p.name) && p.available
      );

      if (stockProviders.length === 0) {
        return {
          content: [{
            type: "text",
            text: "No stock photo providers available. Set one of: PEXELS_API_KEY, UNSPLASH_ACCESS_KEY, or PIXABAY_API_KEY environment variables.\n\nGet free API keys at:\n- Pexels: https://www.pexels.com/api/\n- Unsplash: https://unsplash.com/developers\n- Pixabay: https://pixabay.com/api/docs/",
          }],
        };
      }

      const results = await Promise.allSettled(
        stockProviders.map((p) => p.search({ query, limit: limit ?? 10, color }))
      );

      const allAssets = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .flatMap((r) => r.value.assets);

      let filteredAssets = allAssets;
      if (license) {
        filteredAssets = filterByLicense(filteredAssets, license as any);
      }

      const providerNames = stockProviders.map((p) => p.name).join(", ");
      const text = `Found ${filteredAssets.length} stock photos from [${providerNames}] for "${query}":\n\n` +
        filteredAssets
          .map((asset, i) => {
            const parts = [
              `${i + 1}. [${asset.source}] ${asset.title}`,
              `   URL: ${asset.url}`,
              `   Preview: ${asset.previewUrl}`,
              `   Download: ${asset.downloadUrl}`,
              `   Dimensions: ${asset.width}x${asset.height}`,
              `   Author: ${asset.author}`,
              `   License: ${asset.license}`,
            ];
            return parts.join("\n");
          })
          .join("\n\n");

      return { content: [{ type: "text", text }] };
    }
  );

  // --- search_vectors ---
  // [design-mcp-server] Upstream searched SVG Repo only; on this root
  // Wikimedia Commons (official API, stable) is searched alongside it.
  // SVG Repo itself is experimental — see the provider's note.
  server.tool(
    "search_vectors",
    "Search for SVG vectors and illustrations from Wikimedia Commons (open-licensed, official API) and SVG Repo (experimental, undocumented endpoint). Returns downloadable SVG files with license information.",
    {
      query: z.string().describe("Search term (e.g. 'arrow', 'chart graph', 'phone mobile')"),
      limit: z.number().optional().default(15).describe("Max results per provider (default 15)"),
      license: z.string().optional().describe("Filter by license: cc0, cc-by, cc-by-sa, cc-by-nc"),
    },
    async ({ query, limit, license }) => {
      const vectorProviders = providers.filter(
        (p) => ["wikimedia", "svgrepo"].includes(p.name) && p.available
      );
      if (vectorProviders.length === 0) {
        return { content: [{ type: "text", text: "No vector providers available." }] };
      }

      const settled = await Promise.allSettled(
        vectorProviders.map((p) => p.search({ query, limit: limit ?? 15 }))
      );
      const sections: string[] = [];
      settled.forEach((r, i) => {
        if (r.status === "fulfilled") {
          let result = r.value;
          if (license) {
            result = { ...result, assets: filterByLicense(result.assets, license as any) };
          }
          if (result.assets.length > 0) sections.push(formatSearchResultsForAI(result));
        } else {
          sections.push(`Provider "${vectorProviders[i]?.name}" failed: ${r.reason?.message ?? "unknown error"}`);
        }
      });

      return {
        content: [{ type: "text", text: sections.length > 0 ? sections.join("\n\n---\n\n") : `No vector results found for "${query}".` }],
      };
    }
  );

  // --- search_emoji ---
  server.tool(
    "search_emoji",
    "Search for open-source emoji from OpenMoji. Returns SVG emoji files. All emoji are CC BY-SA 4.0 licensed.",
    {
      query: z.string().describe("Search term (e.g. 'happy face', 'rocket', 'heart love')"),
      limit: z.number().optional().default(10).describe("Max results (default 10)"),
    },
    async ({ query, limit }) => {
      const openmoji = providers.find((p) => p.name === "openmoji");
      if (!openmoji) {
        return { content: [{ type: "text", text: "OpenMoji provider not available." }] };
      }

      const result = await openmoji.search({ query, limit: limit ?? 10 });
      return {
        content: [{ type: "text", text: formatSearchResultsForAI(result) }],
      };
    }
  );
}
