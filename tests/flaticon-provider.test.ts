import { describe, test, expect } from "bun:test";
import { FlaticonProvider } from "../src/providers/flaticon.js";
import { createProviders } from "../src/providers/registry.js";
import { loadConfig } from "../src/config.js";

/** Records every call and delegates the response to the given handler. */
function fakeFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (input: unknown, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    return handler(url, init);
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const AUTH_URL = "https://api.flaticon.com/v3/app/authentication";

/**
 * The provider-seam contract for Flaticon on the unified root: identity,
 * availability from config alone, and search/getById mapping with
 * attribution preserved. (The previous root's MCP-level registration
 * tests are superseded by tests/server.test.ts.)
 */

const SEARCH_FIXTURE = {
  data: [
    {
      id: 42,
      description: "cat animal",
      tags: "cat,animal",
      team_name: "Pixel perfect",
      images: { "512": "https://cdn-icons-png.flaticon.com/512/0/42.png" },
    },
  ],
  metadata: { total: 1 },
};

describe("flaticonProvider — the unified seam", () => {
  test("identity: name, and availability follows the configured key", () => {
    expect(new FlaticonProvider({}).name).toBe("flaticon");
    expect(new FlaticonProvider({}).available).toBe(false);
    expect(new FlaticonProvider({ flaticonApiKey: "" }).available).toBe(false);
    expect(new FlaticonProvider({ flaticonApiKey: "any-value" }).available).toBe(true);
  });

  test("the registry lists flaticon, unavailable without a key and ready with one", () => {
    const without = createProviders(loadConfig({})).find((p) => p.name === "flaticon");
    expect(without).toBeDefined();
    expect(without!.available).toBe(false);
    const withKey = createProviders(loadConfig({ FLATICON_API_KEY: "k" })).find(
      (p) => p.name === "flaticon"
    );
    expect(withKey!.available).toBe(true);
  });

  test("unavailable search is an empty result, never an error", async () => {
    const provider = new FlaticonProvider({});
    const result = await provider.search({ query: "cat" });
    expect(result).toEqual({ assets: [], total: 0, provider: "flaticon", query: "cat" });
    expect(await provider.getById("flaticon:42")).toBeNull();
  });

  test("search maps icons to unified Assets with attribution preserved", async () => {
    const { impl } = fakeFetch((url) =>
      url === AUTH_URL
        ? jsonResponse({ data: { token: "t", expires: 9_999_999_999 } })
        : jsonResponse(SEARCH_FIXTURE),
    );
    const provider = new FlaticonProvider(
      { flaticonApiKey: "k" },
      { fetch: impl, cache: new Map() },
    );
    const result = await provider.search({ query: "cat" });
    expect(result.total).toBe(1);
    const asset = result.assets[0]!;
    expect(asset.id).toBe("flaticon:42");
    expect(asset.author).toBe("Pixel perfect");
    expect(asset.source).toBe("Flaticon");
    expect(asset.license).toBe("free-for-commercial");
    expect(asset.url).toBe("https://cdn-icons-png.flaticon.com/512/0/42.png");
  });

  test("getById resolves the download and keeps author + page URL", async () => {
    const { impl } = fakeFetch((url) => {
      if (url === AUTH_URL) return jsonResponse({ data: { token: "t", expires: 9_999_999_999 } });
      if (url.includes("/item/icon/download/")) {
        return jsonResponse({ data: { url: "https://download.flaticon.com/signed/42.svg" } });
      }
      return jsonResponse({
        data: {
          id: 42,
          description: "cat animal",
          author: { name: "Pixel perfect" },
          url: "https://www.flaticon.com/free-icon/cat_42",
          license: "Flaticon License",
        },
      });
    });
    const provider = new FlaticonProvider(
      { flaticonApiKey: "k" },
      { fetch: impl, cache: new Map() },
    );
    const asset = await provider.getById("flaticon:42");
    expect(asset).not.toBeNull();
    expect(asset!.downloadUrl).toBe("https://download.flaticon.com/signed/42.svg");
    expect(asset!.format).toBe("svg");
    expect(asset!.author).toBe("Pixel perfect");
    expect(asset!.sourceUrl).toBe("https://www.flaticon.com/free-icon/cat_42");
  });
});
