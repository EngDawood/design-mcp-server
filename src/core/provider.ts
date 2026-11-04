/**
 * The provider seam of design-mcp-server.
 *
 * A provider is a deep module: a lot of behaviour (an external design-asset
 * source's whole contract — auth, search, fetch, formats) behind this small
 * interface. The core server knows only this interface; everything specific
 * to a source lives inside `src/providers/<id>/`.
 *
 * To add a provider, implement this interface in
 * `src/providers/<id>/index.ts` and add one entry to `src/core/registry.ts`.
 * The full contract is in `src/providers/README.md`.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AssetKind } from "./assets.js";

/** Environment as the core sees it: string vars/secrets by name. */
export type ProviderEnv = Record<string, string | undefined>;

export interface DesignProvider {
  /** Stable lowercase id. Prefix of every tool name the provider registers. */
  id: string;
  /** Human-readable source name, e.g. "Iconify". */
  displayName: string;
  /** One line: what this provider serves. Shown by `list_providers`. */
  description: string;
  /** Asset kinds this provider can serve. */
  kinds: AssetKind[];
  /** Home page of the upstream source. */
  homepage?: string;
  /**
   * Env keys that must all be set for the provider to activate
   * (e.g. ["FLATICON_API_KEY"]). Omit for keyless providers.
   * A provider whose keys are missing is listed as disabled, never an error.
   */
  requiresEnv?: string[];
  /** Register this provider's tools on the server. Called once per server. */
  register(server: McpServer, env: ProviderEnv): void;
}

/** True when every env key the provider requires is present and non-empty. */
export function providerEnabled(provider: DesignProvider, env: ProviderEnv): boolean {
  return (provider.requiresEnv ?? []).every((key) => {
    const value = env[key];
    return typeof value === "string" && value.length > 0;
  });
}
