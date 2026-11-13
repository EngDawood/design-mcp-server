import { test, expect, describe } from "bun:test";
import { handleFrontend } from "../src/frontend/index.js";
import worker from "../src/worker.js";

const ORIGIN = "https://design-mcp-server.example.workers.dev";
const BROWSER_ACCEPT = "text/html,application/xhtml+xml";

describe("handleFrontend routing", () => {
  test("returns null for /mcp so worker MCP routing is never swallowed", () => {
    expect(handleFrontend("/mcp", {}, ORIGIN, BROWSER_ACCEPT)).toBeNull();
  });

  test("returns null for /health and /api/providers (JSON routes)", () => {
    expect(handleFrontend("/health", {}, ORIGIN, BROWSER_ACCEPT)).toBeNull();
    expect(handleFrontend("/api/providers", {}, ORIGIN, BROWSER_ACCEPT)).toBeNull();
  });

  test("returns null for an unknown path so the worker 404 stands", () => {
    expect(handleFrontend("/no-such-page", {}, ORIGIN, BROWSER_ACCEPT)).toBeNull();
  });

  test("returns null for / when the client asks for JSON (content negotiation)", () => {
    expect(handleFrontend("/", {}, ORIGIN, "application/json")).toBeNull();
  });
});

describe("landing page", () => {
  test("GET / as a browser returns 200 HTML with the landing marker", async () => {
    const res = handleFrontend("/", {}, ORIGIN, BROWSER_ACCEPT);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    expect(res!.headers.get("Content-Type")).toContain("text/html");
    const html = await res!.text();
    expect(html).toContain('data-page="landing"');
    expect(html).toContain(`${ORIGIN}/mcp`);
    expect(html).toContain("design-mcp-server");
  });

  test("landing shows live provider counts computed from the registry", async () => {
    const res = handleFrontend("/", {}, ORIGIN, BROWSER_ACCEPT);
    const html = await res!.text();
    // Empty env: 10 registered providers, 5 keyless ones ready.
    expect(html).toContain("10 providers");
    expect(html).toContain("5 ready");
  });
});

describe("worker routing for /", () => {
  test("/ with Accept: application/json still returns the JSON info", async () => {
    const res = await worker.fetch(
      new Request(`${ORIGIN}/`, { headers: { Accept: "application/json" } }),
      {},
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    const body = (await res.json()) as { mcp_endpoint?: string };
    expect(body.mcp_endpoint).toBe(`${ORIGIN}/mcp`);
  });

  test("/ with a browser Accept returns HTML", async () => {
    const res = await worker.fetch(
      new Request(`${ORIGIN}/`, { headers: { Accept: BROWSER_ACCEPT } }),
      {},
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(await res.text()).toContain('data-page="landing"');
  });

  test("/health still returns JSON", async () => {
    const res = await worker.fetch(new Request(`${ORIGIN}/health`), {});
    expect(res.headers.get("Content-Type")).toContain("application/json");
    const body = (await res.json()) as { ok?: boolean };
    expect(body.ok).toBe(true);
  });
});

describe("providers page", () => {
  test("GET /providers returns 200 HTML listing every registered provider", async () => {
    const res = handleFrontend("/providers", {}, ORIGIN, BROWSER_ACCEPT);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    expect(res!.headers.get("Content-Type")).toContain("text/html");
    const html = await res!.text();
    expect(html).toContain('data-page="providers"');
    for (const name of [
      "iconify", "svgrepo", "openmoji", "wikimedia", "storyset",
      "flaticon", "pexels", "unsplash", "pixabay", "logo-dev",
    ]) {
      expect(html).toContain(name);
    }
  });

  test("availability follows env: flaticon is Not configured without a key, Ready with one", async () => {
    const noKey = await handleFrontend("/providers", {}, ORIGIN, BROWSER_ACCEPT)!.text();
    expect(noKey).toContain("Not configured");
    const withKey = await handleFrontend(
      "/providers",
      { FLATICON_API_KEY: "test-key" },
      ORIGIN,
      BROWSER_ACCEPT,
    )!.text();
    // With the key set, one more provider is ready than without it.
    expect(withKey).toContain("6 of 10 providers are ready");
    expect(noKey).toContain("5 of 10 providers are ready");
  });

  test("seam metadata shows: svgrepo carries its experimental note", async () => {
    const html = await handleFrontend("/providers", {}, ORIGIN, BROWSER_ACCEPT)!.text();
    expect(html).toContain("Experimental: SVG Repo exposes no official API");
  });
});

describe("tools page", () => {
  test("GET /tools returns 200 HTML with the tools marker and every tool name", async () => {
    const res = handleFrontend("/tools", {}, ORIGIN, BROWSER_ACCEPT);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    expect(res!.headers.get("Content-Type")).toContain("text/html");
    const html = await res!.text();
    expect(html).toContain('data-page="tools"');
    for (const name of [
      "search_icons", "search_vectors", "search_stock_photos", "search_emoji",
      "search_logos", "suggest_asset", "get_asset", "list_providers",
      "storyset_search", "storyset_get_illustration", "storyset_download",
      "storyset_extract_palette", "storyset_recolor_svg",
    ]) {
      expect(html).toContain(name);
    }
    // Real parameters from the zod schemas are shown.
    expect(html).toContain("preferred_type");
    expect(html).toContain("asset_url");
  });
});

describe("playground page", () => {
  test("GET /playground returns 200 HTML wired to the public Iconify search endpoint", async () => {
    const res = handleFrontend("/playground", {}, ORIGIN, BROWSER_ACCEPT);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    expect(res!.headers.get("Content-Type")).toContain("text/html");
    const html = await res!.text();
    expect(html).toContain('data-page="playground"');
    expect(html).toContain("https://api.iconify.design/search?query=");
    expect(html).toContain("encodeURIComponent");
    // The copied id uses the real get_asset format: iconify:<prefix>:<name>.
    expect(html).toContain('"iconify:" + icon');
    expect(html).toContain("iconify:mdi:home");
    // No innerHTML injection of results or the query.
    expect(html).not.toContain("innerHTML");
  });
});

describe("docs page", () => {
  test("GET /docs returns 200 HTML with the secret list from src/config.ts", async () => {
    const res = handleFrontend("/docs", {}, ORIGIN, BROWSER_ACCEPT);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    expect(res!.headers.get("Content-Type")).toContain("text/html");
    const html = await res!.text();
    expect(html).toContain('data-page="docs"');
    for (const envName of [
      "FLATICON_API_KEY", "PEXELS_API_KEY", "UNSPLASH_ACCESS_KEY",
      "PIXABAY_API_KEY", "LOGO_DEV_TOKEN",
    ]) {
      expect(html).toContain(`wrangler secret put ${envName}`);
    }
    expect(html).toContain(`${ORIGIN}/mcp`);
    expect(html).toContain("Acknowledgements");
    expect(html).toContain("THIRD_PARTY.md");
  });
});

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createDesignServer } from "../src/server.js";
import { TOOLS } from "../src/frontend/catalog.js";

describe("tool catalog grounding", () => {
  test("catalog names match the live MCP server's tool list exactly", async () => {
    const server = createDesignServer({});
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: "frontend-test", version: "0.0.0" });
    await client.connect(clientTransport);
    const { tools } = await client.listTools();
    const liveNames = tools.map((t) => t.name).sort();
    const catalogNames = TOOLS.map((t) => t.name).sort();
    expect(catalogNames).toEqual(liveNames);
    await client.close();
  });
});
