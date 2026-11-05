import { describe, test, expect } from "bun:test";
import { FlaticonWebProvider } from "../src/providers/flaticon-web.js";
import { createProviders } from "../src/providers/registry.js";
import { loadConfig } from "../src/config.js";
import type { FetchLike } from "../src/providers/flaticon-web-core.js";

/**
 * The provider-seam contract for flaticon-web: identity, keyless
 * availability, the experimental note, and search/getById mapping onto
 * unified Assets with attribution never stripped.
 */

function fetchReturning(body: string, status = 200): FetchLike {
  return (async () =>
    new Response(body, {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })) as FetchLike;
}

const SEARCH_PAGE = `<!doctype html>
<html lang="en"><head><title>Search results for Cat - Flaticon</title></head>
<body>
<section class="search-results">
  <p class="results-count">Showing <b>1</b> Cat icons</p>
  <div class="icon--item" data-id="763716">
    <a href="https://www.flaticon.com/free-icon/cat_763716" class="icon--link">
      <img src="https://cdn-icons-png.flaticon.com/128/763/763716.png"
           srcset="https://cdn-icons-png.flaticon.com/256/763/763716.png 256w, https://cdn-icons-png.flaticon.com/512/763/763716.png 512w"
           alt="Cat free icon" loading="lazy">
    </a>
    <a class="author" href="https://www.flaticon.com/authors/pixel-perfect">Pixel perfect</a>
  </div>
</section>
</body></html>`;

describe("flaticonWebProvider — the unified seam", () => {
  test("identity: name, keyless availability, experimental note", () => {
    const provider = new FlaticonWebProvider();
    expect(provider.name).toBe("flaticon-web");
    expect(provider.available).toBe(true);
    expect(provider.note).toContain("Experimental");
    expect(provider.note).toContain("no API key");
  });

  test("the registry lists flaticon-web, ready without any config", () => {
    const found = createProviders(loadConfig({})).find((p) => p.name === "flaticon-web");
    expect(found).toBeDefined();
    expect(found!.available).toBe(true);
    expect(found!.note).toContain("Experimental");
  });

  test("search maps page results to unified Assets with attribution preserved", async () => {
    const provider = new FlaticonWebProvider({ fetchFn: fetchReturning(SEARCH_PAGE) });
    const result = await provider.search({ query: "cat" });
    expect(result.provider).toBe("flaticon-web");
    expect(result.total).toBe(1);
    const asset = result.assets[0]!;
    expect(asset.id).toBe("flaticon-web:763716");
    expect(asset.type).toBe("icon");
    expect(asset.title).toBe("Cat");
    expect(asset.url).toBe("https://cdn-icons-png.flaticon.com/512/763/763716.png");
    expect(asset.previewUrl).toBe("https://cdn-icons-png.flaticon.com/256/763/763716.png");
    expect(asset.downloadUrl).toBe("https://cdn-icons-png.flaticon.com/512/763/763716.png");
    expect(asset.format).toBe("png");
    expect(asset.author).toBe("Pixel perfect");
    expect(asset.license).toBe("free-for-commercial");
    expect(asset.licenseUrl).toBe("https://www.flaticon.com/legal");
    expect(asset.source).toBe("Flaticon");
    expect(asset.sourceUrl).toBe("https://www.flaticon.com/free-icon/cat_763716");
  });

  test("getById accepts the prefixed id and resolves via the CDN", async () => {
    const provider = new FlaticonWebProvider({
      fetchFn: (async () => new Response(null, { status: 200 })) as FetchLike,
    });
    const asset = await provider.getById("flaticon-web:25231");
    expect(asset).not.toBeNull();
    expect(asset!.id).toBe("flaticon-web:25231");
    expect(asset!.url).toBe("https://cdn-icons-png.flaticon.com/512/25/25231.png");
    expect(asset!.previewUrl).toBe("https://cdn-icons-png.flaticon.com/128/25/25231.png");
    expect(asset!.license).toBe("free-for-commercial");
    expect(asset!.licenseUrl).toBe("https://www.flaticon.com/legal");
    expect(asset!.source).toBe("Flaticon");
  });

  test("getById returns null for an unknown id (CDN 404)", async () => {
    const provider = new FlaticonWebProvider({
      fetchFn: (async () => new Response(null, { status: 404 })) as FetchLike,
    });
    expect(await provider.getById("flaticon-web:999999999")).toBeNull();
  });

  test("a blocked search page propagates the block error (tools isolate it)", async () => {
    const provider = new FlaticonWebProvider({
      fetchFn: fetchReturning("<title>security filter flagged</title>", 403),
    });
    await expect(provider.search({ query: "cat" })).rejects.toThrow(/blocked/i);
  });
});
