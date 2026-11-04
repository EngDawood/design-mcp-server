# design-mcp-server

A multi-provider **design-asset MCP server** on Cloudflare Workers. One MCP
endpoint serves icons, illustrations, stock photos, logos and emoji from
ten sources, each hidden behind a single provider seam — adding a source
never touches the core.

The architecture is asset-finder-mcp's (MIT): one unified `Asset` shape and
a two-method `Provider` seam (`search` / `getById`), with cross-provider
tools on top. What stayed ours is the deployment shape — a stateless
Cloudflare Worker over Streamable HTTP, env-per-request configuration, PR
preview deployments — and three providers (Wikimedia Commons, Flaticon,
Storyset) ported from this project's previous root. See
[THIRD_PARTY.md](THIRD_PARTY.md) for attribution and the
Acknowledgements at the end of this file.

## Architecture

```
src/
  worker.ts              HTTP entry: /, /health, /mcp (stateless Streamable HTTP), /api/providers
  server.ts              createDesignServer(env) — cross-provider tools + provider escape hatches
  config.ts              loadConfig(env) — provider keys from the Worker env, per request
  constants.ts           Server name + version (from package.json)
  types.ts               THE SEAM: unified Asset, SearchParams, Provider interface
  utils/
    cache.ts             LRU cache (from asset-finder-mcp)
    license-filter.ts    License / format / color filters
    normalize.ts         AI-friendly result formatting
  tools/                 Cross-provider tools (from asset-finder-mcp, adapted)
    search-tools.ts      search_icons, search_logos, search_stock_photos, search_vectors, search_emoji
    suggest-asset.ts     suggest_asset — natural-language search across providers
    get-asset.ts         get_asset — resolve "<provider>:<id>" to full details
    list-providers.ts    list_providers — every provider + availability + notes
  providers/
    registry.ts          createProviders(config) — the one list; one entry per provider
    iconify.ts           Iconify (from asset-finder-mcp)
    svgrepo.ts           SVG Repo (from asset-finder-mcp) — EXPERIMENTAL, see below
    openmoji.ts          OpenMoji (from asset-finder-mcp)
    wikimedia.ts         Wikimedia Commons adapter → wikimedia-core.ts (MediaWiki API)
    flaticon.ts          Flaticon adapter → flaticon-core.ts (API v3 auth + downloads)
    storyset.ts          Storyset adapter → storyset-core.ts (scraping + SVG helpers)
    pexels.ts            Pexels (from asset-finder-mcp)
    unsplash.ts          Unsplash (from asset-finder-mcp)
    pixabay.ts           Pixabay (from asset-finder-mcp)
    logo-dev.ts          Logo.dev (from asset-finder-mcp)
tests/                   bun test — seams: utils, provider cores, registry, MCP server
```

A **provider** is a deep module: an external source's whole contract
(auth, search, fetch, formats) behind the small `Provider` interface in
`src/types.ts`. Asset ids are namespaced (`iconify:mdi:home`,
`wikimedia:File:Arrow.svg`, `flaticon:2589192`), so `get_asset` can route
any id back to its provider. A provider whose required env keys are
missing reports itself *not configured* in `list_providers` and returns
empty results — never an error.

**The escape hatch.** One extension exists on the seam:
`Provider.registerTools?(server, env)`, for providers whose value does
not fit search/getById. Exactly one provider uses it — Storyset, whose
palette extraction and SVG recoloring are tools, not searches. Everything
else lives on the two-method seam.

## Providers

| Provider | Assets | Keys | Notes |
|---|---|---|---|
| `iconify` | icons | — | 200+ open icon libraries via the Iconify API |
| `svgrepo` | vectors, illustrations | — | **Experimental**: SVG Repo has no official API; this uses its undocumented endpoint (see below) |
| `openmoji` | emoji | — | CC BY-SA 4.0 emoji set |
| `wikimedia` | icons, illustrations | — | Open-licensed SVGs from Wikimedia Commons, official MediaWiki API |
| `storyset` | illustrations | — | storyset.com illustrations + native `storyset_*` tools |
| `flaticon` | icons | `FLATICON_API_KEY` | Flaticon API v3; attribution required, author kept on every asset |
| `pexels` | stock photos | `PEXELS_API_KEY` | |
| `unsplash` | stock photos | `UNSPLASH_ACCESS_KEY` | |
| `pixabay` | photos, vectors, illustrations | `PIXABAY_API_KEY` | |
| `logo-dev` | logos | `LOGO_DEV_TOKEN` | Brand logos by domain |

**SVG Repo is experimental.** Our own research found no official SVG
Repo API: no developer documentation, the site behind a Vercel
checkpoint, and its `/api/v1/search` endpoint undocumented (a live check
during this migration returned HTTP 429). The provider is carried over
from upstream because it works when the endpoint cooperates, and
`list_providers` flags it verbatim. Wikimedia Commons is the stable
keyless SVG source on this server.

