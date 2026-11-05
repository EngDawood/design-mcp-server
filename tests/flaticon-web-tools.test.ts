import { describe, test, expect } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerSearchTools } from "../src/tools/search-tools.js";
import { registerListProvidersTool } from "../src/tools/list-providers.js";
import { FlaticonWebProvider } from "../src/providers/flaticon-web.js";
import type { FetchLike } from "../src/providers/flaticon-web-core.js";
import type { Provider } from "../src/types.js";

/**
 * The tool seam: flaticon-web joins the merged search_icons tool, and
 * its failure mode — flaticon.com's bot filter refusing the network —
 * is isolated per provider: other providers' results still come back,
 * with a failure section naming flaticon-web and the block.
 */

const iconifyStub: Provider = {
  name: "iconify",
  available: true,
  async search({ query }) {
    return {
      assets: [
        {
          id: "iconify:mdi:cat",
          type: "icon" as const,
          title: "Cat",
          url: "https://api.iconify.design/mdi/cat.svg",
          format: "svg" as const,
          license: "mit" as const,
          source: "Iconify",
        },
      ],
      total: 1,
      provider: "iconify",
      query,
    };
  },
};

const blockedFetch = (async () =>
  new Response("<title>Our security filter flagged something.</title>", {
    status: 403,
    headers: { "Content-Type": "text/html" },
  })) as FetchLike;

async function connectWith(providers: Provider[]) {
  const server = new McpServer({ name: "flaticon-web-tools-test", version: "0.0.0" });
  registerSearchTools(server, providers);
  registerListProvidersTool(server, providers);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "flaticon-web-tools-test", version: "0.0.0" });
  await client.connect(clientTransport);
  return client;
}

async function callText(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as { type: string; text?: string }[];
  return content.find((c) => c.type === "text")?.text ?? "";
}

describe("flaticon-web in the cross-provider tools", () => {
  test("search_icons isolates a blocked flaticon-web: iconify results survive", async () => {
    const client = await connectWith([
      iconifyStub,
      new FlaticonWebProvider({ fetchFn: blockedFetch }),
    ]);
    const text = await callText(client, "search_icons", { query: "cat" });
    // The healthy provider's results are there…
    expect(text).toContain("iconify results");
    expect(text).toContain("Cat");
    // …and flaticon-web's failure is a named section, not a crash or silence.
    expect(text).toContain('Provider "flaticon-web" failed:');
    expect(text).toContain("blocked");
    await client.close();
  });

  test("list_providers shows flaticon-web READY with its experimental note", async () => {
    const client = await connectWith([new FlaticonWebProvider()]);
    const text = await callText(client, "list_providers");
    expect(text).toContain("- flaticon-web [READY]");
    expect(text).toContain("Experimental: unofficial web access, no API key");
    await client.close();
  });
});
