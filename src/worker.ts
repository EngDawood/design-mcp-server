/**
 * design-mcp-server as a Cloudflare Worker: a remote MCP server over
 * Streamable HTTP, plus small REST endpoints for quick checks.
 *
 * Routes:
 *   GET  /                  Service info (JSON, incl. providers)
 *   GET  /health            Health check (JSON)
 *   ALL  /mcp               MCP Streamable HTTP endpoint (stateless)
 *   GET  /api/providers     Registered providers + enabled state (JSON)
 *
 * MCP client config:
 *   { "mcpServers": { "design-mcp-server": { "url": "https://design-mcp-server.<account>.workers.dev/mcp" } } }
 *
 * All providers live behind the seam in src/core/provider.ts; this file
 * only routes HTTP. Provider secrets come from Worker env (wrangler
 * secret put) — a provider whose keys are absent is disabled, never fatal.
 */
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { SERVER_NAME, VERSION } from "./constants.js";
import { createDesignServer } from "./server.js";
import { listProviderSummaries } from "./core/registry.js";
import type { ProviderEnv } from "./core/provider.js";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export default {
  async fetch(request: Request, env: ProviderEnv): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (path === "/" || path === "/health") {
      return json({
        ok: true,
        name: SERVER_NAME,
        version: VERSION,
        description:
          "Multi-provider design-asset MCP server: icons, illustrations and more behind one provider seam.",
        mcp_endpoint: `${url.origin}/mcp`,
        providers: listProviderSummaries(env),
        rest: {
          providers: `${url.origin}/api/providers`,
        },
      });
    }

    if (path === "/mcp") {
      const server = createDesignServer(env);
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
        enableJsonResponse: true,
      });
      await server.connect(transport);
      const response = await transport.handleRequest(request);
      return withCors(response);
    }

    if (path === "/api/providers") {
      return json({ providers: listProviderSummaries(env) });
    }

    return json({ error: "Not found", routes: ["/", "/health", "/mcp", "/api/providers"] }, 404);
  },
};
