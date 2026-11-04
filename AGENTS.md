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

- `src/core/provider.ts` is the seam. Its shape is fixed: change it only
  with the project lead's approval, and never to fit one provider.
- Everything specific to a source lives in `src/providers/<id>/`. The
  core (`server.ts`, `registry.ts`, `worker.ts`) must stay source-agnostic.
- The provider contract is `src/providers/README.md`. Read it before
  adding or changing a provider.
- Tool results: success = MCP text content with a JSON payload; failure =
  error result with `{ "error": string }`. Handlers never throw.

## Secrets

- NEVER commit a secret, token, or API key — not in code, docs, tests, or
  commit messages. Provider keys are Worker secrets (`wrangler secret
  put`) named in the provider's `requiresEnv`.
- A provider with missing keys disables itself; the server must stay up.

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
