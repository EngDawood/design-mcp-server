/**
 * The tool catalog shown on /tools (and counted on the landing page).
 *
 * Every entry is transcribed from the tool's real registration: the
 * cross-provider tools in src/tools/ (search-tools.ts, suggest-asset.ts,
 * get-asset.ts, list-providers.ts) and Storyset's registerTools escape
 * hatch in src/providers/storyset.ts — names, descriptions, parameters
 * (from the zod schemas: a parameter is "required" when it has neither
 * .optional() nor .default()) and an example call per tool.
 *
 * tests/frontend.test.ts cross-checks these names against the live MCP
 * server's tools/list, so the catalog cannot silently drift from the code.
 */

export interface ToolParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface ToolDoc {
  name: string;
  group: "cross-provider" | "storyset-native";
  description: string;
  params: ToolParam[];
  example: string;
}

export const TOOLS: ToolDoc[] = [
  {
    name: "search_icons",
    group: "cross-provider",
    description:
      "Search for icons from 200,000+ icons across 150+ icon sets (Iconify), plus Flaticon when configured. Returns SVG/PNG icons with license info. Perfect for finding UI icons, app icons, and symbols.",
    params: [
      { name: "query", type: "string", required: true, description: "Search term for icons (e.g. 'settings gear', 'home', 'user avatar')" },
      { name: "limit", type: "number", required: false, description: "Max results per provider (default 10)" },
      { name: "license", type: "string", required: false, description: "Filter by license: mit, cc0, cc-by, free-for-commercial" },
    ],
    example: '{ "query": "home", "limit": 10 }',
  },
  {
    name: "search_vectors",
    group: "cross-provider",
    description:
      "Search for SVG vectors and illustrations from Wikimedia Commons (open-licensed, official API) and SVG Repo (experimental, undocumented endpoint). Returns downloadable SVG files with license information.",
    params: [
      { name: "query", type: "string", required: true, description: "Search term (e.g. 'arrow', 'chart graph', 'phone mobile')" },
      { name: "limit", type: "number", required: false, description: "Max results per provider (default 15)" },
      { name: "license", type: "string", required: false, description: "Filter by license: cc0, cc-by, cc-by-sa, cc-by-nc" },
    ],
    example: '{ "query": "arrow", "limit": 15 }',
  },
  {
    name: "search_stock_photos",
    group: "cross-provider",
    description:
      "Search for free stock photos from Pexels, Unsplash, and Pixabay. Photos are free for commercial use. Set PEXELS_API_KEY, UNSPLASH_ACCESS_KEY, or PIXABAY_API_KEY env vars to enable respective providers.",
    params: [
      { name: "query", type: "string", required: true, description: "Search term (e.g. 'mountain landscape', 'office workspace', 'team meeting')" },
      { name: "limit", type: "number", required: false, description: "Max results per provider (default 10)" },
      { name: "color", type: "string", required: false, description: "Filter by hex color (e.g. '#3498db' or '3498db')" },
      { name: "license", type: "string", required: false, description: "Filter by license type" },
    ],
    example: '{ "query": "office workspace", "limit": 10 }',
  },
  {
    name: "search_emoji",
    group: "cross-provider",
    description:
      "Search for open-source emoji from OpenMoji. Returns SVG emoji files. All emoji are CC BY-SA 4.0 licensed.",
    params: [
      { name: "query", type: "string", required: true, description: "Search term (e.g. 'happy face', 'rocket', 'heart love')" },
      { name: "limit", type: "number", required: false, description: "Max results (default 10)" },
    ],
    example: '{ "query": "rocket", "limit": 10 }',
  },
  {
    name: "search_logos",
    group: "cross-provider",
    description:
      "Search for brand and company logos. Returns high-quality PNG logos for 50,000+ brands. Requires LOGO_DEV_TOKEN env var for full functionality.",
    params: [
      { name: "query", type: "string", required: true, description: "Brand or company name (e.g. 'Google', 'Microsoft', 'Stripe')" },
      { name: "limit", type: "number", required: false, description: "Max results (default 5)" },
    ],
    example: '{ "query": "Stripe", "limit": 5 }',
  },
  {
    name: "suggest_asset",
    group: "cross-provider",
    description:
      "Smart asset suggestion — describe what you need in natural language and get the best matching assets across all sources (icons, logos, stock photos, vectors, emoji). The tool automatically picks the right provider(s) based on your description. Use this when you're not sure which specific asset type to search for.",
    params: [
      { name: "description", type: "string", required: true, description: "Natural language description of what you need, e.g. 'modern minimalist icon for a settings menu in blue'" },
      { name: "limit", type: "number", required: false, description: "Max results per provider (default 5)" },
      { name: "license", type: "string", required: false, description: "Filter by license: mit, cc0, cc-by, free-for-commercial, personal-only" },
      { name: "preferred_type", type: "string", required: false, description: "Preferred asset type: icon, logo, stock-photo, vector, emoji. If not specified, all relevant types are searched." },
    ],
    example: '{ "description": "minimalist icon for a settings menu", "preferred_type": "icon" }',
  },
  {
    name: "get_asset",
    group: "cross-provider",
    description:
      "Get full details for a specific asset by its ID (e.g. 'iconify:mdi:home' or 'pexels:12345'). Returns the asset URL, download URL, license info, and metadata.",
    params: [
      { name: "id", type: "string", required: true, description: "Asset ID (e.g. 'iconify:mdi:home', 'svgrepo:12345', 'unsplash:abc123')" },
    ],
    example: '{ "id": "iconify:mdi:home" }',
  },
  {
    name: "list_providers",
    group: "cross-provider",
    description:
      "List all available asset providers and their status. Shows which providers are configured and ready to search. Use this to understand what sources are available before searching.",
    params: [],
    example: "{}",
  },
  {
    name: "storyset_search",
    group: "storyset-native",
    description:
      "Search storyset.com illustrations. Returns native results plus the same results mapped to the unified Asset shape under `assets`.",
    params: [
      { name: "query", type: "string", required: true, description: "Search keyword, e.g. 'developer', 'finance'" },
      { name: "limit", type: "number (int, 1-60)", required: false, description: "Max results to return (default 20)" },
    ],
    example: '{ "query": "developer", "limit": 20 }',
  },
  {
    name: "storyset_get_illustration",
    group: "storyset-native",
    description:
      "Fetch one illustration's page and return canonical PNG + SVG download URLs.",
    params: [
      { name: "slug", type: "string", required: true, description: "Illustration slug, e.g. 'programmer'" },
      { name: "style", type: "string (enum)", required: false, description: "Style variant (default 'amico')" },
    ],
    example: '{ "slug": "programmer", "style": "amico" }',
  },
  {
    name: "storyset_download",
    group: "storyset-native",
    description:
      "Resolve an asset URL and return its metadata plus a ready-to-use `url` (filename, byte size, content type). Optional `recolor` map rewrites hex colors inside an SVG.",
    params: [
      { name: "asset_url", type: "string", required: true, description: "Direct asset URL from stories.freepiklabs.com (svg/png)" },
      { name: "recolor", type: "record<string, string>", required: false, description: "Optional SVG-only color remap, e.g. {'#BA68C8': '#2196F3'}. Ignored for PNG." },
      { name: "inline", type: "boolean", required: false, description: "Return the asset bytes in the result (default false)" },
    ],
    example: '{ "asset_url": "https://stories.freepiklabs.com/<asset>.svg", "inline": false }',
  },
  {
    name: "storyset_extract_palette",
    group: "storyset-native",
    description:
      "Return the dominant hex colors in an SVG, sorted by frequency. Use this to discover which color to feed into `recolor` / `storyset_download(recolor=...)`.",
    params: [
      { name: "source", type: "string", required: true, description: "SVG asset URL (stories.freepiklabs.com) or raw SVG markup" },
      { name: "top", type: "number (int, 1-64)", required: false, description: "Max colors to return (default 12)" },
    ],
    example: '{ "source": "https://stories.freepiklabs.com/<asset>.svg", "top": 12 }',
  },
  {
    name: "storyset_recolor_svg",
    group: "storyset-native",
    description:
      "Recolor an SVG and return per-color replacement counts, plus a regeneration `url` when the source is a URL and the deployment origin is configured. Use `storyset_extract_palette` first to see colors.",
    params: [
      { name: "source", type: "string", required: true, description: "SVG asset URL (stories.freepiklabs.com) or raw SVG markup" },
      { name: "mapping", type: "record<string, string>", required: true, description: "Color remap, e.g. {'#BA68C8': '#2196F3'}. Hex 3-digit or 6-digit, case insensitive." },
      { name: "inline", type: "boolean", required: false, description: "Return the recolored SVG inline (default false)" },
    ],
    example: '{ "source": "https://stories.freepiklabs.com/<asset>.svg", "mapping": { "#BA68C8": "#2196F3" } }',
  },
];
