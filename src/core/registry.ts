/**
 * The provider registry: the single place that lists every provider module.
 * Adding a provider = one import + one entry here (see src/providers/README.md).
 */
import { providerEnabled, type DesignProvider, type ProviderEnv } from "./provider.js";
import type { AssetKind } from "./assets.js";
import { iconifyProvider } from "../providers/iconify/index.js";

export const PROVIDERS: DesignProvider[] = [iconifyProvider];

export interface ProviderSummary {
  id: string;
  displayName: string;
  description: string;
  kinds: AssetKind[];
  homepage?: string;
  enabled: boolean;
}

/** Every registered provider with its activation state under `env`. */
export function listProviderSummaries(env: ProviderEnv): ProviderSummary[] {
  return PROVIDERS.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    description: p.description,
    kinds: p.kinds,
    ...(p.homepage ? { homepage: p.homepage } : {}),
    enabled: providerEnabled(p, env),
  }));
}
