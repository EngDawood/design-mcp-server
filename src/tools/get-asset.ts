/**
 * Adapted from asset-finder-mcp (MIT, Erfangit23) — see THIRD_PARTY.md.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Provider } from "../types.js";

/**
 * The get_asset tool — fetch a specific asset by its ID.
 * Useful when the AI has already found an asset and needs to get
 * its full details or download URL.
 */
export function registerGetAssetTool(server: McpServer, providers: Provider[]) {
  server.tool(
    "get_asset",
    "Get full details for a specific asset by its ID (e.g. 'iconify:mdi:home' or 'pexels:12345'). Returns the asset URL, download URL, license info, and metadata.",
    {
      id: z.string().describe("Asset ID (e.g. 'iconify:mdi:home', 'svgrepo:12345', 'unsplash:abc123')"),
    },
    async ({ id }) => {
      // Find the provider based on ID prefix
      const provider = providers.find((p) => {
        const providerPrefix = p.name === "logo-dev" ? "logo-dev" : p.name;
        return id.startsWith(`${providerPrefix}:`);
      });

      if (!provider) {
        return {
          content: [{
            type: "text",
            text: `Unknown asset ID format: ${id}. Expected format: <provider>:<asset-id>`,
          }],
        };
      }

      if (provider.getById) {
        const asset = await provider.getById(id);
        if (asset) {
          const parts = [
            `Asset: ${asset.title}`,
            `Type: ${asset.type}`,
            `URL: ${asset.url}`,
            `Format: ${asset.format}`,
            `License: ${asset.license}${asset.licenseUrl ? ` (${asset.licenseUrl})` : ""}`,
            `Source: ${asset.source}`,
          ];
          if (asset.previewUrl) parts.push(`Preview: ${asset.previewUrl}`);
          if (asset.downloadUrl) parts.push(`Download: ${asset.downloadUrl}`);
          if (asset.width && asset.height) parts.push(`Dimensions: ${asset.width}x${asset.height}`);
          if (asset.author) parts.push(`Author: ${asset.author}`);

          return { content: [{ type: "text", text: parts.join("\n") }] };
        }
      }

      return {
        content: [{
          type: "text",
          text: `Asset not found: ${id}`,
        }],
      };
    }
  );
}
