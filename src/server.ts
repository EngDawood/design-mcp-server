/**
 * MCP server factory (one instance per request — stateless HTTP transport).
 *
 * The core knows providers only through the DesignProvider seam: it
 * registers the core `list_providers` tool, then every provider whose
 * required env keys are present. Providers with missing keys are skipped
 * silently and reported as disabled by `list_providers`.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SERVER_NAME, VERSION } from "./constants.js";
import { PROVIDERS, listProviderSummaries } from "./core/registry.js";
import { providerEnabled, type ProviderEnv } from "./core/provider.js";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

export function createDesignServer(env: ProviderEnv): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: VERSION });

  server.registerTool(
    "list_providers",
    {
      description:
        "List every design-asset provider registered on this server, with the asset kinds it serves and whether it is enabled (a provider is disabled when its required API keys are not configured).",
      inputSchema: {},
    },
    async () => {
      try {
        return text(JSON.stringify({ providers: listProviderSummaries(env) }, null, 2));
      } catch (e) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  for (const provider of PROVIDERS) {
    if (providerEnabled(provider, env)) {
      provider.register(server, env);
    }
  }

  return server;
}
