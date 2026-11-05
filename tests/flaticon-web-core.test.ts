import { describe, test, expect } from "bun:test";
import { searchIcons, getIcon, FlaticonWebError } from "../src/providers/flaticon-web-core.js";
import type { FetchLike } from "../src/providers/flaticon-web-core.js";

/**
 * The flaticon-web core seam: Flaticon's UNOFFICIAL web contract behind
 * plain functions with an injected fetch.
 *
 * Contract basis (investigated 2026-11-04, see provider report):
 * - Search page: GET https://www.flaticon.com/search?word=<q>&page=<n>
 *   returns server-rendered HTML whose results link to icon pages
 *   (/free-icon/<slug>_<id>) and embed preview images from the public
 *   PNG CDN: https://cdn-icons-png.flaticon.com/<size>/<floor(id/1000)>/<id>.png
 *   (CDN pattern confirmed by dozens of in-the-wild hotlinks; the CDN
 *   itself answers 200 for real assets and 404 for bogus ids).
 * - www.flaticon.com sits behind a bot filter (Akamai): from this
 *   project's sandbox it returns HTTP 403 with a "security filter"
 *   page for every page, search and homepage alike. The BLOCK_PAGE
 *   fixture below is that real page (CSS elided).
 * The author link inside a result item is best-effort: the icon page
 * always names the author; the search grid may not.
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
  <p class="results-count">Showing <b>2</b> Cat icons</p>
  <div class="icon--item" data-id="763716">
    <a href="https://www.flaticon.com/free-icon/cat_763716" class="icon--link">
      <img src="https://cdn-icons-png.flaticon.com/128/763/763716.png"
           srcset="https://cdn-icons-png.flaticon.com/256/763/763716.png 256w, https://cdn-icons-png.flaticon.com/512/763/763716.png 512w"
           alt="Cat free icon" loading="lazy">
    </a>
    <a class="author" href="https://www.flaticon.com/authors/pixel-perfect">Pixel perfect</a>
  </div>
  <div class="icon--item" data-id="1864514">
    <a href="https://www.flaticon.com/free-icon/black-cat_1864514" title="Black cat silhouette" class="icon--link">
      <img src="https://cdn-icons-png.flaticon.com/128/1864/1864514.png" alt="Black cat free icon" loading="lazy">
    </a>
  </div>
</section>
</body></html>`;

/** The real block page flaticon.com served this sandbox (trimmed: CSS elided). */
const BLOCK_PAGE = `<!doctype html>
<html lang="en">
<head><script>(function(w,d,s,l){w[l]=w[l]||[];var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='/YyGPZT/';f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer');</script>
<meta charset="utf-8" />
<meta name="robots" content="noindex" />
<title>That request didn't go through. Our security filter flagged something. You don't have permission to access this page.</title>
</head>
<body><h1>That request didn't go through.</h1><p>Our security filter flagged something.</p></body></html>`;

const NO_RESULTS_PAGE = `<!doctype html>
<html lang="en"><head><title>Search results - Flaticon</title></head>
<body><section class="search-results"><p>No results to show</p></section></body></html>`;

/** A 200 page that matches neither results, no-results, nor a known block page. */
const UNRECOGNIZED_PAGE = `<!doctype html>
<html lang="en"><head><title>Flaticon</title></head>
<body><main><p>Something entirely new.</p></main></body></html>`;

