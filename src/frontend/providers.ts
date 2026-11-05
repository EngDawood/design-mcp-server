/**
 * Providers page (/providers): live cards built from the registry for THIS
 * request's env. The Provider seam (src/types.ts) exposes exactly `name`,
 * `available`, optional `description` and optional `note` — the page shows
 * what the seam exposes and nothing more: providers that do not set a
 * description simply have no description line (the richer per-provider
 * blurbs live inside the list_providers tool, not on the seam).
 */
import { SERVER_NAME, VERSION } from "../constants.js";
import { buildProviders } from "../server.js";
import type { ProviderEnv } from "../types.js";
import { esc, layout } from "./layout.js";

export function providersPage(env: ProviderEnv): string {
  const providers = buildProviders(env);
  const ready = providers.filter((p) => p.available).length;

  const cards = providers
    .map((p) => {
      const badge = p.available
        ? '<span class="badge">Ready</span>'
        : '<span class="badge off">Not configured</span>';
      const description = p.description ? `<p>${esc(p.description)}</p>` : "";
      const note = p.note ? `<p class="muted">Note: ${esc(p.note)}</p>` : "";
      return `<article class="card"><h3><code>${esc(p.name)}</code> ${badge}</h3>${description}${note}</article>`;
    })
    .join("\n");

  const body = `
<h1>Providers</h1>
<p>${ready} of ${providers.length} providers are ready on this deployment.
A provider whose required Worker secret is missing reports
<em>Not configured</em> and returns empty results — it never takes the server
down. Configuration is per deployment: see <a href="/docs">Docs</a> for the
secret list.</p>
<div class="grid">
${cards}
</div>`;

  return layout({
    title: "Providers",
    page: "providers",
    serverName: SERVER_NAME,
    version: VERSION,
    body,
  });
}
