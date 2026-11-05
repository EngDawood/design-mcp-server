# Third-party attributions

This codebase was built based on / derived from the upstream repositories
below. Their licenses are reproduced or summarized here as required.

## asset-finder-mcp — architectural base (MIT)

- Repo: https://github.com/Erfangit23/asset-finder-mcp
- License: MIT (full text below)
- What came from it: the unified `Asset` / `SearchParams` / `Provider`
  seam (`src/types.ts`), the LRU cache, license/format/color filters and
  AI-formatting utilities (`src/utils/`), the cross-provider tool model
  (`src/tools/`: search_*, get_asset, list_providers, suggest_asset), and
  the Iconify, SVG Repo, OpenMoji, Logo.dev, Pexels, Unsplash and Pixabay
  providers (`src/providers/`).

```
MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## better-icons — original Iconify Worker code (MIT)

- Repo: https://github.com/better-auth/better-icons
- License: MIT
- What came from it: the previous root of this project was seeded from
  better-icons' Cloudflare Worker MCP server (Streamable HTTP transport,
  Iconify search/get tooling, SVG building). The Worker transport pattern
  in `src/worker.ts` descends from that codebase.

## MCP-STORYSET — Storyset logic (owner's own project)

- Repo: https://github.com/EngDawood/MCP-STORYSET
- What came from it: the Storyset core (`src/providers/storyset-core.ts`)
  — storyset.com search-page parsing, illustration asset resolution,
  palette extraction and SVG recoloring — ported from that server's
  worker/lib.ts, plus its native tool set, now registered through the
  Provider seam's `registerTools` escape hatch in
  `src/providers/storyset.ts`.

## The previous design-mcp-server root (owner's own code)

The Wikimedia Commons provider core (`src/providers/wikimedia-core.ts`)
and the Flaticon provider core (`src/providers/flaticon-core.ts` — API v3
auth, token cache, download resolution) were written for this project's
previous root and ported onto the unified seam during the migration.