describe("flaticon-web core — searchIcons (unofficial web contract)", () => {
  test("parses a recorded-shape results page into raw icons", async () => {
    const result = await searchIcons("cat", { fetchFn: fetchReturning(SEARCH_PAGE) });
    expect(result.total).toBe(2);
    expect(result.icons).toHaveLength(2);

    const [first, second] = result.icons;
    expect(first!.id).toBe(763716);
    expect(first!.title).toBe("Cat");
    expect(first!.pageUrl).toBe("https://www.flaticon.com/free-icon/cat_763716");
    expect(first!.author).toBe("Pixel perfect");
    // Largest size wins, gathered from src + srcset.
    expect(first!.images["512"]).toBe("https://cdn-icons-png.flaticon.com/512/763/763716.png");
    expect(first!.images["128"]).toBe("https://cdn-icons-png.flaticon.com/128/763/763716.png");

    expect(second!.id).toBe(1864514);
    expect(second!.title).toBe("Black cat silhouette");
    expect(second!.pageUrl).toBe("https://www.flaticon.com/free-icon/black-cat_1864514");
    // No author link in this item — attribution degrades to absent, never invented.
    expect(second!.author).toBeUndefined();
  });

  test("requests the public search URL for the query and page", async () => {
    const seen: string[] = [];
    const fetchFn = (async (input: unknown) => {
      seen.push(String(input));
      return new Response(SEARCH_PAGE, { headers: { "Content-Type": "text/html" } });
    }) as FetchLike;
    await searchIcons("black cat", { page: 2, fetchFn });
    expect(seen[0]).toBe("https://www.flaticon.com/search?word=black+cat&page=2");
  });

  test("respects the limit", async () => {
    const result = await searchIcons("cat", { limit: 1, fetchFn: fetchReturning(SEARCH_PAGE) });
    expect(result.icons).toHaveLength(1);
    expect(result.icons[0]!.id).toBe(763716);
    expect(result.total).toBe(2);
  });

  test("a genuine no-results page is an empty result, not an error", async () => {
    const result = await searchIcons("zzzqqq", { fetchFn: fetchReturning(NO_RESULTS_PAGE) });
    expect(result.icons).toEqual([]);
    expect(result.total).toBe(0);
  });

  test("the security-filter block page throws an error naming the block", async () => {
    const attempt = searchIcons("cat", { fetchFn: fetchReturning(BLOCK_PAGE, 403) });
    await expect(attempt).rejects.toThrow(FlaticonWebError);
    await expect(attempt).rejects.toThrow(/blocked/i);
    await expect(attempt).rejects.toThrow(/403/);
  });

  test("block markers in a 200 page also throw a block error, not a silent empty", async () => {
    const attempt = searchIcons("cat", { fetchFn: fetchReturning(BLOCK_PAGE, 200) });
    await expect(attempt).rejects.toThrow(/blocked/i);
  });

  test("an unrecognized 200 page throws a contract-changed error, not a silent empty", async () => {
    const attempt = searchIcons("cat", { fetchFn: fetchReturning(UNRECOGNIZED_PAGE) });
    await expect(attempt).rejects.toThrow(FlaticonWebError);
    await expect(attempt).rejects.toThrow(/no parseable icons/i);
  });

  test("other HTTP failures throw with their status", async () => {
    const attempt = searchIcons("cat", { fetchFn: fetchReturning("oops", 500) });
    await expect(attempt).rejects.toThrow(/HTTP 500/);
  });
});

describe("flaticon-web core — getIcon (public CDN pattern)", () => {
  function headFetch(status: number, seen?: string[]) {
    return (async (input: unknown, init?: RequestInit) => {
      seen?.push(`${init?.method ?? "GET"} ${String(input)}`);
      return new Response(null, { status });
    }) as FetchLike;
  }

  test("resolves the CDN URLs for a real icon id (HEAD 200)", async () => {
    const seen: string[] = [];
    const detail = await getIcon(25231, { fetchFn: headFetch(200, seen) });
    // The shard segment is floor(id/1000) — 25231 → 25, as in the wild.
    expect(seen[0]).toBe("HEAD https://cdn-icons-png.flaticon.com/512/25/25231.png");
    expect(detail).not.toBeNull();
    expect(detail!.id).toBe(25231);
    expect(detail!.imageUrl).toBe("https://cdn-icons-png.flaticon.com/512/25/25231.png");
    expect(detail!.previewUrl).toBe("https://cdn-icons-png.flaticon.com/128/25/25231.png");
  });

  test("shard rule holds for large and small ids", async () => {
    const seen: string[] = [];
    await getIcon(18358741, { fetchFn: headFetch(200, seen) });
    await getIcon(12715, { fetchFn: headFetch(200, seen) });
    expect(seen[0]).toContain("/512/18358/18358741.png");
    expect(seen[1]).toContain("/512/12/12715.png");
  });

  test("an unknown id (CDN 404) resolves to null", async () => {
    expect(await getIcon(999999999, { fetchFn: headFetch(404) })).toBeNull();
  });

  test("a blocked CDN check throws an error naming the block", async () => {
    const attempt = getIcon(25231, { fetchFn: headFetch(403) });
    await expect(attempt).rejects.toThrow(FlaticonWebError);
    await expect(attempt).rejects.toThrow(/blocked/i);
  });
});
