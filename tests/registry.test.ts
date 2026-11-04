import { test, expect, describe } from "bun:test";
import { PROVIDERS, listProviderSummaries } from "../src/core/registry.js";
import { providerEnabled, type DesignProvider } from "../src/core/provider.js";

describe("PROVIDERS registry", () => {
  test("contains the iconify provider", () => {
    const iconify = PROVIDERS.find((p) => p.id === "iconify");
    expect(iconify).toBeDefined();
    expect(iconify?.displayName).toBe("Iconify");
    expect(iconify?.kinds).toContain("icon");
    expect(typeof iconify?.register).toBe("function");
  });

  test("provider ids are unique", () => {
    const ids = PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("provider ids are tool-safe (each one prefixes its tool names)", () => {
    // The contract makes the id the tool prefix; ids must stay tool-safe.
    for (const p of PROVIDERS) {
      expect(p.id).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});

describe("listProviderSummaries", () => {
  test("reports iconify as enabled with an empty env (it needs no keys)", () => {
    const summaries = listProviderSummaries({});
    const iconify = summaries.find((s) => s.id === "iconify");
    expect(iconify).toBeDefined();
    expect(iconify?.enabled).toBe(true);
    expect(iconify?.displayName).toBe("Iconify");
    expect(iconify?.kinds).toEqual(["icon"]);
  });

  test("summaries cover every registered provider exactly once", () => {
    const summaries = listProviderSummaries({});
    expect(summaries.map((s) => s.id).sort()).toEqual(PROVIDERS.map((p) => p.id).sort());
  });
});

describe("providerEnabled (the disabled-provider seam)", () => {
  const keyedProvider: DesignProvider = {
    id: "keyed",
    displayName: "Keyed",
    description: "Stub provider that needs an API key.",
    kinds: ["icon"],
    requiresEnv: ["KEYED_API_KEY"],
    register: () => {},
  };

  test("a provider with requiresEnv is disabled when the key is missing or empty", () => {
    expect(providerEnabled(keyedProvider, {})).toBe(false);
    expect(providerEnabled(keyedProvider, { KEYED_API_KEY: "" })).toBe(false);
    expect(providerEnabled(keyedProvider, { OTHER_KEY: "x" })).toBe(false);
  });

  test("a provider with requiresEnv is enabled when the key is set", () => {
    expect(providerEnabled(keyedProvider, { KEYED_API_KEY: "secret" })).toBe(true);
  });

  test("a keyless provider is always enabled", () => {
    const keyless: DesignProvider = { ...keyedProvider, id: "keyless", requiresEnv: undefined };
    expect(providerEnabled(keyless, {})).toBe(true);
  });
});
