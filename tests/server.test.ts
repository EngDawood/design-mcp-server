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

describe("createDesignServer", () => {
  test("exposes list_providers plus the three iconify tools", async () => {
    const client = await connectClient();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain("list_providers");
    expect(names).toContain("iconify_search_icons");
    expect(names).toContain("iconify_get_icon");
    expect(names).toContain("iconify_list_collections");
    await client.close();
  });

  test("list_providers reports iconify as enabled", async () => {
    const client = await connectClient();
    const result = await client.callTool({ name: "list_providers", arguments: {} });
    const content = result.content as { type: string; text?: string }[];
    const text = content.find((c) => c.type === "text")?.text ?? "";
    const payload = JSON.parse(text) as {
      providers: { id: string; enabled: boolean }[];
    };
    const iconify = payload.providers.find((p) => p.id === "iconify");
    expect(iconify).toBeDefined();
    expect(iconify?.enabled).toBe(true);
    await client.close();
  });
});
