/**
 * Adapted from asset-finder-mcp (MIT, Erfangit23) — see THIRD_PARTY.md.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Provider } from "../types.js";
import { formatSearchResultsForAI } from "../utils/normalize.js";
import { filterByLicense } from "../utils/license-filter.js";

/**
 * The suggest_asset tool — the killer feature.
 * Lets the AI describe what it needs in natural language,
 * searches all relevant providers, and returns ranked results.
 */
export function registerSuggestTool(server: McpServer, providers: Provider[]) {
  server.tool(
    "suggest_asset",
    "Smart asset suggestion — describe what you need in natural language and get the best matching assets across all sources (icons, logos, stock photos, vectors, emoji). The tool automatically picks the right provider(s) based on your description. Use this when you're not sure which specific asset type to search for.",
    {
      description: z.string().describe("Natural language description of what you need. Be specific about style, purpose, and context. Examples: 'modern minimalist icon for a settings menu in blue', 'professional headshot photo for a team page', 'Stripe company logo', 'cute cat emoji'"),
      limit: z.number().optional().default(5).describe("Max results per provider (default 5)"),
      license: z.string().optional().describe("Filter by license: mit, cc0, cc-by, free-for-commercial, personal-only"),
      preferred_type: z.string().optional().describe("Preferred asset type: icon, logo, stock-photo, vector, emoji. If not specified, all relevant types are searched."),
    },
    async ({ description, limit, license, preferred_type }) => {
      const query = description;
      const maxResults = limit ?? 5;

      // Determine which providers to search based on description and preferred type
      const lowerDesc = description.toLowerCase();

      let providersToSearch: Provider[] = [];

      if (preferred_type) {
        // Use preferred type to select providers
        switch (preferred_type) {
          case "icon":
            providersToSearch = providers.filter((p) => ["iconify", "flaticon", "flaticon-web", "svgrepo"].includes(p.name) && p.available);
            break;
          case "logo":
            providersToSearch = providers.filter((p) => ["logo-dev"].includes(p.name) && p.available);
            break;
          case "stock-photo":
            providersToSearch = providers.filter((p) => ["pexels", "unsplash", "pixabay"].includes(p.name) && p.available);
            break;
          case "vector":
            providersToSearch = providers.filter((p) => ["svgrepo", "wikimedia", "storyset", "pixabay"].includes(p.name) && p.available);
            break;
          case "emoji":
            providersToSearch = providers.filter((p) => ["openmoji"].includes(p.name) && p.available);
            break;
          default:
            providersToSearch = providers.filter((p) => p.available);
        }
      } else {
        // Auto-detect from description
        const logoKeywords = ["logo", "brand", "company", "corporate"];
        const iconKeywords = ["icon", "ui", "menu", "button", "symbol", "navigation"];
        const emojiKeywords = ["emoji", "face", "smiley", "reaction"];
        const photoKeywords = ["photo", "image", "picture", "background", "wallpaper", "realistic"];
        const vectorKeywords = ["vector", "illustration", "drawing", "art", "clipart"];

        if (logoKeywords.some((k) => lowerDesc.includes(k))) {
          providersToSearch.push(...providers.filter((p) => ["logo-dev"].includes(p.name) && p.available));
        }
        if (iconKeywords.some((k) => lowerDesc.includes(k)) || !providersToSearch.length) {
          providersToSearch.push(...providers.filter((p) => ["iconify", "flaticon", "flaticon-web"].includes(p.name) && p.available));
        }
        if (emojiKeywords.some((k) => lowerDesc.includes(k))) {
          providersToSearch.push(...providers.filter((p) => ["openmoji"].includes(p.name) && p.available));
        }
        if (photoKeywords.some((k) => lowerDesc.includes(k))) {
          providersToSearch.push(...providers.filter((p) => ["pexels", "unsplash", "pixabay"].includes(p.name) && p.available));
        }
        if (vectorKeywords.some((k) => lowerDesc.includes(k))) {
          providersToSearch.push(...providers.filter((p) => ["svgrepo", "wikimedia", "storyset"].includes(p.name) && p.available));
        }

        // If nothing matched, search everything available
        if (providersToSearch.length === 0) {
          providersToSearch = providers.filter((p) => p.available);
        }

        // Deduplicate
        providersToSearch = [...new Set(providersToSearch)];
      }

      if (providersToSearch.length === 0) {
        return {
          content: [{
            type: "text",
            text: "No providers available for this search. The built-in providers (Iconify, SVG Repo, OpenMoji) should always be available. If they're not loading, there may be a network issue.",
          }],
        };
      }

      // Search all selected providers in parallel
      const results = await Promise.allSettled(
        providersToSearch.map((p) => p.search({ query, limit: maxResults }))
      );

      const sections: string[] = [];
      let totalFound = 0;

      results.forEach((r, i) => {
        if (r.status === "fulfilled") {
          let assets = r.value.assets;
          if (license) {
            assets = filterByLicense(assets, license as any);
          }
          if (assets.length > 0) {
            sections.push(formatSearchResultsForAI({
              ...r.value,
              assets,
            }));
            totalFound += assets.length;
          }
        } else {
          const providerName = providersToSearch[i]?.name ?? "unknown";
          sections.push(`Provider "${providerName}" failed: ${r.reason?.message ?? "unknown error"}`);
        }
      });

      if (totalFound === 0) {
        return {
          content: [{
            type: "text",
            text: `No assets found for "${description}". Try a different search term or check if the relevant API keys are configured.`,
          }],
        };
      }

      const header = `Smart suggestion for: "${description}"\nSearched: ${providersToSearch.map((p) => p.name).join(", ")}\nFound ${totalFound} matching assets:\n\n`;

      return {
        content: [{ type: "text", text: header + sections.join("\n\n---\n\n") }],
      };
    }
  );
}
