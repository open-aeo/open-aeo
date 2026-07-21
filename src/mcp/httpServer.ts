import {
  createServer,
  IncomingMessage,
  ServerResponse,
  Server,
} from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { AeoMcpServer } from "./server.js";

const MCP_PATH = "/mcp";

export interface HttpServerOptions {
  port: number;
  // When set, every /mcp request must carry `Authorization: Bearer <token>`.
  // The server holds provider API keys and runs paid calls, so an exposed
  // instance should always set this.
  token?: string;
  // Builds a fresh MCP server per request (stateless mode). Injected so the
  // wiring is testable with a stub server.
  createServerInstance: () => AeoMcpServer;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("error", reject);
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8");
      if (raw.trim() === "") {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function isAuthorized(req: IncomingMessage, token?: string): boolean {
  if (!token) return true;
  return req.headers["authorization"] === `Bearer ${token}`;
}

// Serve the open-aeo MCP tools over Streamable HTTP so the server can be hosted
// and connected to remotely, instead of only as a local stdio subprocess.
//
// Stateless mode: each POST builds a fresh server + transport, answers, and tears
// down. Simple and correct for a single-tenant hosted instance; multi-tenant
// sessions come with the accounts work.
export function startHttpServer(options: HttpServerOptions): Server {
  const httpServer = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      const path = (req.url ?? "").split("?")[0];

      if (req.method === "GET" && path === "/health") {
        sendJson(res, 200, { status: "ok" });
        return;
      }

      if (path !== MCP_PATH) {
        sendJson(res, 404, { error: "Not found" });
        return;
      }

      if (!isAuthorized(req, options.token)) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }

      if (req.method !== "POST") {
        // Stateless mode has no server-initiated SSE stream to attach to.
        sendJson(res, 405, { error: "Method not allowed; use POST" });
        return;
      }

      try {
        const body = await readBody(req);
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        });
        res.on("close", () => {
          void transport.close();
        });
        const mcp = options.createServerInstance();
        await mcp.connect(transport);
        await transport.handleRequest(req, res, body);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!res.headersSent) {
          sendJson(res, 500, { error: message });
        }
      }
    },
  );

  httpServer.listen(options.port, () => {
    const address = httpServer.address();
    const port =
      typeof address === "object" && address ? address.port : options.port;
    console.error(
      `open-aeo MCP server listening on http://localhost:${port}${MCP_PATH}` +
        (options.token
          ? " (bearer token required)"
          : " (no token — set OPEN_AEO_HTTP_TOKEN)"),
    );
  });

  return httpServer;
}
