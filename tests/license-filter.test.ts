import { describe, it, expect } from "bun:test";
import type { Asset } from "../src/types.js";
import { filterByLicense, filterByFormat, filterByColor } from "../src/utils/license-filter.js";

const mockAssets: Asset[] = [
  {
    id: "1",
    type: "icon",
    title: "Icon 1",
    url: "https://example.com/1.svg",
    format: "svg",
    source: "Test",
    license: "mit",
  },
  {
    id: "2",
    type: "icon",
    title: "Icon 2",
    url: "https://example.com/2.png",
    format: "png",
    source: "Test",
    license: "cc0",
    colorPalette: ["#ff0000", "#00ff00"],
  },
  {
    id: "3",
    type: "icon",
    title: "Icon 3",
    url: "https://example.com/3.svg",
    format: "svg",
    source: "Test",
    license: "cc-by-nc",
  },
];

describe("filterByLicense", () => {
  it("should return all assets when no license specified", () => {
    expect(filterByLicense(mockAssets)).toHaveLength(3);
  });

  it("should filter by specific license", () => {
    expect(filterByLicense(mockAssets, "mit")).toHaveLength(1);
    expect(filterByLicense(mockAssets, "cc0")).toHaveLength(1);
    expect(filterByLicense(mockAssets, "cc-by-nc")).toHaveLength(1);
  });

  it("should treat free-for-commercial as including mit, cc0, cc-by", () => {
    const filtered = filterByLicense(mockAssets, "free-for-commercial");
    expect(filtered).toHaveLength(2); // mit + cc0
  });
});

describe("filterByFormat", () => {
  it("should return all assets when no format specified", () => {
    expect(filterByFormat(mockAssets)).toHaveLength(3);
  });

  it("should filter by format", () => {
    expect(filterByFormat(mockAssets, "svg")).toHaveLength(2);
    expect(filterByFormat(mockAssets, "png")).toHaveLength(1);
  });
});

describe("filterByColor", () => {
  it("should return all assets when no color specified", () => {
    expect(filterByColor(mockAssets)).toHaveLength(3);
  });

  it("should filter by color", () => {
    expect(filterByColor(mockAssets, "#ff0000")).toHaveLength(1);
    expect(filterByColor(mockAssets, "ff0000")).toHaveLength(1);
    expect(filterByColor(mockAssets, "#00ff00")).toHaveLength(1);
  });

  it("should return empty for non-matching color", () => {
    expect(filterByColor(mockAssets, "#0000ff")).toHaveLength(0);
  });
});
