/**
 * Iconify provider: 200+ open icon libraries (Lucide, Material Design
 * Icons, Tabler, …) behind the design-mcp-server provider seam.
 * Seeded from better-icons (MIT); see core.ts / icon-utils.ts headers.
 *
 * Tool contract (shared by all providers): success results are MCP text
 * content carrying a JSON payload; failures are error results carrying
 * `{ "error": string }` — handlers never throw.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DesignProvider } from "../../core/provider.js";
import type { Asset } from "../../core/assets.js";
import { searchIconsCore, getIconCore, listCollectionsCore } from "./core.js";

const json = (payload: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
});
const jsonError = (e: unknown) => ({
  content: [
    { type: "text" as const, text: JSON.stringify({ error: e instanceof Error ? e.message : String(e) }) },
  ],
  isError: true,
});

export const iconifyProvider: DesignProvider = {
  id: "iconify",
  displayName: "Iconify",
  description: "Icons from 200+ open libraries (Lucide, MDI, Tabler, …) via the Iconify API.",
  kinds: ["icon"],
  homepage: "https://iconify.design",

  register(server: McpServer): void {
    server.registerTool(
      "iconify_search_icons",
      {
        description:
          "Search for icons across 200+ icon libraries powered by Iconify. Returns icon identifiers that can be used with iconify_get_icon.",
        inputSchema: {
          query: z.string().describe("Search query (e.g., 'arrow', 'home', 'user', 'check')"),
          limit: z.number().min(1).max(999).default(32).describe("Maximum number of results (1-999, default: 32)"),
          prefix: z.string().optional().describe("Filter by icon collection prefix (e.g., 'mdi', 'lucide', 'heroicons')"),
          category: z.string().optional().describe("Filter by category (e.g., 'General', 'Emoji', 'Thematic')"),
        },
      },
      async ({ query, limit = 32, prefix, category }) => {
        try {
          const data = await searchIconsCore({ query, limit, prefix, category });
          const icons = data.icons.map((icon) => {
            const [p, n] = icon.split(":");
            return { id: icon, prefix: p ?? "", name: n ?? "" };
          });
          const assets: Asset[] = icons.map((i) => ({
            provider: "iconify",
            id: i.id,
            title: i.name,
            kind: "icon",
          }));
          return json({ total: data.total, icons, assets });
        } catch (e) {
          return jsonError(e);
        }
      }
    );

    server.registerTool(
      "iconify_get_icon",
      {
        description: "Get the SVG code for a specific icon. Use the icon ID from iconify_search_icons results.",
        inputSchema: {
          icon_id: z.string().describe("Icon identifier in format 'prefix:name' (e.g., 'mdi:home', 'lucide:arrow-right')"),
          color: z.string().optional().describe("Icon color (e.g., '#ff0000', 'currentColor')"),
          size: z.number().optional().describe("Icon size in pixels"),
        },
      },
      async ({ icon_id, color, size }) => {
        try {
          const { svg, width, height } = await getIconCore({ icon_id, color, size });
          return json({ id: icon_id, svg, width, height });
        } catch (e) {
          return jsonError(e);
        }
      }
    );

    server.registerTool(
      "iconify_list_collections",
      {
        description: "List available Iconify icon collections/libraries.",
        inputSchema: {
          category: z.string().optional().describe("Filter by category"),
          search: z.string().optional().describe("Search collections by name"),
        },
      },
      async ({ category, search }) => {
        try {
          const data = await listCollectionsCore({ category, search });
          return json(data);
        } catch (e) {
          return jsonError(e);
        }
      }
    );
  },
};

export default iconifyProvider;
