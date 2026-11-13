/**
 * Adapted from asset-finder-mcp (MIT, Erfangit23) — see THIRD_PARTY.md.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Provider } from "../types.js";

/**
 * The list_providers tool — shows which asset providers are available
 * and configured. Helps the AI understand what sources it can search.
 */
export function registerListProvidersTool(server: McpServer, providers: Provider[]) {
  server.tool(
    "list_providers",
    "List all available asset providers and their status. Shows which providers are configured and ready to search. Use this to understand what sources are available before searching.",
    {},
    async () => {
      const lines: string[] = [
        "Available Asset Providers:",
        "",
      ];

      for (const provider of providers) {
        const status = provider.available ? "READY" : "NOT CONFIGURED";
        const sourceInfo = getProviderInfo(provider.name);
        lines.push(`- ${provider.name} [${status}]`);
        // [design-mcp-server] a provider's own description wins over the table.
        lines.push(`  Description: ${provider.description ?? sourceInfo.description}`);
        lines.push(`  Asset Types: ${sourceInfo.types.join(", ")}`);
        lines.push(`  API Key Required: ${sourceInfo.apiKeyRequired ? "Yes" : "No"}`);
        if (sourceInfo.apiKeyRequired && !provider.available) {
          lines.push(`  Setup: Set ${sourceInfo.envVar} environment variable`);
          lines.push(`  Get Key: ${sourceInfo.keyUrl}`);
        }
        // [design-mcp-server] caveats (e.g. svgrepo = experimental) print verbatim.
        if (provider.note) {
          lines.push(`  Note: ${provider.note}`);
        }
        lines.push("");
      }

      const available = providers.filter((p) => p.available);
      lines.push(`Total: ${providers.length} providers (${available.length} ready)`);

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );
}

function getProviderInfo(name: string) {
  const info: Record<string, {
    description: string;
    types: string[];
    apiKeyRequired: boolean;
    envVar?: string;
    keyUrl?: string;
  }> = {
    iconify: {
      description: "200,000+ icons across 150+ icon sets (Material, Tabler, Lucide, etc.)",
      types: ["icon"],
      apiKeyRequired: false,
    },
    svgrepo: {
      description: "500,000+ open-licensed SVG vectors and illustrations",
      types: ["vector", "illustration"],
      apiKeyRequired: false,
    },
    openmoji: {
      description: "Open-source emoji set (CC BY-SA 4.0)",
      types: ["emoji"],
      apiKeyRequired: false,
    },
    pexels: {
      description: "Free stock photos and videos",
      types: ["stock-photo"],
      apiKeyRequired: true,
      envVar: "PEXELS_API_KEY",
      keyUrl: "https://www.pexels.com/api/",
    },
    unsplash: {
      description: "High-quality free stock photography",
      types: ["stock-photo"],
      apiKeyRequired: true,
      envVar: "UNSPLASH_ACCESS_KEY",
      keyUrl: "https://unsplash.com/developers",
    },
    pixabay: {
      description: "Free photos, vectors, and illustrations",
      types: ["stock-photo", "vector", "illustration"],
      apiKeyRequired: true,
      envVar: "PIXABAY_API_KEY",
      keyUrl: "https://pixabay.com/api/docs/",
    },
    "logo-dev": {
      description: "Brand and company logos for 50,000+ brands",
      types: ["logo"],
      apiKeyRequired: true,
      envVar: "LOGO_DEV_TOKEN",
      keyUrl: "https://logo.dev",
    },
    // [design-mcp-server] providers ported from the previous root.
    wikimedia: {
      description: "Open-licensed SVG icons and illustrations from Wikimedia Commons (official MediaWiki API, keyless)",
      types: ["icon", "illustration"],
      apiKeyRequired: false,
    },
    flaticon: {
      description: "Millions of icons from Flaticon (Freepik) via the official API v3 — attribution required",
      types: ["icon"],
      apiKeyRequired: true,
      envVar: "FLATICON_API_KEY",
      keyUrl: "https://developer.flaticon.com/",
    },
    "flaticon-web": {
      description: "Millions of icons from Flaticon via its public web pages — EXPERIMENTAL keyless access, no API key",
      types: ["icon"],
      apiKeyRequired: false,
    },
    storyset: {
      description: "Free illustrations from storyset.com — plus native storyset_* tools for download, palette extraction and SVG recoloring",
      types: ["illustration"],
      apiKeyRequired: false,
    },
  };

  return info[name] ?? {
    description: "Unknown provider",
    types: [],
    apiKeyRequired: false,
  };
}