## Tools

Cross-provider: `search_icons` (Iconify + Flaticon), `search_vectors`
(Wikimedia Commons + SVG Repo), `search_emoji`, `search_logos`,
`search_stock_photos`, `suggest_asset`, `get_asset`, `list_providers`.

Storyset native (via the escape hatch): `storyset_search`,
`storyset_get_illustration`, `storyset_download`,
`storyset_extract_palette`, `storyset_recolor_svg`.

Tool results follow each tool's convention: cross-provider tools return
AI-formatted text; Storyset's tools return JSON payloads, with failures
as error results carrying `{ "error": string }`.

## Develop

Requires Node ≥ 20 (`.nvmrc` pins 22; Wrangler 4 needs it) and Bun.

```bash
bun install
bun test              # full suite
bun run typecheck     # tsc --noEmit
bun run dev           # wrangler dev (local Worker)
```

## Deploy

```bash
bun run deploy        # wrangler deploy → Worker named "design-mcp-server"
```

Provider secrets are set per provider, never committed:

```bash
wrangler secret put FLATICON_API_KEY   # and/or PEXELS_API_KEY,
                                       # UNSPLASH_ACCESS_KEY, PIXABAY_API_KEY,
                                       # LOGO_DEV_TOKEN
```

MCP client config once deployed:

```json
{ "mcpServers": { "design-mcp-server": { "url": "https://design-mcp-server.<account>.workers.dev/mcp" } } }
```

## Previews

Every pull request runs `.github/workflows/preview.yml`: install, `bun
test`, and typecheck — then a **non-production preview** of the Worker is
uploaded with `wrangler versions upload` and the workflow comments the
preview URL on the PR, updating that same comment on every push. A
version upload never promotes to production; production changes only on
merge + deploy. Previews deploy only once the owner adds
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub repo
secrets; until then the deploy step skips gracefully and tests still
gate the PR.

## Adding a provider

1. Implement `Provider` (`name`, `available`, `search`, optional
   `getById`) in `src/providers/<name>.ts`; put the source's contract in
   `src/providers/<name>-core.ts` when it is more than a thin call.
2. Map results onto the unified `Asset` — ids namespaced as
   `<name>:<native id>`, license as the `LicenseType` enum (map the
   source's label; don't invent precision), author preserved when the
   source provides one.
3. Add one entry in `src/providers/registry.ts`; if the provider needs
   a key, read it in `src/config.ts` and let `available` follow it.
4. Tests at the seams: the core's contract with a fake fetch, and the
   provider's availability/mapping. `bun test` green + typecheck clean.

## What changed in the migration (0.2.0)

The previous root had its own unified shape (`src/core/assets.ts`) and a
registration-style seam (each provider registered its own tools). The
asset-finder shape won; the mapping for anyone diffing old payloads:

| Previous root | This root |
|---|---|
| `kind: "icon" \| "illustration" \| …` | `type: "icon" \| "illustration" \| …` (plus `vector`, `emoji`, `stock-photo`) |
| `license: string` (free text, e.g. `"LGPL"`) | `license: LicenseType` enum (`"lgpl"` → `"free-for-commercial"`); raw labels do not survive |
| `provider: "wikimedia"` + bare native `id` | `source: "Wikimedia Commons"` + namespaced `id` (`"wikimedia:File:…"`) |
| `assetUrl` / `pageUrl` | `url` / `downloadUrl` / `sourceUrl` |
| Per-provider tools only (`iconify_search_icons`, …) | Cross-provider tools (`search_icons`, `get_asset`, …); per-provider tools survive only via the escape hatch (Storyset) |

## Acknowledgements

This codebase was built based on / derived from the following upstream
repositories:

- **Erfangit23/asset-finder-mcp** (MIT) — the architectural base of this
  root: the unified Asset model, the Provider seam, the utility modules,
  the cross-provider tools, and seven of the ten providers.
- **better-auth/better-icons** (MIT) — the original Iconify Worker code
  this project was first seeded from; its Cloudflare Worker MCP pattern
  (Streamable HTTP transport, Iconify tooling) underlies `src/worker.ts`.
- **EngDawood/MCP-STORYSET** — the source of the Storyset logic
  (storyset.com parsing, palette extraction, SVG recoloring) ported into
  `src/providers/storyset-core.ts`.

And it stands on these data sources, whose content remains under their
own licenses and terms: the **Iconify API**, the **Flaticon API**,
**Storyset**, and **Wikimedia Commons** — alongside OpenMoji, SVG Repo,
Pexels, Unsplash, Pixabay and Logo.dev. Full attribution details are in
[THIRD_PARTY.md](THIRD_PARTY.md).
