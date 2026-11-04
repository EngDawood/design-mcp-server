// Adapted from better-icons (MIT, better-auth) src/icon-utils.test.ts.
import { test, expect, describe } from "bun:test";
import {
  resolveIconAlias,
  buildSvg,
} from "../src/providers/iconify/icon-utils.js";

describe("resolveIconAlias", () => {
  test("returns original name when no alias exists", () => {
    const iconSet = { icons: { home: { body: "" } } };
    expect(resolveIconAlias(iconSet, "home")).toBe("home");
  });

  test("resolves alias to parent icon", () => {
    const iconSet = {
      icons: { house: { body: "" } },
      aliases: { home: { parent: "house" } },
    };
    expect(resolveIconAlias(iconSet, "home")).toBe("house");
  });

  test("returns original when icon set has no aliases property", () => {
    const iconSet = { icons: { home: { body: "" } } };
    expect(resolveIconAlias(iconSet, "arrow")).toBe("arrow");
  });

  test("resolves multi-level aliases (A → B → C)", () => {
    const iconSet = {
      icons: { house: { body: "" } },
      aliases: {
        home: { parent: "dwelling" },
        dwelling: { parent: "house" },
      },
    };
    expect(resolveIconAlias(iconSet, "home")).toBe("house");
  });

  test("handles circular aliases with max depth", () => {
    const iconSet = {
      icons: {},
      aliases: {
        a: { parent: "b" },
        b: { parent: "a" },
      },
    };
    // Should not infinite loop, returns after max depth
    const result = resolveIconAlias(iconSet, "a");
    expect(["a", "b"]).toContain(result);
  });
});

describe("buildSvg", () => {
  const baseIcon = { body: '<path d="M0 0"/>' };

  test("uses icon dimensions over defaults", () => {
    const icon = { ...baseIcon, width: 32, height: 32 };
    const svg = buildSvg(icon, { width: 24, height: 24 });
    expect(svg).toContain('viewBox="0 0 32 32"');
  });

  test("falls back to defaults when icon has no dimensions", () => {
    const svg = buildSvg(baseIcon, { width: 48, height: 48 });
    expect(svg).toContain('viewBox="0 0 48 48"');
  });

  test("falls back to 24x24 when no dimensions provided", () => {
    const svg = buildSvg(baseIcon, {});
    expect(svg).toContain('viewBox="0 0 24 24"');
  });

  test("applies left/top offset to viewBox", () => {
    const icon = { ...baseIcon, left: 2, top: 4, width: 20, height: 20 };
    const svg = buildSvg(icon, {});
    expect(svg).toContain('viewBox="2 4 20 20"');
  });

  test("uses 1em size by default", () => {
    const svg = buildSvg(baseIcon, {});
    expect(svg).toContain('width="1em" height="1em"');
  });

  test("uses pixel size when specified", () => {
    const svg = buildSvg(baseIcon, {}, { size: 48 });
    expect(svg).toContain('width="48" height="48"');
  });

  test("adds currentColor fill to paths without fill or stroke", () => {
    const svg = buildSvg(baseIcon, {});
    expect(svg).toContain('fill="currentColor"');
  });

  test("uses custom color for fill", () => {
    const svg = buildSvg(baseIcon, {}, { color: "#ff0000" });
    expect(svg).toContain('fill="#ff0000"');
  });

  test("preserves existing fill attribute", () => {
    const icon = { body: '<path fill="blue" d="M0 0"/>' };
    const svg = buildSvg(icon, {}, { color: "#ff0000" });
    expect(svg).toContain('fill="blue"');
    expect(svg).not.toContain('fill="#ff0000"');
  });

  test("preserves paths with stroke attribute", () => {
    const icon = { body: '<path stroke="black" d="M0 0"/>' };
    const svg = buildSvg(icon, {});
    expect(svg).not.toContain('fill="currentColor"');
  });

  test("adds fill to circle elements", () => {
    const icon = { body: '<circle cx="12" cy="12" r="10"/>' };
    const svg = buildSvg(icon, {});
    expect(svg).toContain('fill="currentColor"');
  });

  test("adds fill to rect elements", () => {
    const icon = { body: '<rect x="0" y="0" width="24" height="24"/>' };
    const svg = buildSvg(icon, {});
    expect(svg).toContain('fill="currentColor"');
  });

  test("adds fill to multiple different elements", () => {
    const icon = { body: '<path d="M0 0"/><circle cx="12" cy="12" r="5"/><rect width="10" height="10"/>' };
    const svg = buildSvg(icon, {});
    // All three elements should have fill added
    const fillCount = (svg.match(/fill="currentColor"/g) || []).length;
    expect(fillCount).toBe(3);
  });

  test("preserves existing fill on specific elements only", () => {
    const icon = { body: '<path fill="red" d="M0 0"/><circle cx="12" cy="12" r="5"/>' };
    const svg = buildSvg(icon, {}, { color: "#000" });
    // Path should keep its red fill, circle should get the color
    expect(svg).toContain('fill="red"');
    expect(svg).toContain('fill="#000"');
  });
});
