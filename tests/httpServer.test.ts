import { describe, it, expect, afterEach } from "vitest";
import { once } from "node:events";
import { AddressInfo } from "node:net";
import { Server } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { startHttpServer } from "../src/mcp/httpServer.js";
import { AeoMcpServer } from "../src/mcp/server.js";

const TOKEN = "test-secret";

async function startTestServer(token?: string): Promise<{
  server: Server;
  url: URL;
}> {
  const server = startHttpServer({
    port: 0, // ephemeral
    token,
    // A dummy key is fine: constructing does no network I/O, and initialize /
    // tools/list never call an engine.
    createServerInstance: () => new AeoMcpServer("test-key"),
  });
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  return { server, url: new URL(`http://127.0.0.1:${port}/mcp`) };
}

let openServer: Server | undefined;
afterEach(async () => {
  if (openServer) {
    await new Promise((resolve) => openServer!.close(() => resolve(null)));
    openServer = undefined;
  }
});

describe("startHttpServer (Streamable HTTP)", () => {
  it("serves the MCP tools to an authenticated client", async () => {
    const { server, url } = await startTestServer(TOKEN);
    openServer = server;

    const client = new Client({ name: "test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } },
    });
    await client.connect(transport);

    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name);
    expect(names).toContain("aeo_check");
    expect(names).toContain("aeo_sources");
    expect(names).toContain("aeo_generate_queries");

    await client.close();
  });

  it("rejects a request without the bearer token", async () => {
    const { server, url } = await startTestServer(TOKEN);
    openServer = server;

    const client = new Client({ name: "test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(url); // no auth header
    await expect(client.connect(transport)).rejects.toThrow();
  });

  it("answers a health check without a token", async () => {
    const { server, url } = await startTestServer(TOKEN);
    openServer = server;

    const health = await fetch(new URL("/health", url.origin));
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
  });
});
