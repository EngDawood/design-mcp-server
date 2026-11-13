/**
 * The provider registry: the single place that assembles every provider.
 * Adding a provider = construct it here (see README "Adding a provider").
 *
 * Providers are constructed per request from the request's config, because
 * on Workers availability depends on that request's env — there is no
 * process-global config like the stdio original had.
 */
import type { Provider, ProviderConfig } from "../types.js";
import { IconifyProvider } from "./iconify.js";
import { SVGRepoProvider } from "./svgrepo.js";
import { OpenMojiProvider } from "./openmoji.js";
import { WikimediaProvider } from "./wikimedia.js";
import { StorysetProvider } from "./storyset.js";
import { FlaticonProvider } from "./flaticon.js";
import { FlaticonWebProvider } from "./flaticon-web.js";
import { PexelsProvider } from "./pexels.js";
import { UnsplashProvider } from "./unsplash.js";
import { PixabayProvider } from "./pixabay.js";
import { LogoDevProvider } from "./logo-dev.js";

export function createProviders(config: ProviderConfig): Provider[] {
  return [
    new IconifyProvider(),
    new SVGRepoProvider(),
    new OpenMojiProvider(),
    new WikimediaProvider(),
    new StorysetProvider(),
    new FlaticonProvider(config),
    new FlaticonWebProvider(),
    new PexelsProvider(config),
    new UnsplashProvider(config),
    new PixabayProvider(config),
    new LogoDevProvider(config),
  ];
}
