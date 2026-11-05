/**
 * The frontend module: the five HTML pages behind ONE small interface.
 *
 *   handleFrontend(path, env, origin, accept) -> Response | null
 *
 * Depth by design: all page construction, the tool catalog, provider
 * rendering and content negotiation live behind this single function.
 * src/worker.ts calls it first and falls through on null, so the JSON
 * routes (/health, /api/providers), the MCP endpoint (/mcp) and the
 * worker's 404 keep their exact existing behavior — the frontend never
 * swallows a path it does not own.
 *
 * Content negotiation for "/": a client that asks for JSON
 * (Accept: application/json, without text/html) gets null here and the
 * worker serves its existing JSON info; browsers get the landing page.
 */
import type { ProviderEnv } from "../types.js";
import { docsPage } from "./docs.js";
import { landingPage } from "./landing.js";
import { htmlResponse } from "./layout.js";
import { playgroundPage } from "./playground.js";
import { providersPage } from "./providers.js";
import { toolsPage } from "./tools.js";

export function handleFrontend(
  path: string,
  env: ProviderEnv,
  origin: string,
  accept = "",
): Response | null {
  switch (path) {
    case "/": {
      const wantsJson =
        accept.includes("application/json") && !accept.includes("text/html");
      if (wantsJson) return null;
      return htmlResponse(landingPage(env, origin));
    }
    case "/providers":
      return htmlResponse(providersPage(env));
    case "/tools":
      return htmlResponse(toolsPage());
    case "/playground":
      return htmlResponse(playgroundPage());
    case "/docs":
      return htmlResponse(docsPage(origin));
    default:
      return null;
  }
}
