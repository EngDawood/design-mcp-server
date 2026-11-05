import { describe, test, expect } from "bun:test";
import { getToken, FlaticonError } from "../src/providers/flaticon-core.js";

/** Records every call and delegates the response to the given handler. */
export function fakeFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (input: unknown, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    return handler(url, init);
  }) as unknown as typeof fetch;
  return { impl, calls };
}

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const AUTH_URL = "https://api.flaticon.com/v3/app/authentication";
const authOk = (token = "tok-1", expires = 9_999_999_999) => jsonResponse({ data: { token, expires } });

describe("getToken — Flaticon authentication", () => {
  test("POSTs the apikey as JSON to /v3/app/authentication and returns data.token", async () => {
    const { impl, calls } = fakeFetch(() => authOk());
    const token = await getToken("test-key", { fetch: impl });

    expect(token).toBe("tok-1");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(AUTH_URL);
    expect(calls[0]!.init.method).toBe("POST");
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ apikey: "test-key" });
  });

  test("throws FlaticonError when the auth response carries an error", async () => {
    const { impl } = fakeFetch(() => jsonResponse({ error: "Invalid apikey" }));
    await expect(getToken("bad-key", { fetch: impl })).rejects.toBeInstanceOf(FlaticonError);
  });

  test("throws FlaticonError on a non-OK auth response, without leaking the key", async () => {
    const { impl } = fakeFetch(() => new Response("nope", { status: 403 }));
    const err = await getToken("secret-key-123", { fetch: impl }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FlaticonError);
    expect(String((err as Error).message)).not.toContain("secret-key-123");
  });
});

describe("getToken — per-isolate token cache", () => {
  const T0 = 1_800_000_000_000; // fixed epoch ms for deterministic expiry maths

  test("a second call reuses the cached token — exactly one auth request", async () => {
    let auths = 0;
    const { impl } = fakeFetch(() => {
      auths++;
      return authOk(`tok-${auths}`);
    });
    const deps = { fetch: impl, cache: new Map(), now: () => T0 };

    expect(await getToken("k", deps)).toBe("tok-1");
    expect(await getToken("k", deps)).toBe("tok-1");
    expect(auths).toBe(1);
  });

  test("absolute-epoch `expires` (seconds): re-auths after it passes", async () => {
    let auths = 0;
    let now = T0;
    const { impl } = fakeFetch(() => {
      auths++;
      return authOk(`tok-${auths}`, Math.floor(now / 1000) + 3600);
    });
    const deps = { fetch: impl, cache: new Map(), now: () => now };

    await getToken("k", deps);
    now = T0 + 3_500_000; // inside the hour, net of the safety margin
    expect(await getToken("k", deps)).toBe("tok-1");
    now = T0 + 3_700_000; // past expiry
    expect(await getToken("k", deps)).toBe("tok-2");
    expect(auths).toBe(2);
  });

  test("TTL-seconds `expires`: also honoured (the two wild readings agree in effect)", async () => {
    let auths = 0;
    let now = T0;
    const { impl } = fakeFetch(() => {
      auths++;
      return authOk(`tok-${auths}`, 3600); // read as a 1-hour TTL
    });
    const deps = { fetch: impl, cache: new Map(), now: () => now };

    await getToken("k", deps);
    now = T0 + 3_500_000;
    expect(await getToken("k", deps)).toBe("tok-1");
    now = T0 + 3_700_000;
    expect(await getToken("k", deps)).toBe("tok-2");
    expect(auths).toBe(2);
  });

  test("different API keys get different cache entries", async () => {
    const { impl, calls } = fakeFetch((_url, init) => {
      const key = (JSON.parse(String(init.body)) as { apikey: string }).apikey;
      return authOk(`tok-for-${key}`);
    });
    const deps = { fetch: impl, cache: new Map(), now: () => T0 };

    expect(await getToken("key-a", deps)).toBe("tok-for-key-a");
    expect(await getToken("key-b", deps)).toBe("tok-for-key-b");
    expect(calls).toHaveLength(2);
  });
});

import { searchIcons } from "../src/providers/flaticon-core.js";

