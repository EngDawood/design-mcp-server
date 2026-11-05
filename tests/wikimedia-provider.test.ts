import { describe, test, expect } from "bun:test";
import { WikimediaProvider } from "../src/providers/wikimedia.js";
import { createProviders } from "../src/providers/registry.js";
import { loadConfig } from "../src/config.js";
import type { FetchLike } from "../src/providers/wikimedia-core.js";

function fetchReturning(body: unknown): FetchLike {
  return (async () =>
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
    })) as FetchLike;
}

const ONE_RESULT = {
  batchcomplete: true,
  query: {
    pages: [
      {
        pageid: 1,
        ns: 6,
        title: "File:Arrow.svg",
        index: 1,
        imageinfo: [
          {
            url: "https://upload.wikimedia.org/wikipedia/commons/a/Arrow.svg",
            descriptionurl: "https://commons.wikimedia.org/wiki/File:Arrow.svg",
            mime: "image/svg+xml",
            extmetadata: { LicenseShortName: { value: "CC BY-SA 4.0" } },
          },
        ],
      },
    ],
  },
};

describe("wikimedia provider — the unified seam", () => {
  test("is in the registry under the wikimedia name, keyless and available", () => {
    const providers = createProviders(loadConfig({}));
    const wikimedia = providers.find((p) => p.name === "wikimedia");
    expect(wikimedia).toBeDefined();
    expect(wikimedia!.available).toBe(true);
  });

  test("search returns a SearchResult of unified Assets", async () => {
    const provider = new WikimediaProvider({ fetchFn: fetchReturning(ONE_RESULT) });
    const result = await provider.search({ query: "arrow" });
    expect(result.provider).toBe("wikimedia");
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]!.license).toBe("cc-by-sa");
    expect(result.assets[0]!.source).toBe("Wikimedia Commons");
  });

  test("getById accepts the full prefixed id from search results", async () => {
    const provider = new WikimediaProvider({ fetchFn: fetchReturning(ONE_RESULT) });
    const asset = await provider.getById!("wikimedia:File:Arrow.svg");
    expect(asset).not.toBeNull();
    expect(asset!.id).toBe("wikimedia:File:Arrow.svg");
  });
});
