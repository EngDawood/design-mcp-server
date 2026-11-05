/**
 * Tools page (/tools): renders the grounded catalog in catalog.ts — the
 * cross-provider tools from src/tools/ plus Storyset's registerTools
 * native tools, each with its real parameters and a short example call.
 */
import { SERVER_NAME, VERSION } from "../constants.js";
import { TOOLS, type ToolDoc } from "./catalog.js";
import { esc, layout } from "./layout.js";

function toolSection(tool: ToolDoc): string {
  const params =
    tool.params.length === 0
      ? '<p class="muted">No parameters.</p>'
      : `<table><thead><tr><th>Parameter</th><th>Type</th><th></th><th>Description</th></tr></thead><tbody>${tool.params
          .map(
            (p) =>
              `<tr><td><code>${esc(p.name)}</code></td><td>${esc(p.type)}</td><td>${
                p.required ? "required" : "optional"
              }</td><td>${esc(p.description)}</td></tr>`,
          )
          .join("")}</tbody></table>`;
  const group =
    tool.group === "cross-provider" ? "Cross-provider" : "Storyset native";
  return `<section class="card"><h3><code>${esc(tool.name)}</code> <span class="badge">${group}</span></h3>
<p>${esc(tool.description)}</p>
${params}
<p class="muted">Example arguments:</p>
<pre>${esc(tool.example)}</pre></section>`;
}

export function toolsPage(): string {
  const cross = TOOLS.filter((t) => t.group === "cross-provider");
  const storyset = TOOLS.filter((t) => t.group === "storyset-native");
  const body = `
<h1>Tools</h1>
<p>${TOOLS.length} tools are registered on the MCP server: ${cross.length}
cross-provider tools that dispatch through the provider seam, plus
${storyset.length} Storyset native tools registered through the seam's
<code>registerTools</code> escape hatch. Call them over MCP at
<code>/mcp</code>, or try an Iconify search in the
<a href="/playground">Playground</a>.</p>
<h2>Cross-provider tools</h2>
<div class="grid">${cross.map(toolSection).join("\n")}</div>
<h2>Storyset native tools</h2>
<div class="grid">${storyset.map(toolSection).join("\n")}</div>`;

  return layout({
    title: "Tools",
    page: "tools",
    serverName: SERVER_NAME,
    version: VERSION,
    body,
  });
}
