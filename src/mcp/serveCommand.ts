import { AeoMcpServer } from "./server.js";
import { startHttpServer } from "./httpServer.js";

const DEFAULT_PORT = 3333;

// `open-aeo serve [--port N]` — run the MCP tools over HTTP so the server can be
// hosted. stdio remains the default (`open-aeo` with no subcommand) for local use.
export function runServeCommand(argv: string[]): void {
  let port = Number(process.env.PORT) || DEFAULT_PORT;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--port") port = Number(argv[++i]);
  }
  if (!Number.isFinite(port) || port <= 0) {
    console.error("--port must be a positive number.");
    process.exit(1);
  }

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    console.error(
      "FATAL ERROR: PERPLEXITY_API_KEY environment variable is missing.",
    );
    process.exit(1);
  }

  const token = process.env.OPEN_AEO_HTTP_TOKEN;
  if (!token) {
    console.error(
      "WARNING: OPEN_AEO_HTTP_TOKEN is not set — the endpoint is unauthenticated. Set it before exposing this server.",
    );
  }

  startHttpServer({
    port,
    token,
    createServerInstance: () => new AeoMcpServer(apiKey),
  });
}
