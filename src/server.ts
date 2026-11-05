/**
 * MCP server factory (one instance per request — stateless HTTP transport).
 *
 * The core knows providers only through the Provider seam in src/types.ts:
 * it builds the provider list from the request env's config, registers the
 * cross-provider tools (asset-finder model: search_*, get_asset,
 * list_providers, suggest_asset), then calls each provider's optional
 * registerTools escape hatch (only Storyset uses it).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SERVER_NAME, VERSION } from "./constants.js";
import { loadConfig } from "./config.js";
import { createProviders } from "./providers/registry.js";
import type { Provider, ProviderEnv } from "./types.js";
import { registerSearchTools } from "./tools/search-tools.js";
import { registerSuggestTool } from "./tools/suggest-asset.js";
import { registerGetAssetTool } from "./tools/get-asset.js";
import { registerListProvidersTool } from "./tools/list-providers.js";

export function buildProviders(env: ProviderEnv): Provider[] {
  return createProviders(loadConfig(env));
}

export function createDesignServer(env: ProviderEnv): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: VERSION });
  const providers = buildProviders(env);

  registerSearchTools(server, providers);
  registerSuggestTool(server, providers);
  registerGetAssetTool(server, providers);
  registerListProvidersTool(server, providers);

  for (const provider of providers) {
    provider.registerTools?.(server, env);
  }

  return server;
}
