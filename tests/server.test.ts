import { test, expect, describe } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createDesignServer } from "../src/server.js";

async function connectClient(env: Record<string, string | undefined> = {}) {
  const server = createDesignServer(env);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "design-mcp-server-test", version: "0.0.0" });
  await client.connect(clientTransport);
  return client;
}

async function callText(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<string> {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as { type: string; text?: string }[];
  return content.find((c) => c.type === "text")?.text ?? "";
}

const CROSS_TOOLS = [
  "search_icons",
  "search_logos",
  "search_stock_photos",
  "search_vectors",
  "search_emoji",
  "suggest_asset",
  "get_asset",
  "list_providers",
];

const STORYSET_TOOLS = [
  "storyset_search",
  "storyset_get_illustration",
  "storyset_download",
  "storyset_extract_palette",
  "storyset_recolor_svg",
];

describe("createDesignServer", () => {
  test("exposes the cross-provider tools plus Storyset's escape-hatch tools", async () => {
    const client = await connectClient();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    for (const name of [...CROSS_TOOLS, ...STORYSET_TOOLS]) {
      expect(names).toContain(name);
    }
    await client.close();
  });

  test("list_providers lists all ten providers; flaticon is NOT CONFIGURED without a key", async () => {
    const client = await connectClient();
    const text = await callText(client, "list_providers");
    for (const name of [
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
    ]) {
      expect(text).toContain(`- ${name} [`);
    }
    expect(text).toContain("- flaticon [NOT CONFIGURED]");
    expect(text).toContain("FLATICON_API_KEY");
    expect(text).toContain("Total: 10 providers (5 ready)");
    await client.close();
  });

  test("list_providers flags svgrepo as experimental", async () => {
    const client = await connectClient();
    const text = await callText(client, "list_providers");
    expect(text).toContain("Experimental: SVG Repo exposes no official API");
    await client.close();
  });

  test("with FLATICON_API_KEY set, flaticon reports READY", async () => {
    const client = await connectClient({ FLATICON_API_KEY: "test-key" });
    const text = await callText(client, "list_providers");
    expect(text).toContain("- flaticon [READY]");
    expect(text).toContain("Total: 10 providers (6 ready)");
    await client.close();
  });
});
