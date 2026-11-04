# design-mcp-server

A multi-provider **design-asset MCP server** on Cloudflare Workers. One MCP
endpoint serves icons, illustrations and (soon) more asset kinds from many
free sources, each hidden behind a single provider seam — adding a source
never touches the core.

Seeded from [better-icons](https://github.com/better-auth/better-icons)
(MIT), reworked from a single-source Iconify server into a provider
architecture by EngDawood.

## Architecture

```
src/
  worker.ts            HTTP entry: /, /health, /mcp (stateless Streamable HTTP), /api/providers
  server.ts            createDesignServer(env) — core tools + all enabled providers
  constants.ts         Server name + version (from package.json)
  core/
    provider.ts        THE SEAM: the DesignProvider interface + providerEnabled()
    assets.ts          The unified Asset shape every provider maps results onto
    registry.ts        PROVIDERS — the one list; one import + one entry per provider
  providers/
    README.md          The provider contract (read this before adding one)
    iconify/           First provider: Iconify (200+ icon libraries)
      index.ts         DesignProvider: tool registration
      core.ts          The Iconify API contract behind three functions
      icon-utils.ts    SVG building + alias resolution (from better-icons, MIT)
      types.ts         Iconify API payload types
tests/                 bun test — seams: icon-utils, provider cores, registry, MCP server
```

A **provider** is a deep module: an external source's whole contract (auth,
search, fetch, formats) behind the small `DesignProvider` interface. The
core knows only the interface. A provider whose required env keys are
missing is listed as *disabled* by `list_providers` — never an error.

## Providers

| Provider | Kinds | Tools | Keys |
|---|---|---|---|
| `iconify` | icon | `iconify_search_icons`, `iconify_get_icon`, `iconify_list_collections` | none |
| `storyset` | illustration | *(planned)* | none |
| `flaticon` | icon | *(planned)* | `FLATICON_API_KEY` |

Core tool: `list_providers` — every registered provider, its kinds, and
whether it is enabled under the current env.

Tool results are MCP text content carrying a JSON payload; failures are
error results carrying `{ "error": string }`.

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
wrangler secret put FLATICON_API_KEY
```

MCP client config once deployed:

```json
{ "mcpServers": { "design-mcp-server": { "url": "https://design-mcp-server.<account>.workers.dev/mcp" } } }
```

## Previews

Every pull request runs `.github/workflows/preview.yml`: install, `bun
test`, and typecheck — then a **non-production preview** of the Worker is
uploaded with `wrangler versions upload` and the workflow comments the
preview URL (`https://<version-id>-design-mcp-server.<subdomain>.workers.dev`)
on the PR, updating that same comment on every push. A version upload
never promotes to production; production changes only on merge + deploy.

The project lead smoke-tests each PR against its preview URL —
`GET /health` plus an MCP `tools/list` — before merge.

**Secrets gate:** previews deploy only once the owner adds
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub repo
secrets. Until then the deploy step skips gracefully with a notice in
the job summary (this is also what fork PRs always see) — tests and
typecheck still run and gate the PR either way.

## Adding a provider

Read `src/providers/README.md` — the contract — then implement
`DesignProvider` in `src/providers/<id>/` and add one entry to
`src/core/registry.ts`.

## License

MIT. The Iconify provider's `icon-utils.ts`, `types.ts` and core logic are
adapted from better-icons (MIT, better-auth contributors); attribution
headers are kept in those files.
