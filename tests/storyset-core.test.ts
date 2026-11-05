import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import {
  searchStoryset,
  getIllustration,
  downloadAsset,
  recolorSvg,
  extractPaletteFromSvg,
  applyRecolor,
  searchResultToAsset,
} from "../src/providers/storyset-core.js";

const originalFetch = globalThis.fetch;
let fetchCalls: string[] = [];
let fetchHandler: (url: string) => Response;

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, { status, headers: { "Content-Type": "text/html" } });
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

// Fixture search page in storyset.com's card markup shape (hand-written,
// independent of the parsing code under test).
const SEARCH_HTML = `<html><body>
<a href="/illustration/developer-activity/amico" title="Developer activity" class="card" data-testid="vector-illustration"><img src="https://stories.freepiklabs.com/storage/11961/Developer-activity_Mesa-de-trabajo-1.svg" alt=""/></a>
<a href="/illustration/developer-activity/bro" title="Developer activity" data-testid="vector-illustration"><img data-src="https://stories.freepiklabs.com/storage/16408/developer-activity_Mesa-de-trabajo-1.svg" alt=""/></a>
<a href="/illustration/web-development/amico" title="Web development" data-testid="vector-illustration"><span>no image</span></a>
</body></html>`;

describe("searchStoryset", () => {
  test("parses result cards into title/slug/style/page/preview", async () => {
    fetchHandler = () => htmlResponse(SEARCH_HTML);

    const { query, count, results } = await searchStoryset("developer", 20);

    expect(query).toBe("developer");
    expect(count).toBe(3);
    expect(results[0]).toEqual({
      title: "Developer activity",
      slug: "developer-activity",
      style: "amico",
      page_url: "https://storyset.com/illustration/developer-activity/amico",
      preview_url:
        "https://stories.freepiklabs.com/storage/11961/Developer-activity_Mesa-de-trabajo-1.svg",
    });
    expect(results[1]?.style).toBe("bro");
    expect(results[2]?.preview_url).toBeNull();
    expect(fetchCalls[0]).toBe("https://storyset.com/search?q=developer");
  });

  test("honours the limit", async () => {
    fetchHandler = () => htmlResponse(SEARCH_HTML);

    const { count, results } = await searchStoryset("developer", 2);

    expect(count).toBe(2);
    expect(results.map((r) => r.style)).toEqual(["amico", "bro"]);
  });

  test("throws on a non-OK storyset response", async () => {
    fetchHandler = () => new Response("nope", { status: 503 });
    await expect(searchStoryset("developer", 5)).rejects.toThrow("HTTP 503");
  });
});

describe("searchResultToAsset", () => {
  test("maps a result onto the unified Asset shape", () => {
    const asset = searchResultToAsset({
      title: "Developer activity",
      slug: "developer-activity",
      style: "amico",
      page_url: "https://storyset.com/illustration/developer-activity/amico",
      preview_url:
        "https://stories.freepiklabs.com/storage/11961/Developer-activity_Mesa-de-trabajo-1.svg",
    });

    expect(asset).toEqual({
      id: "storyset:developer-activity",
      type: "illustration",
      title: "Developer activity",
      url: "https://stories.freepiklabs.com/storage/11961/Developer-activity_Mesa-de-trabajo-1.svg",
      previewUrl:
        "https://stories.freepiklabs.com/storage/11961/Developer-activity_Mesa-de-trabajo-1.svg",
      downloadUrl:
        "https://stories.freepiklabs.com/storage/11961/Developer-activity_Mesa-de-trabajo-1.svg",
      format: "svg",
      license: "free-for-commercial",
      licenseUrl: "https://storyset.com/terms",
      source: "Storyset",
      sourceUrl: "https://storyset.com/illustration/developer-activity/amico",
    });
  });
});

// Fixture illustration page: og:image carries the PNG, and two SVGs are
// embedded — only the one whose filename carries the slug is canonical.
const PAGE_HTML = `<html><head>
<meta property="og:image" content="https://stories.freepiklabs.com/storage/9999/Web-development-amico.png"/>
</head><body>
<img src="https://stories.freepiklabs.com/storage/9999/Other-thing-amico.svg"/>
<img src="https://stories.freepiklabs.com/storage/9999/Web-development_Mesa-de-trabajo-1.svg"/>
</body></html>`;

describe("getIllustration", () => {
  test("builds canonical PNG + SVG URLs from the illustration page", async () => {
    fetchHandler = () => htmlResponse(PAGE_HTML);

    const result = await getIllustration("web-development", "amico");

    expect(result).toEqual({
      slug: "web-development",
      style: "amico",
      page_url: "https://storyset.com/illustration/web-development/amico",
      png_url: "https://stories.freepiklabs.com/storage/9999/Web-development-amico.png",
      svg_url:
        "https://stories.freepiklabs.com/storage/9999/Web-development_Mesa-de-trabajo-1.svg",
    });
    expect(fetchCalls[0]).toBe("https://storyset.com/illustration/web-development/amico");
  });

  test("returns not_found on a 404 page", async () => {
    fetchHandler = () => htmlResponse("missing", 404);

    const result = await getIllustration("nope", "amico");

    expect(result).toEqual({
      error: "not_found",
      page_url: "https://storyset.com/illustration/nope/amico",
      png_url: null,
      svg_url: null,
    });
  });
});

const SVG_FIXTURE =
  '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#BA68C8" d="M0 0"/><circle fill="#ba68c8" r="4"/><rect fill="#455A64"/><path fill="#fff"/></svg>';

describe("recolor", () => {
  test("applyRecolor replaces hex colors and counts replacements", () => {
    const { svg, stats } = applyRecolor(SVG_FIXTURE, { "#BA68C8": "#2196F3" });

    expect(svg).not.toContain("#BA68C8");
    expect(svg).not.toContain("#ba68c8");
    expect(svg.match(/#2196f3/g)).toHaveLength(2);
    expect(svg).toContain("#455A64");
    expect(stats).toEqual({ "#ba68c8": 2 });
  });

  test("applyRecolor normalizes 3-digit hex on both sides", () => {
    const { svg, stats } = applyRecolor(SVG_FIXTURE, { "#FFFFFF": "#000" });

    expect(svg).toContain('fill="#000000"');
    expect(stats).toEqual({ "#ffffff": 1 });
  });

  test("recolorSvg recolors raw markup and returns it inline", async () => {
    const result = await recolorSvg(SVG_FIXTURE, { "#455a64": "#1a237e" });

    expect(fetchCalls).toHaveLength(0);
    if (!("content" in result)) throw new Error("expected inline content for raw markup");
    expect(result.content).toContain("#1a237e");
    expect(result.recolor_stats).toEqual({ "#455a64": 1 });
  });
});

describe("extractPaletteFromSvg", () => {
  test("returns colors sorted by frequency, normalized", () => {
    expect(extractPaletteFromSvg(SVG_FIXTURE)).toEqual([
      { color: "#ba68c8", count: 2 },
      { color: "#455a64", count: 1 },
      { color: "#ffffff", count: 1 },
    ]);
  });
});

describe("downloadAsset", () => {
  test("rejects URLs outside the asset host without fetching", async () => {
    const result = await downloadAsset("https://example.com/evil.svg");

    expect(result).toEqual({
      error: "invalid_url",
      detail: "Only stories.freepiklabs.com URLs allowed",
    });
    expect(fetchCalls).toHaveLength(0);
  });
});
