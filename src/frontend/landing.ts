/**
 * Landing page (/): hero, live status, the copyable MCP endpoint, live
 * provider/tool counts, install snippets, and links to the other pages.
 * Counts are computed per request from the real registry (buildProviders)
 * and the real tool catalog (TOOLS) — nothing is hardcoded.
 */
import { SERVER_NAME, VERSION } from "../constants.js";
import { buildProviders } from "../server.js";
import type { ProviderEnv } from "../types.js";
import { TOOLS } from "./catalog.js";
import { esc, layout } from "./layout.js";

const COPY_SCRIPT = `
document.getElementById("copy-endpoint").addEventListener("click", function () {
  var text = document.getElementById("mcp-endpoint").textContent;
  var note = document.getElementById("copy-note");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () {
      note.textContent = "Copied.";
    }, function () {
      note.textContent = "Copy failed — select the URL manually.";
    });
  }
});
`;

export function landingPage(env: ProviderEnv, origin: string): string {
  const providers = buildProviders(env);
  const ready = providers.filter((p) => p.available).length;
  const endpoint = `${origin}/mcp`;
  const configJson = JSON.stringify(
    { mcpServers: { [SERVER_NAME]: { url: endpoint } } },
    null,
    2,
  );
  const claudeJson = JSON.stringify(
    { mcpServers: { [SERVER_NAME]: { type: "http", url: endpoint } } },
    null,
    2,
  );

  const body = `
<h1>${esc(SERVER_NAME)}</h1>
<p>A multi-provider <strong>design-asset MCP server</strong> on Cloudflare Workers.
One MCP endpoint serves icons, illustrations, stock photos, logos and emoji from
ten sources, each hidden behind a single provider seam.</p>

<p><span class="badge">● Live</span> <span class="muted">version ${esc(VERSION)}</span></p>

<h2>MCP endpoint</h2>
<div class="endpoint">
  <code id="mcp-endpoint">${esc(endpoint)}</code>
  <button id="copy-endpoint" type="button">Copy</button>
  <span id="copy-note" class="muted" role="status"></span>
</div>
<p class="muted">Point any MCP client at this URL (Streamable HTTP, stateless).
Machine-readable service info is still available at <code>/</code> with
<code>Accept: application/json</code>, plus <code>/health</code> and
<code>/api/providers</code>.</p>

<h2>At a glance</h2>
<div class="grid">
  <div class="card"><strong>${providers.length} providers</strong><br>
    <span class="muted">${ready} ready on this deployment — the rest need a
    Worker secret (see <a href="/docs">Docs</a>).</span></div>
  <div class="card"><strong>${TOOLS.length} tools</strong><br>
    <span class="muted">Cross-provider search/get tools plus Storyset's native
    tools. Full catalog on <a href="/tools">Tools</a>.</span></div>
  <div class="card"><strong>Try it</strong><br>
    <span class="muted">Search Iconify live in the
    <a href="/playground">Playground</a> and copy a <code>get_asset</code> id.</span></div>
</div>

<h2>Connect a client</h2>
<h3>Generic MCP client</h3>
<pre>${esc(configJson)}</pre>
<h3>Claude Code</h3>
<pre>claude mcp add --transport http ${esc(SERVER_NAME)} ${esc(endpoint)}</pre>
<p class="muted">Or save the same JSON shape with a transport type in <code>.mcp.json</code>:</p>
<pre>${esc(claudeJson)}</pre>
<h3>Cursor</h3>
<p class="muted">Add to <code>.cursor/mcp.json</code>:</p>
<pre>${esc(configJson)}</pre>

<h2>Explore</h2>
<ul>
  <li><a href="/providers">Providers</a> — every registered source and its live status</li>
  <li><a href="/tools">Tools</a> — the full tool catalog with parameters and examples</li>
  <li><a href="/playground">Playground</a> — live Iconify search in your browser</li>
  <li><a href="/docs">Docs</a> — connect guide, secrets, architecture, adding a provider</li>
</ul>
<script>${COPY_SCRIPT}</script>`;

  return layout({
    title: "Design-asset MCP server",
    page: "landing",
    serverName: SERVER_NAME,
    version: VERSION,
    body,
  });
}
