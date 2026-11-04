import { describe, test, expect } from "bun:test";
import { searchAssets, getAsset, type FetchLike } from "../src/providers/wikimedia-core.js";

/**
 * Adapted from the previous root's wikimedia core tests: the MediaWiki API
 * contract assertions are unchanged; the result-shape assertions follow
 * the unified Asset in src/types.ts (id carries the provider prefix,
 * license is the mapped LicenseType enum, url/sourceUrl replace
 * assetUrl/pageUrl).
 */

/** A FetchLike that always answers with the given JSON body / status. */
function fetchReturning(body: unknown, status = 200): FetchLike & { urls: string[] } {
  const urls: string[] = [];
  const fn = (async (input: string) => {
    urls.push(input);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as FetchLike & { urls: string[] };
  fn.urls = urls;
  return fn;
}

const SEARCH_RESPONSE = {
  batchcomplete: true,
  query: {
    pages: [
      {
        pageid: 135626,
        ns: 6,
        title: "File:Nuvola apps bookcase.svg",
        index: 2,
        imageinfo: [
          {
            url: "https://upload.wikimedia.org/wikipedia/commons/4/42/Nuvola_apps_bookcase.svg",
            descriptionurl:
              "https://commons.wikimedia.org/wiki/File:Nuvola_apps_bookcase.svg",
            thumburl:
              "https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Nuvola_apps_bookcase.svg/320px-Nuvola_apps_bookcase.svg.png",
            mime: "image/svg+xml",
            extmetadata: {
              LicenseShortName: { value: "LGPL" },
              Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:Example">Example</a>' },
            },
          },
        ],
      },
      {
        pageid: 987,
        ns: 6,
        title: "File:Bookcase photo.jpg",
        index: 1,
        imageinfo: [
          {
            url: "https://upload.wikimedia.org/wikipedia/commons/9/99/Bookcase_photo.jpg",
            descriptionurl: "https://commons.wikimedia.org/wiki/File:Bookcase_photo.jpg",
            mime: "image/jpeg",
            extmetadata: { LicenseShortName: { value: "CC BY 4.0" } },
          },
        ],
      },
    ],
  },
};

describe("wikimedia core — searchAssets", () => {
  test("maps SVG results to unified Assets, in search-rank order, with license", async () => {
    const fetchFn = fetchReturning(SEARCH_RESPONSE);
    const assets = await searchAssets("bookcase", { fetchFn });
    // The JPEG result is filtered out; only the SVG remains.
    expect(assets).toHaveLength(1);
    const a = assets[0]!;
    expect(a.id).toBe("wikimedia:File:Nuvola apps bookcase.svg");
    expect(a.type).toBe("icon");
    expect(a.title).toBe("Nuvola apps bookcase");
    expect(a.url).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/4/42/Nuvola_apps_bookcase.svg"
    );
    expect(a.downloadUrl).toBe(a.url);
    expect(a.format).toBe("svg");
    expect(a.previewUrl).toContain("320px");
    expect(a.source).toBe("Wikimedia Commons");
    expect(a.sourceUrl).toBe("https://commons.wikimedia.org/wiki/File:Nuvola_apps_bookcase.svg");
    // "LGPL" maps onto the enum as free-for-commercial; the artist survives as author.
    expect(a.license).toBe("free-for-commercial");
    expect(a.author).toBe("Example");
  });

  test("asks the Commons API for SVG files in the File namespace", async () => {
    const fetchFn = fetchReturning({ batchcomplete: true });
    await searchAssets("arrow", { fetchFn, limit: 5 });
    const url = new URL(fetchFn.urls[0]!);
    expect(url.origin + url.pathname).toBe("https://commons.wikimedia.org/w/api.php");
    expect(url.searchParams.get("action")).toBe("query");
    expect(url.searchParams.get("generator")).toBe("search");
    expect(url.searchParams.get("gsrsearch")).toContain("filetype:svg");
    expect(url.searchParams.get("gsrsearch")).toContain("arrow");
    expect(url.searchParams.get("gsrnamespace")).toBe("6");
    expect(url.searchParams.get("gsrlimit")).toBe("5");
    expect(url.searchParams.get("prop")).toBe("imageinfo");
  });

  test("empty result set returns an empty list, not an error", async () => {
    const fetchFn = fetchReturning({ batchcomplete: true });
    expect(await searchAssets("zzz-no-match", { fetchFn })).toEqual([]);
  });

  test("HTTP failure surfaces as an error naming the status", async () => {
    const fetchFn = fetchReturning("upstream down", 503);
    await expect(searchAssets("arrow", { fetchFn })).rejects.toThrow("503");
  });
});

describe("wikimedia core — getAsset", () => {
  test("resolves a File title to its Asset with the original SVG url", async () => {
    const fetchFn = fetchReturning(SEARCH_RESPONSE);
    const a = await getAsset("File:Nuvola apps bookcase.svg", { fetchFn });
    expect(a).not.toBeNull();
    expect(a!.url).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/4/42/Nuvola_apps_bookcase.svg"
    );
    expect(a!.license).toBe("free-for-commercial");
    const url = new URL(fetchFn.urls[0]!);
    expect(url.searchParams.get("titles")).toBe("File:Nuvola apps bookcase.svg");
  });

  test("accepts a bare file name and normalizes it to a File title", async () => {
    const fetchFn = fetchReturning({ batchcomplete: true, query: { pages: [] } });
    await getAsset("Nuvola apps bookcase.svg", { fetchFn });
    const url = new URL(fetchFn.urls[0]!);
    expect(url.searchParams.get("titles")).toBe("File:Nuvola apps bookcase.svg");
  });

  test("returns null when the file does not exist", async () => {
    const fetchFn = fetchReturning({
      batchcomplete: true,
      query: {
        pages: [{ ns: 6, title: "File:Nope.svg", missing: true }],
      },
    });
    expect(await getAsset("File:Nope.svg", { fetchFn })).toBeNull();
  });
});
