import { describe, it, expect } from "bun:test";
import type { Asset, SearchResult } from "../src/types.js";
import { formatAssetForAI, formatSearchResultsForAI } from "../src/utils/normalize.js";

describe("formatAssetForAI", () => {
  it("should format a basic asset", () => {
    const asset: Asset = {
      id: "iconify:mdi:home",
      type: "icon",
      title: "mdi:home",
      url: "https://api.iconify.design/mdi:home.svg",
      format: "svg",
      source: "Iconify",
      license: "unknown",
    };

    const formatted = formatAssetForAI(asset);
    expect(formatted).toContain("[ICON]");
    expect(formatted).toContain("mdi:home");
    expect(formatted).toContain("https://api.iconify.design/mdi:home.svg");
    expect(formatted).toContain("Format: svg");
  });

  it("should include optional fields when present", () => {
    const asset: Asset = {
      id: "pexels:123",
      type: "stock-photo",
      title: "Mountain Sunset",
      description: "A beautiful mountain at sunset",
      url: "https://www.pexels.com/photo/123",
      previewUrl: "https://images.pexels.com/123/preview.jpg",
      downloadUrl: "https://images.pexels.com/123/download.jpg",
      format: "jpg",
      width: 4000,
      height: 3000,
      author: "John Doe",
      source: "Pexels",
      license: "free-for-commercial",
      tags: ["mountain", "sunset", "nature"],
    };

    const formatted = formatAssetForAI(asset);
    expect(formatted).toContain("Dimensions: 4000x3000");
    expect(formatted).toContain("Author: John Doe");
    expect(formatted).toContain("Tags: mountain, sunset, nature");
    expect(formatted).toContain("Description: A beautiful mountain at sunset");
  });
});

describe("formatSearchResultsForAI", () => {
  it("should format empty results", () => {
    const result: SearchResult = {
      assets: [],
      total: 0,
      provider: "iconify",
      query: "nonexistent",
    };

    const formatted = formatSearchResultsForAI(result);
    expect(formatted).toContain("No iconify results found");
  });

  it("should format results with assets", () => {
    const result: SearchResult = {
      assets: [
        {
          id: "iconify:mdi:home",
          type: "icon",
          title: "mdi:home",
          url: "https://api.iconify.design/mdi:home.svg",
          format: "svg",
          source: "Iconify",
          license: "unknown",
        },
      ],
      total: 1,
      provider: "iconify",
      query: "home",
    };

    const formatted = formatSearchResultsForAI(result);
    expect(formatted).toContain("Found 1 iconify results");
    expect(formatted).toContain("1. [ICON]");
  });
});
