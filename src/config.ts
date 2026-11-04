/**
 * Provider configuration, built from the Worker env on every request.
 *
 * Adapted from asset-finder-mcp's config.ts (MIT, Erfangit23), which read
 * process.env once at stdio startup. On Workers there is no process env at
 * module scope: env arrives per request, so loadConfig takes it as an
 * argument (dependencies are accepted, not created).
 */
import type { ProviderConfig, ProviderEnv } from "./types.js";

/**
 * Loads provider configuration from environment variables.
 * All API keys are optional — the server works with free/no-key providers.
 */
export function loadConfig(env: ProviderEnv): ProviderConfig {
  return {
    pexelsApiKey: env.PEXELS_API_KEY,
    unsplashApiKey: env.UNSPLASH_ACCESS_KEY,
    pixabayApiKey: env.PIXABAY_API_KEY,
    logoDevToken: env.LOGO_DEV_TOKEN,
    flaticonApiKey: env.FLATICON_API_KEY,
  };
}

/**
 * Checks which providers are available based on config.
 */
export function getAvailableProviders(config: ProviderConfig): string[] {
  const available: string[] = ["iconify", "svgrepo", "openmoji", "wikimedia", "storyset"];
  if (config.flaticonApiKey) available.push("flaticon");
  if (config.pexelsApiKey) available.push("pexels");
  if (config.unsplashApiKey) available.push("unsplash");
  if (config.pixabayApiKey) available.push("pixabay");
  if (config.logoDevToken) available.push("logo-dev");
  return available;
}