/** Fixture in the verified v3 search shape (IconResponse of working clients). */
const SEARCH_FIXTURE = {
  data: [
    {
      id: 2589192,
      description: "home building house",
      colors: 1,
      color: "000000",
      shape: "lineal",
      family_id: 12,
      family_name: "Basic Icons",
      team_name: "Freepik",
      added: 1600000000,
      pack_id: 300,
      pack_name: "Home Essentials",
      pack_items: 50,
      tags: "home,house,building",
      images: {
        "16": "https://cdn-icons-png.flaticon.com/16/2589/2589192.png",
        "256": "https://cdn-icons-png.flaticon.com/256/2589/2589192.png",
        "512": "https://cdn-icons-png.flaticon.com/512/2589/2589192.png",
      },
    },
  ],
  metadata: { total: 1234, count: 1, page: 1 },
};

function searchServer(searchBody: unknown = SEARCH_FIXTURE, searchStatus = 200) {
  return fakeFetch((url) =>
    url === AUTH_URL ? authOk() : jsonResponse(searchBody, searchStatus),
  );
}

describe("searchIcons — Flaticon search", () => {
  test("GETs /v3/search/icons with q + limit and the Bearer token", async () => {
    const { impl, calls } = searchServer();
    await searchIcons("k", "home", { limit: 10 }, { fetch: impl, cache: new Map() });

    const search = calls.find((c) => c.url.includes("/search/icons"))!;
    const url = new URL(search.url);
    expect(url.origin + url.pathname).toBe("https://api.flaticon.com/v3/search/icons");
    expect(url.searchParams.get("q")).toBe("home");
    expect(url.searchParams.get("limit")).toBe("10");
    const headers = new Headers(search.init.headers);
    expect(headers.get("Authorization")).toBe("Bearer tok-1");
    expect(headers.get("Accept")).toBe("application/json");
  });

  test("maps results: attribution kept, tags split, unified Asset built", async () => {
    const { impl } = searchServer();
    const result = await searchIcons("k", "home", {}, { fetch: impl, cache: new Map() });

    expect(result.total).toBe(1234);
    expect(result.icons).toHaveLength(1);
    const icon = result.icons[0]!;
    expect(icon.id).toBe(2589192);
    expect(icon.description).toBe("home building house");
    expect(icon.tags).toEqual(["home", "house", "building"]);
    // Attribution is never stripped: the API's author/team and pack survive.
    expect(icon.author).toBe("Freepik");
    expect(icon.packName).toBe("Home Essentials");
    expect(icon.images["512"]).toBe("https://cdn-icons-png.flaticon.com/512/2589/2589192.png");
    expect(icon.asset).toEqual({
      id: "flaticon:2589192",
      type: "icon",
      title: "home building house",
      url: "https://cdn-icons-png.flaticon.com/512/2589/2589192.png",
      previewUrl: "https://cdn-icons-png.flaticon.com/256/2589/2589192.png",
      downloadUrl: "https://cdn-icons-png.flaticon.com/512/2589/2589192.png",
      format: "png",
      author: "Freepik",
      license: "free-for-commercial",
      licenseUrl: "https://www.flaticon.com/legal",
      source: "Flaticon",
      tags: ["home", "house", "building"],
    });
  });

  test("an API error body ({status:'error', message}) becomes a FlaticonError", async () => {
    const { impl } = searchServer({ status: "error", message: "Query too short" });
    await expect(
      searchIcons("k", "x", {}, { fetch: impl, cache: new Map() }),
    ).rejects.toThrow("Query too short");
  });

  test("a non-OK search response becomes a FlaticonError carrying the status", async () => {
    const { impl } = searchServer({ message: "boom" }, 500);
    const err = await searchIcons("k", "home", {}, { fetch: impl, cache: new Map() }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(FlaticonError);
    expect((err as FlaticonError).status).toBe(500);
  });
});

describe("searchIcons — 401 handling", () => {
  test("a 401 discards the token, re-authenticates once, and retries", async () => {
    let auths = 0;
    let searches = 0;
    const { impl } = fakeFetch((url) => {
      if (url === AUTH_URL) {
        auths++;
        return authOk(`tok-${auths}`);
      }
      searches++;
      return searches === 1 ? new Response("expired", { status: 401 }) : jsonResponse(SEARCH_FIXTURE);
    });

    const result = await searchIcons("k", "home", {}, { fetch: impl, cache: new Map() });
    expect(result.icons).toHaveLength(1);
    expect(auths).toBe(2);
    expect(searches).toBe(2);
  });

  test("a second 401 is an error, not a retry loop", async () => {
    let searches = 0;
    const { impl } = fakeFetch((url) => {
      if (url === AUTH_URL) return authOk();
      searches++;
      return new Response("expired", { status: 401 });
    });

    await expect(
      searchIcons("k", "home", {}, { fetch: impl, cache: new Map() }),
    ).rejects.toBeInstanceOf(FlaticonError);
    expect(searches).toBe(2);
  });
});

import { getIcon } from "../src/providers/flaticon-core.js";

const DETAIL_FIXTURE = {
  data: {
    id: 2589192,
    description: "home building house",
    author: { name: "Freepik" },
    url: "https://www.flaticon.com/free-icon/home_2589192",
    license: "Flaticon License",
  },
};

const SIGNED_URL = "https://download.flaticon.com/signed/2589192.svg?token=abc";

function iconServer(overrides: {
  detail?: () => Response;
  download?: () => Response;
} = {}) {
  return fakeFetch((url) => {
    if (url === AUTH_URL) return authOk();
    if (url.includes("/item/icon/download/")) {
      return overrides.download?.() ?? jsonResponse({ data: { url: SIGNED_URL } });
    }
    if (url.includes("/item/icon/")) return overrides.detail?.() ?? jsonResponse(DETAIL_FIXTURE);
    throw new Error(`unexpected url ${url}`);
  });
}

describe("getIcon — detail + download-URL resolution", () => {
  test("resolves a signed download URL from the JSON form and keeps detail attribution", async () => {
    const { impl, calls } = iconServer();
    const icon = await getIcon("k", 2589192, {}, { fetch: impl, cache: new Map() });

    expect(icon.id).toBe(2589192);
    expect(icon.author).toBe("Freepik");
    expect(icon.pageUrl).toBe("https://www.flaticon.com/free-icon/home_2589192");
    expect(icon.license).toBe("Flaticon License");
    expect(icon.download).toEqual({ format: "svg", url: SIGNED_URL, requiresAuth: false });

    const download = calls.find((c) => c.url.includes("/item/icon/download/"))!;
    expect(download.url).toBe(
      "https://api.flaticon.com/v3/item/icon/download/2589192?format=svg",
    );
    expect(new Headers(download.init.headers).get("Authorization")).toBe("Bearer tok-1");
    expect(calls.some((c) => c.url === "https://api.flaticon.com/v3/item/icon/2589192")).toBe(true);
  });

  test("when the endpoint returns the file itself, the download URL is the endpoint (auth required)", async () => {
    const { impl } = iconServer({
      download: () =>
        new Response('<svg xmlns="http://www.w3.org/2000/svg"></svg>', {
          headers: { "Content-Type": "image/svg+xml" },
        }),
    });
    const icon = await getIcon("k", 2589192, {}, { fetch: impl, cache: new Map() });
    expect(icon.download.url).toBe(
      "https://api.flaticon.com/v3/item/icon/download/2589192?format=svg",
    );
    expect(icon.download.requiresAuth).toBe(true);
  });

  test("PNG requests carry format and size to the download endpoint", async () => {
    const { impl, calls } = iconServer();
    const icon = await getIcon(
      "k",
      2589192,
      { format: "png", size: 512 },
      { fetch: impl, cache: new Map() },
    );
    const download = calls.find((c) => c.url.includes("/item/icon/download/"))!;
    const url = new URL(download.url);
    expect(url.searchParams.get("format")).toBe("png");
    expect(url.searchParams.get("size")).toBe("512");
    expect(icon.download).toEqual({ format: "png", size: 512, url: SIGNED_URL, requiresAuth: false });
  });

  test("a failing detail endpoint does not fail the download resolution", async () => {
    const { impl } = iconServer({ detail: () => new Response("gone", { status: 404 }) });
    const icon = await getIcon("k", 2589192, {}, { fetch: impl, cache: new Map() });
    expect(icon.download.url).toBe(SIGNED_URL);
    expect(icon.author).toBeUndefined();
  });

  test("a refused download (403) is a FlaticonError carrying the status", async () => {
    const { impl } = iconServer({
      download: () => jsonResponse({ message: "Plan does not cover this icon" }, 403),
    });
    const err = await getIcon("k", 2589192, {}, { fetch: impl, cache: new Map() }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(FlaticonError);
    expect((err as FlaticonError).status).toBe(403);
  });
});
