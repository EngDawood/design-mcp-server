/**
 * Storyset provider — free illustrations from storyset.com.
 *
 * search/getById sit on the unified Provider seam like everyone else. The
 * rest of Storyset's value — download with inline cap, palette extraction,
 * SVG recoloring — does not fit those two methods, so this provider is the
 * one user of the seam's escape hatch, `registerTools` (see src/types.ts):
 * it registers the five native storyset_* tools, ported from the owner's
 * MCP-STORYSET server. All behaviour lives in ./storyset-core.ts; this
 * module only declares schemas and shapes results.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { Asset, Provider, ProviderEnv, SearchParams, SearchResult } from "../types.js";
import {
  ASSET_HOST,
  MAX_INLINE_BYTES,
  STORYSET_STYLES,
  downloadAsset,
  extractPalette,
  getIllustration,
  recolorSvg,
  searchResultToAsset,
  searchStoryset,
} from "./storyset-core.js";

const STORYSET_LICENSE_URL = "https://storyset.com/terms";

export class StorysetProvider implements Provider {
  name = "storyset";
  available = true;
  description =
    "Free illustrations from storyset.com: search, resolve, download, palette extraction and SVG recoloring";

  async search(params: SearchParams): Promise<SearchResult> {
    const data = await searchStoryset(params.query, params.limit ?? 20);
    return {
      assets: data.results.map(searchResultToAsset),
      total: data.count,
      provider: this.name,
      query: params.query,
    };
  }

  async getById(id: string): Promise<Asset | null> {
    const native = id.startsWith("storyset:") ? id.slice("storyset:".length) : id;
    // Search ids are the bare slug; "slug/style" (or "slug:style") picks a style.
    const [slug, style] = native.split(/[/:]/);
    if (!slug) return null;
    const result = await getIllustration(slug, style ?? "amico");
    if ("error" in result) return null;
    const url = result.svg_url ?? result.png_url ?? result.page_url;
    return {
      id: `storyset:${slug}`,
      type: "illustration",
      title: slug,
      url,
      ...(result.png_url ? { previewUrl: result.png_url } : {}),
      ...(result.svg_url ? { downloadUrl: result.svg_url } : {}),
      format: result.svg_url ? "svg" : "png",
      license: "free-for-commercial",
      licenseUrl: STORYSET_LICENSE_URL,
      source: "Storyset",
      sourceUrl: result.page_url,
    };
  }

  /**
   * The escape hatch: Storyset's native tools. Handlers never throw —
   * failures come back as error results carrying `{ "error": string }`.
   */
  registerTools(server: McpServer, env: ProviderEnv): void {
    // Recolor results link back to a `/f/recolor.svg` regeneration route
    // on the serving deployment when its public origin is configured. The
    // seam gives providers no route registration, so core degrades to
    // inline content when this is unset.
    const origin = env.PUBLIC_ORIGIN;

    server.registerTool(
      "storyset_search",
      {
        description:
          "Search storyset.com illustrations. Returns native results plus the same " +
          "results mapped to the unified Asset shape under `assets`.",
        inputSchema: {
          query: z.string().describe("Search keyword, e.g. 'developer', 'finance'"),
          limit: z.number().int().min(1).max(60).default(20).describe("Max results to return"),
        },
      },
      async ({ query, limit }) => {
        try {
          const data = await searchStoryset(query, limit);
          return json({ ...data, assets: data.results.map(searchResultToAsset) });
        } catch (e) {
          return jsonError(e);
        }
      },
    );

    server.registerTool(
      "storyset_get_illustration",
      {
        description:
          "Fetch one illustration's page and return canonical PNG + SVG download URLs.",
        inputSchema: {
          slug: z.string().describe("Illustration slug, e.g. 'programmer'"),
          style: STYLE.default("amico").describe("Style variant"),
        },
      },
      async ({ slug, style }) => {
        try {
          return json(await getIllustration(slug, style));
        } catch (e) {
          return jsonError(e);
        }
      },
    );

    server.registerTool(
      "storyset_download",
      {
        description:
          "Resolve an asset URL and return its metadata plus a ready-to-use `url` " +
          "(filename, byte size, content type). Optional `recolor` map rewrites hex colors " +
          "inside an SVG (handy for changing the primary brand color of a Storyset " +
          "illustration).",
        inputSchema: {
          asset_url: z.string().describe(`Direct asset URL from ${ASSET_HOST} (svg/png)`),
          recolor: z
            .record(z.string(), z.string())
            .optional()
            .describe(
              "Optional SVG-only color remap, e.g. {'#BA68C8': '#2196F3'}. " +
                "Keys = colors currently in SVG, values = target colors. Ignored for PNG.",
            ),
          inline: z.boolean().default(false).describe(INLINE_DESC),
        },
      },
      async ({ asset_url, recolor, inline }) => {
        try {
          return json(await downloadAsset(asset_url, { recolor, inline, origin }));
        } catch (e) {
          return jsonError(e);
        }
      },
    );

    server.registerTool(
      "storyset_extract_palette",
      {
        description:
          "Return the dominant hex colors in an SVG, sorted by frequency. " +
          "Use this to discover which color to feed into `recolor` / `storyset_download(recolor=...)`. " +
          "The top entry is usually the primary brand color (e.g. #ba68c8 on Storyset).",
        inputSchema: {
          source: z.string().describe(`SVG asset URL (${ASSET_HOST}) or raw SVG markup`),
          top: z.number().int().min(1).max(64).default(12).describe("Max colors to return"),
        },
      },
      async ({ source, top }) => {
        try {
          return json(await extractPalette(source, top));
        } catch (e) {
          return jsonError(e);
        }
      },
    );

    server.registerTool(
      "storyset_recolor_svg",
      {
        description:
          "Recolor an SVG and return per-color replacement counts, plus a regeneration " +
          "`url` when the source is a URL and the deployment origin is configured. " +
          "Use `storyset_extract_palette` first to see colors. Raw inline markup has no " +
          "source URL to regenerate from, so it is returned inline instead.",
        inputSchema: {
          source: z.string().describe(`SVG asset URL (${ASSET_HOST}) or raw SVG markup`),
          mapping: z
            .record(z.string(), z.string())
            .describe(
              "Color remap, e.g. {'#BA68C8': '#2196F3', '#455a64': '#1a237e'}. " +
                "Hex 3-digit or 6-digit, case insensitive.",
            ),
          inline: z.boolean().default(false).describe(INLINE_DESC),
        },
      },
      async ({ source, mapping, inline }) => {
        try {
          return json(await recolorSvg(source, mapping, { inline, origin }));
        } catch (e) {
          return jsonError(e);
        }
      },
    );
  }
}

const INLINE_DESC =
  `Return the asset bytes in the result. Off by default: assets can exceed ${MAX_INLINE_BYTES} ` +
  "bytes and would flood the context. Use the returned `url` instead unless you need to read the markup.";

const STYLE = z.enum(STORYSET_STYLES);

function json(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function jsonError(e: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      },
    ],
    isError: true,
  };
}
