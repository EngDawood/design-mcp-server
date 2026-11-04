import { describe, test, expect } from "bun:test";
import { createProviders } from "../src/providers/registry.js";
import { loadConfig } from "../src/config.js";

describe("createProviders — the registry", () => {
  test("assembles all ten providers with unique names", () => {
    const providers = createProviders(loadConfig({}));
    const names = providers.map((p) => p.name);
    expect(names).toEqual([
      "iconify",
      "svgrepo",
      "openmoji",
      "wikimedia",
      "storyset",
      "flaticon",
      "pexels",
      "unsplash",
      "pixabay",
      "logo-dev",
    ]);
    expect(new Set(names).size).toBe(names.length);
  });

  test("keyless providers are available; keyed ones wait for config", () => {
    const byName = new Map(createProviders(loadConfig({})).map((p) => [p.name, p.available]));
    for (const name of ["iconify", "svgrepo", "openmoji", "wikimedia", "storyset"]) {
      expect(byName.get(name)).toBe(true);
    }
    for (const name of ["flaticon", "pexels", "unsplash", "pixabay", "logo-dev"]) {
      expect(byName.get(name)).toBe(false);
    }
  });

  test("svgrepo carries its experimental note", () => {
    const svgrepo = createProviders(loadConfig({})).find((p) => p.name === "svgrepo");
    expect(svgrepo!.note).toContain("Experimental");
    expect(svgrepo!.note).toContain("no official API");
  });
});
