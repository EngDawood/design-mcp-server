# The Provider Contract

Read this before adding or changing a provider. It is the whole agreement
between a provider module and the core; everything else is the provider's
private business.

## Vocabulary (from the `codebase-design` skill — use these words)

A **provider** is a deep module: one external design-asset source's whole
contract — auth, endpoints, formats, quirks — behind the small
`DesignProvider` **interface** in `src/core/provider.ts`. That interface is
the **seam**. The provider module is the **adapter** at the seam; its
`core.ts` is the implementation the depth hides.

## Layout

```
src/providers/<id>/
  index.ts     The DesignProvider object: metadata + register(). Thin.
  core.ts      The source's contract as plain async functions. No MCP types.
  types.ts     Upstream payload types (when the source has structured payloads).
  …            Provider-private helpers stay in this folder. Nothing leaks out.
```

- `<id>` is lowercase, tool-safe (`/^[a-z][a-z0-9_]*$/`): it prefixes tools.
- Nothing outside the folder imports from inside it except `index.ts`
  (imported once, by the registry).

## The interface (fixed — do not change its shape)

```ts
interface DesignProvider {
  id: string;            // "iconify"
  displayName: string;   // "Iconify"
  description: string;   // one line, shown by list_providers
  kinds: AssetKind[];    // from src/core/assets.ts
  homepage?: string;
  requiresEnv?: string[];  // env keys that must ALL be set, else disabled
  register(server: McpServer, env: ProviderEnv): void;
}
```

## Rules

1. **Tool prefix.** Every tool name starts with `<id>_` (`iconify_get_icon`).
   No exceptions — this is what keeps 10 providers collision-free.
2. **Tool results.** Success = MCP text content carrying a **JSON payload**.
   Failure = an error result (`isError: true`) whose text is
   `{ "error": string }`. Handlers catch everything; they never throw.
3. **requiresEnv.** Keyless sources omit it. Keyed sources list every key
   they need (e.g. `["FLATICON_API_KEY"]`). Keys come from Worker secrets
   via `env` — never from code, never committed, never logged. When keys
   are absent the core skips `register()` entirely, so `core.ts` may
   assume its keys exist by the time a tool runs.
4. **Asset mapping.** Search-like tools also map results onto the unified
   `Asset` shape (`src/core/assets.ts`) and include them as `assets` in
   the payload, so future cross-provider tools see one vocabulary.
   Only fill fields the source actually provides.
5. **Core purity.** `core.ts` functions take plain options, call the
   source, validate the payload shape before trusting it, and throw
   `Error` with the source's name in the message on failure
   (`"Iconify search failed: 503 …"`). They return data, never MCP types.
6. **No shared state across requests.** The Worker is stateless; keep any
   cache in-module and per-isolate, and say so in a comment.

## Registry edit

Adding a provider to `src/core/registry.ts` is exactly **one import + one
entry**:

```ts
import { storysetProvider } from "../providers/storyset/index.js";
export const PROVIDERS: DesignProvider[] = [iconifyProvider, storysetProvider];
```

Nothing else in the core changes. If you think it must, stop — the seam is
wrong or the provider is leaking; raise it with the project lead instead.

## Tests (required)

`bun test`, at these seams only:

- `tests/<id>-core.test.ts` — the provider's core functions against a
  mocked `fetch` (fixture payloads in the source's real format; expected
  values from the fixture, never recomputed by the code under test).
  Cover: the happy path per function, one upstream failure, malformed
  input where the core validates.
- Registry/server tests already cover registration generically; a new
  provider appears in `list_providers` output automatically.
- Live verification against the real source when keyless (or when the key
  is available in the environment) — report what you actually ran.

## PR checklist

- [ ] Folder layout as above; `index.ts` is the only file imported from outside
- [ ] All tools prefixed `<id>_`; results follow rule 2
- [ ] `requiresEnv` declared (or keyless); no secret anywhere in the diff
- [ ] Search results mapped to `Asset` (rule 4)
- [ ] Core tests written and green; full `bun test` green; `bun run typecheck` clean
- [ ] One import + one entry in `registry.ts`; no other core changes
- [ ] README provider table updated (row: id, kinds, tools, keys)
- [ ] Built with the Matt Pocock skills (`tdd` + `implement`, `codebase-design` vocabulary)
- [ ] Preview received and smoke-tested: the preview workflow comments a non-production preview URL on the PR (once the owner has added the `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` repo secrets — until then the deploy step skips and only tests/typecheck gate the PR); the project lead checks `GET /health` + MCP `tools/list` against the preview URL before merge
