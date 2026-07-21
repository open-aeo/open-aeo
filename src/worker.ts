import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { AeoMcpServer } from "./mcp/server.js";
import { MemoryStorage } from "./adapters/MemoryStorage.js";

// Cloudflare Workers entry point. Serves the open-aeo MCP tools over the
// web-standard Streamable HTTP transport (Request -> Response), so the server can
// be hosted on Workers. The Node `serve` command (mcp/httpServer.ts) is the
// equivalent for container hosts; this is the fetch-based variant.
//
// Storage is in-memory and per-request (no filesystem on Workers), so history
// does not persist yet — a durable D1/KV backend is tracked in BRG-142.
export interface Env {
  PERPLEXITY_API_KEY: string;
  OPENAI_API_KEY?: string;
  OPEN_AEO_HTTP_TOKEN?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ status: "ok" });
    }

    if (url.pathname !== "/mcp") {
      return json({ error: "Not found" }, 404);
    }

    if (!env.PERPLEXITY_API_KEY) {
      return json({ error: "Server is missing PERPLEXITY_API_KEY" }, 500);
    }

    // The endpoint holds provider keys and runs paid calls, so require the token.
    if (
      env.OPEN_AEO_HTTP_TOKEN &&
      request.headers.get("authorization") !==
        `Bearer ${env.OPEN_AEO_HTTP_TOKEN}`
    ) {
      return json({ error: "Unauthorized" }, 401);
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed; use POST" }, 405);
    }

    try {
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      const mcp = new AeoMcpServer(env.PERPLEXITY_API_KEY, {
        storage: new MemoryStorage(),
        openAiApiKey: env.OPENAI_API_KEY,
      });
      await mcp.connect(transport);
      return await transport.handleRequest(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return json({ error: message }, 500);
    }
  },
};
