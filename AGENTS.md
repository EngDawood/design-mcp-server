# AGENTS.md — design-mcp-server

Working rules for every agent (human or AI) writing code in this repo.

## Matt Pocock skills are mandatory for code work

The owner directed (2026-11-04): the `mattpocock/skills` set is used for
ALL code work in this repo. Before starting a task, read the matching
skill and follow it:

- Designing a module or interface → `codebase-design` (deep modules,
  seam, interface, adapter, leverage, locality — use this vocabulary).
- Building or fixing → `tdd` (red → green, vertical slices, tests only at
  pre-agreed seams) driven by `implement` (typecheck often, single test
  files often, full suite once at the end, then a `code-review` pass).
- Writing the spec first → `to-spec`; splitting work → `to-tickets`.

The skills live in the owner's workspace at `~/workspace/custom-skills/<name>/SKILL.md`.

## Architecture rules

- `src/types.ts` is the seam: the unified `Asset` shape and the
  `Provider` interface (`name`, `available`, `search`, optional
  `getById`). Its shape is fixed: change it only with the project lead's
  approval, and never to fit one provider.
- The ONE sanctioned extension is `Provider.registerTools`: an escape
  hatch for a provider whose value does not fit search/getById
  (Storyset's palette/recolor tools). A new provider uses it only with
  the lead's approval — search/getById first.
- Everything specific to a source lives in `src/providers/<id>.ts`, with
  its deep logic in `src/providers/<id>-core.ts` when it has any. The
  core (`server.ts`, `worker.ts`, `tools/`, `utils/`) must stay
  source-agnostic: cross-provider tools dispatch through the seam, never
  through a source's internals.
- Adding a provider = one module in `src/providers/` + one entry in
  `src/providers/registry.ts` (+ its env key in `src/config.ts` when it
  needs one).
- A provider whose keys are missing reports `available = false` and
  returns empty results — never an error, never a crash. The server
  stays up.
- Tool results follow the tool's own convention (cross-provider tools
  return formatted text; `registerTools` tools return MCP text content
  with a JSON payload, failures as error results with
  `{ "error": string }`). Handlers never throw.

## Secrets

- NEVER commit a secret, token, or API key — not in code, docs, tests, or
  commit messages. Provider keys are Worker secrets (`wrangler secret
  put`), read only through `loadConfig(env)` in `src/config.ts`.

## Git

- `git push` does not work with the owner's automation credential (its
  egress is restricted to api.github.com). Push via the **Git Data API**:
  blobs → tree → commit → ref, using the helper
  `~/workspace/custom-connectors/custom.legacy-github-pat/bin/gh.py`
  (`from gh import _req`, run with
  `PYTHONPATH=/opt/muse/skills/custom-connector-setup/bin`). Verify the
  remote tree matches the local file list before reporting success.
- One provider per branch/PR. Commit messages: `feat(<provider>): …` /
  `feat: …` for core.

## Verification bar

Before any PR: `bun test` fully green and `bun run typecheck` clean.
Live-test a provider against its real source when its contract allows
(keyless providers always), and say plainly when a check was not run.
