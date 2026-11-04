import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { searchIconsCore, getIconCore, listCollectionsCore } from "../src/providers/iconify/core.js";

const originalFetch = globalThis.fetch;
let fetchCalls: string[] = [];
let fetchHandler: (url: string) => Response;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  fetchCalls = [];
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input);
    fetchCalls.push(url);
    return fetchHandler(url);
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("searchIconsCore", () => {
  test("maps query params and parses the Iconify search payload", async () => {
    fetchHandler = () =>
      jsonResponse({
        icons: ["lucide:home", "mdi:home"],
        total: 2,
        limit: 5,
        start: 0,
        collections: { lucide: 1, mdi: 1 },
      });

    const result = await searchIconsCore({ query: "home", limit: 5, prefix: "lucide" });

    expect(result.total).toBe(2);
    expect(result.icons).toEqual(["lucide:home", "mdi:home"]);
    expect(fetchCalls).toHaveLength(1);
    const url = new URL(fetchCalls[0]!);
    expect(url.origin + url.pathname).toBe("https://api.iconify.design/search");
    expect(url.searchParams.get("query")).toBe("home");
    expect(url.searchParams.get("limit")).toBe("5");
    expect(url.searchParams.get("prefix")).toBe("lucide");
  });

  test("defaults limit to 32 and omits optional params", async () => {
    fetchHandler = () => jsonResponse({ icons: [], total: 0, limit: 32, start: 0, collections: {} });

    await searchIconsCore({ query: "arrow" });

    const url = new URL(fetchCalls[0]!);
    expect(url.searchParams.get("limit")).toBe("32");
    expect(url.searchParams.has("prefix")).toBe(false);
    expect(url.searchParams.has("category")).toBe(false);
  });

  test("throws on a non-OK Iconify response", async () => {
    fetchHandler = () => new Response("nope", { status: 503, statusText: "Service Unavailable" });
    await expect(searchIconsCore({ query: "home" })).rejects.toThrow("Iconify search failed: 503");
  });

  test("throws on a malformed search payload", async () => {
    fetchHandler = () => jsonResponse({ unexpected: true });
    await expect(searchIconsCore({ query: "home" })).rejects.toThrow("Iconify returned an invalid API response format");
  });
});

// Fixture icon set, in the Iconify JSON format (independent of the code under test).
const LUCIDE_SET = {
  prefix: "lucide",
  width: 24,
  height: 24,
  icons: {
    home: { body: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' },
    house: { body: '<rect x="3" y="3" width="18" height="18"/>' },
  },
  aliases: { "home-alt": { parent: "home" } },
};

describe("getIconCore", () => {
  test("builds an SVG from a fixture icon set", async () => {
    fetchHandler = () => jsonResponse(LUCIDE_SET);

    const { svg, width, height } = await getIconCore({ icon_id: "lucide:home" });

    expect(fetchCalls[0]).toContain("https://api.iconify.design/lucide.json?icons=home");
    expect(width).toBe(24);
    expect(height).toBe(24);
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain('d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"');
  });

  test("resolves aliases before building the SVG", async () => {
    fetchHandler = () => jsonResponse(LUCIDE_SET);

    const { svg } = await getIconCore({ icon_id: "lucide:home-alt" });

    expect(svg).toContain('d="m3 9 9-7');
  });

  test("applies size and color options", async () => {
    fetchHandler = () => jsonResponse(LUCIDE_SET);

    const { svg } = await getIconCore({ icon_id: "lucide:house", size: 48, color: "#ff0000" });

    expect(svg).toContain('width="48" height="48"');
    expect(svg).toContain('fill="#ff0000"');
  });

  test("throws on an id without prefix:name format", async () => {
    fetchHandler = () => jsonResponse(LUCIDE_SET);
    await expect(getIconCore({ icon_id: "home" })).rejects.toThrow("Invalid icon ID");
    expect(fetchCalls).toHaveLength(0);
  });

  test("throws when the icon is not in the set", async () => {
    fetchHandler = () => jsonResponse(LUCIDE_SET);
    await expect(getIconCore({ icon_id: "lucide:missing" })).rejects.toThrow("not found");
  });

  test("throws on a non-OK Iconify response", async () => {
    fetchHandler = () => new Response("nope", { status: 404, statusText: "Not Found" });
    await expect(getIconCore({ icon_id: "lucide:home" })).rejects.toThrow("Iconify fetch failed: 404");
  });

  test("throws on a malformed icon-set payload", async () => {
    fetchHandler = () => jsonResponse("just a string");
    await expect(getIconCore({ icon_id: "lucide:home" })).rejects.toThrow("Iconify returned an invalid API response format");
  });
});

const COLLECTIONS_FIXTURE = {
  lucide: { name: "Lucide", total: 1600, category: "General" },
  mdi: { name: "Material Design Icons", total: 7400, category: "General" },
  "simple-icons": { name: "Simple Icons", total: 3300, category: "Brands" },
};

describe("listCollectionsCore", () => {
  test("returns collections sorted by icon count, descending", async () => {
    fetchHandler = () => jsonResponse(COLLECTIONS_FIXTURE);

    const { total, collections } = await listCollectionsCore({});

    expect(total).toBe(3);
    expect(collections.map((c) => c.prefix)).toEqual(["mdi", "simple-icons", "lucide"]);
    expect(collections[0]).toEqual({ prefix: "mdi", name: "Material Design Icons", total: 7400, category: "General" });
  });

  test("filters by search text against prefix and name", async () => {
    fetchHandler = () => jsonResponse(COLLECTIONS_FIXTURE);

    const { total, collections } = await listCollectionsCore({ search: "material" });

    expect(total).toBe(1);
    expect(collections[0]?.prefix).toBe("mdi");
  });

  test("filters by category", async () => {
    fetchHandler = () => jsonResponse(COLLECTIONS_FIXTURE);

    const { total, collections } = await listCollectionsCore({ category: "brands" });

    expect(total).toBe(1);
    expect(collections[0]?.prefix).toBe("simple-icons");
  });

  test("throws on a non-OK Iconify response", async () => {
    fetchHandler = () => new Response("nope", { status: 500, statusText: "Internal Server Error" });
    await expect(listCollectionsCore({})).rejects.toThrow("Iconify collections failed: 500");
  });

  test("throws on a malformed collections payload", async () => {
    fetchHandler = () => jsonResponse(["not", "a", "record"]);
    await expect(listCollectionsCore({})).rejects.toThrow("Iconify returned an invalid API response format");
  });
});
