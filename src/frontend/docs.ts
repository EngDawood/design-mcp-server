/**
 * Docs page (/docs): connect guide, the Worker-secret list (from
 * src/config.ts — the env names loadConfig actually reads), how to add a
 * provider (per AGENTS.md / README), a simple architecture overview, and
 * attribution links. Every fact here is transcribed from the repo; the
 * GitHub repo URL comes from package.json's repository field.
 */
import { SERVER_NAME, VERSION } from "../constants.js";
import { esc, layout } from "./layout.js";

const REPO_URL = "https://github.com/EngDawood/design-mcp-server";

const SECRETS: { env: string; provider: string }[] = [
  { env: "FLATICON_API_KEY", provider: "flaticon" },
  { env: "PEXELS_API_KEY", provider: "pexels" },
  { env: "UNSPLASH_ACCESS_KEY", provider: "unsplash" },
  { env: "PIXABAY_API_KEY", provider: "pixabay" },
  { env: "LOGO_DEV_TOKEN", provider: "logo-dev" },
];

export function docsPage(origin: string): string {
  const endpoint = `${origin}/mcp`;
  const configJson = JSON.stringify(
    { mcpServers: { [SERVER_NAME]: { url: endpoint } } },
    null,
    2,
  );
  const secretRows = SECRETS.map(
    (s) =>
      `<tr><td><code>${s.env}</code></td><td><code>${s.provider}</code></td></tr>`,
  ).join("");
  const secretCommands = SECRETS.map((s) => `wrangler secret put ${s.env}`).join("\n");

  const body = `
<h1>Docs</h1>

<h2>Connect a client</h2>
<p>The MCP endpoint is <code>${esc(endpoint)}</code> (Streamable HTTP,
stateless). Generic MCP client configuration:</p>
<pre>${esc(configJson)}</pre>
<p>Claude Code:</p>
<pre>claude mcp add --transport http ${esc(SERVER_NAME)} ${esc(endpoint)}</pre>
<p>Once connected, call <code>list_providers</code> to see which sources are
ready on the deployment, then search with <code>search_icons</code>,
<code>search_vectors</code>, <code>search_stock_photos</code>,
<code>search_emoji</code>, <code>search_logos</code> or
<code>suggest_asset</code>, and resolve any result with
<code>get_asset</code>. The full catalog is on the <a href="/tools">Tools</a>
page.</p>

<h2>Provider secrets</h2>
<p>Five providers need an API key; the other five (iconify, svgrepo,
openmoji, wikimedia, storyset) are keyless. Keys are Worker secrets, read
per request through <code>loadConfig(env)</code> in
<code>src/config.ts</code> — never committed. A missing key only marks its
provider <em>Not configured</em>; the server stays up.</p>
<table><thead><tr><th>Secret</th><th>Enables</th></tr></thead><tbody>${secretRows}</tbody></table>
<pre>${esc(secretCommands)}</pre>
<p class="muted">One optional plain variable (not a secret):
<code>PUBLIC_ORIGIN</code> — when set, Storyset recolor results link back to
a regeneration URL on this deployment.</p>

<h2>Architecture</h2>
<ul>
  <li><code>src/worker.ts</code> — HTTP entry: routes <code>/</code>,
  <code>/health</code>, <code>/mcp</code>, <code>/api/providers</code>, and
  delegates the HTML pages to <code>src/frontend/</code>.</li>
  <li><code>src/server.ts</code> — <code>createDesignServer(env)</code>:
  builds the providers, registers the cross-provider tools, then calls each
  provider's optional <code>registerTools</code> escape hatch.</li>
  <li><code>src/types.ts</code> — the seam: the unified <code>Asset</code>
  shape and the <code>Provider</code> interface (<code>name</code>,
  <code>available</code>, <code>search</code>, optional
  <code>getById</code>).</li>
  <li><code>src/providers/registry.ts</code> — the one list that assembles
  every provider, per request, from the request's config.</li>
  <li><code>src/tools/</code> — cross-provider tools that dispatch through
  the seam only; the core never reaches into a provider's internals.</li>
  <li><code>src/frontend/</code> — these pages: one small interface,
  <code>handleFrontend(path, env, origin, accept)</code>, returning a
  Response or null for non-frontend paths.</li>
</ul>

<h2>Adding a provider</h2>
<ol>
  <li>Implement <code>Provider</code> (<code>name</code>,
  <code>available</code>, <code>search</code>, optional <code>getById</code>)
  in <code>src/providers/&lt;name&gt;.ts</code>; put the source's contract in
  <code>src/providers/&lt;name&gt;-core.ts</code> when it is more than a thin
  call.</li>
  <li>Map results onto the unified <code>Asset</code> — ids namespaced as
  <code>&lt;name&gt;:&lt;native id&gt;</code>, license as the
  <code>LicenseType</code> enum, author preserved when the source provides
  one.</li>
  <li>Add one entry in <code>src/providers/registry.ts</code>; if the
  provider needs a key, read it in <code>src/config.ts</code> and let
  <code>available</code> follow it.</li>
  <li>Tests at the seams: the core's contract with a fake fetch, and the
  provider's availability/mapping. <code>bun test</code> green +
  <code>bun run typecheck</code> clean before any PR.</li>
</ol>

<h2>Attribution</h2>
<p>This codebase was built on upstream open-source work. The full list is in
the README's <a href="${REPO_URL}#acknowledgements">Acknowledgements</a>
section, with license texts in
<a href="${REPO_URL}/blob/main/THIRD_PARTY.md">THIRD_PARTY.md</a>.
Source code: <a href="${REPO_URL}">${esc(REPO_URL.replace("https://", ""))}</a>.</p>`;

  return layout({
    title: "Docs",
    page: "docs",
    serverName: SERVER_NAME,
    version: VERSION,
    body,
  });
}
