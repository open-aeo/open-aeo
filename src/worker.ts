import type {
  D1Database,
  KVNamespace,
  ExecutionContext,
} from "@cloudflare/workers-types";
import OAuthProvider, {
  type OAuthHelpers,
} from "@cloudflare/workers-oauth-provider";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { AeoMcpServer } from "./mcp/server.js";
import { D1Storage } from "./adapters/D1Storage.js";
import { D1KeyStore } from "./adapters/D1KeyStore.js";
import { githubOAuthHandler } from "./mcp/githubOAuthHandler.js";
import { handleDashboardApiRequest } from "./api/dashboardApiHandler.js";

// Cloudflare Workers entry point. Serves the open-aeo MCP tools over the
// web-standard Streamable HTTP transport (Request -> Response). Authenticated
// via GitHub OAuth (BRG-143): @cloudflare/workers-oauth-provider handles the
// MCP-facing OAuth 2.1 mechanics (PKCE, dynamic client registration, token
// issuance/metadata) in front of /mcp; ./mcp/githubOAuthHandler.ts implements
// the /authorize + /callback routes that delegate identity to GitHub. The
// Node `serve` command (mcp/httpServer.ts) is unaffected — separate,
// single-tenant deployment target, still on a static bearer token.
//
// Storage and provider keys are both D1-backed and scoped per authenticated
// user (env.DB, see migrations/0001_init.sql + 0002_users_and_keys.sql).
export interface Env {
  DB: D1Database;
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  ENCRYPTION_SECRET: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface AuthProps {
  userId: string;
  login: string;
}

async function handleMcpRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed; use POST" }, 405);
  }

  const props = ctx.props as AuthProps | undefined;
  if (!props?.userId) {
    return json({ error: "Unauthorized" }, 401);
  }

  const keyStore = new D1KeyStore(env.DB, props.userId, env.ENCRYPTION_SECRET);
  const perplexityApiKey = (await keyStore.getKey("perplexity")) ?? "";
  const openAiApiKey = (await keyStore.getKey("openai")) ?? undefined;
  const dataForSeoCredentials =
    (await keyStore.getKey("dataforseo")) ?? undefined;

  try {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const mcp = new AeoMcpServer(perplexityApiKey, {
      storage: new D1Storage(env.DB, props.userId),
      openAiApiKey,
      dataForSeoCredentials,
      keyStore,
    });
    await mcp.connect(transport);
    return await transport.handleRequest(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, 500);
  }
}

export default new OAuthProvider<Env>({
  apiHandlers: {
    "/mcp": { fetch: handleMcpRequest },
    "/api": { fetch: handleDashboardApiRequest },
  },
  defaultHandler: githubOAuthHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
  scopesSupported: ["profile"],
});
