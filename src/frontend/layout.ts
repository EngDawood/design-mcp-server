/**
 * Shared page layout for the frontend module: one HTML shell, inline CSS,
 * no external fonts or assets (Workers-native, no build step).
 *
 * Every dynamic value interpolated into a page MUST pass through `esc` —
 * provider metadata and the deployment origin are request-derived strings.
 */

export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CSS = `
:root { color-scheme: light dark; --accent:#667eea; --muted:#6b7280; --card:#8881; }
* { box-sizing: border-box; }
body { margin:0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; line-height:1.55; }
header { border-bottom:1px solid var(--card); padding:.75rem 1rem; display:flex; flex-wrap:wrap; gap:1rem; align-items:baseline; }
header .brand { font-weight:700; text-decoration:none; color:inherit; }
nav { display:flex; gap:1rem; flex-wrap:wrap; }
nav a { color:var(--accent); text-decoration:none; }
nav a[aria-current="page"] { font-weight:700; text-decoration:underline; }
main { max-width:960px; margin:0 auto; padding:1.5rem 1rem 3rem; }
footer { border-top:1px solid var(--card); padding:1rem; color:var(--muted); font-size:.9rem; }
h1 { line-height:1.2; } h2 { margin-top:2rem; }
code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
pre { background:var(--card); padding:.75rem 1rem; border-radius:.5rem; overflow-x:auto; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:1rem; }
.card { border:1px solid var(--card); border-radius:.75rem; padding:1rem; }
.badge { display:inline-block; padding:.05rem .5rem; border-radius:999px; font-size:.8rem; border:1px solid var(--accent); }
.badge.off { border-color:var(--muted); color:var(--muted); }
.endpoint { display:flex; gap:.5rem; align-items:center; flex-wrap:wrap; }
button { cursor:pointer; padding:.4rem .9rem; border-radius:.5rem; border:1px solid var(--accent); background:transparent; color:inherit; }
input[type="search"], input[type="text"] { padding:.45rem .7rem; border-radius:.5rem; border:1px solid var(--muted); min-width:min(320px,80vw); }
table { border-collapse:collapse; } th, td { text-align:left; padding:.25rem .75rem .25rem 0; vertical-align:top; }
.muted { color:var(--muted); }
.icon-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(110px,1fr)); gap:.75rem; margin-top:1rem; }
.icon-card { display:flex; flex-direction:column; align-items:center; gap:.4rem; padding:.6rem; border:1px solid var(--card); border-radius:.5rem; background:transparent; color:inherit; }
.icon-card img { width:40px; height:40px; }
.icon-card span { font-size:.72rem; word-break:break-all; }
`;

const NAV: { path: string; label: string; page: string }[] = [
  { path: "/", label: "Home", page: "landing" },
  { path: "/providers", label: "Providers", page: "providers" },
  { path: "/tools", label: "Tools", page: "tools" },
  { path: "/playground", label: "Playground", page: "playground" },
  { path: "/docs", label: "Docs", page: "docs" },
];

export function layout(opts: {
  title: string;
  page: string;
  serverName: string;
  version: string;
  body: string;
}): string {
  const nav = NAV.map(
    (item) =>
      `<a href="${item.path}"${item.page === opts.page ? ' aria-current="page"' : ""}>${item.label}</a>`,
  ).join("");
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(opts.title)} · ${esc(opts.serverName)}</title>`,
    `<style>${CSS}</style>`,
    "</head>",
    "<body>",
    `<header><a class="brand" href="/">${esc(opts.serverName)}</a><nav>${nav}</nav></header>`,
    `<main data-page="${esc(opts.page)}">${opts.body}</main>`,
    `<footer>${esc(opts.serverName)} v${esc(opts.version)} · MCP endpoint: <code>/mcp</code> · JSON: <code>/health</code>, <code>/api/providers</code></footer>`,
    "</body>",
    "</html>",
  ].join("\n");
}

export function htmlResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
