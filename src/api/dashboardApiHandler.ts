import type { ExecutionContext } from "@cloudflare/workers-types";
import { D1Storage } from "../adapters/D1Storage.js";
import { D1KeyStore } from "../adapters/D1KeyStore.js";
import { KeyProvider } from "../ports/IKeyStore.js";
import { buildEngineRegistry } from "../core/engineFactory.js";
import { runSingleCheck } from "../mcp/tools.js";
import { computeSourcesBreakdown } from "../core/sourcesBreakdown.js";
import { computeTrend } from "../core/trends.js";
import { EngineName } from "../core/types.js";
import type { Env } from "../worker.js";

// REST API for the web dashboard (BRG-145). Reuses the same OAuth 2.1
// provider already stood up for MCP clients (BRG-143) — the dashboard is
// just another bearer-token client of /authorize + /token, so this handler
// only ever runs for a request the provider has already authenticated;
// ctx.props carries the same { userId, login } shape as the MCP path.
//
// Read endpoints mirror the equivalent MCP tools' storage calls directly.
// The run-check and keys endpoints reuse the exact same building blocks the
// MCP path uses (buildEngineRegistry, runSingleCheck, D1KeyStore) so a check
// run from the dashboard behaves identically to one run from an MCP client.

interface AuthProps {
  userId: string;
  login: string;
}

// Engines that actually run today (google-ai-overviews is a registered
// extension point only — see src/adapters/GoogleAiOverviews.ts).
const RUNNABLE_ENGINES: EngineName[] = ["perplexity", "chatgpt"];
const MAX_SAMPLES = 10;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function corsPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

async function handleRunCheck(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    query?: string;
    targetDomain?: string;
    brandName?: string;
    engine?: string;
    samples?: number;
  } | null;

  if (!body?.query || !body.targetDomain) {
    return json({ error: "query and targetDomain are required" }, 400);
  }
  if (!body.engine || !RUNNABLE_ENGINES.includes(body.engine as EngineName)) {
    return json(
      { error: `engine must be one of: ${RUNNABLE_ENGINES.join(", ")}` },
      400,
    );
  }

  const engineName = body.engine as EngineName;
  const samples = Math.min(
    MAX_SAMPLES,
    Math.max(1, Math.floor(body.samples ?? 1)),
  );

  const keyStore = new D1KeyStore(env.DB, userId, env.ENCRYPTION_SECRET);
  const perplexityApiKey = (await keyStore.getKey("perplexity")) ?? "";
  const openAiApiKey = (await keyStore.getKey("openai")) ?? undefined;
  const registry = buildEngineRegistry({ perplexityApiKey, openAiApiKey });

  let engine;
  try {
    [engine] = registry.resolve([engineName]);
  } catch {
    return json(
      {
        error: `No API key set for ${engineName}. Set one in Settings first.`,
      },
      400,
    );
  }

  const storage = new D1Storage(env.DB, userId);
  try {
    const result = await runSingleCheck(
      engine,
      storage,
      {
        query: body.query,
        targetDomain: body.targetDomain,
        brandName: body.brandName,
      },
      samples,
      samples > 1 ? 1500 : 0,
    );
    return json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, 502);
  }
}

async function handleGetKeys(env: Env, userId: string): Promise<Response> {
  const keyStore = new D1KeyStore(env.DB, userId, env.ENCRYPTION_SECRET);
  const [perplexity, openai] = await Promise.all([
    keyStore.getKey("perplexity"),
    keyStore.getKey("openai"),
  ]);
  return json({ perplexity: perplexity !== null, openai: openai !== null });
}

async function handleSetKey(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    provider?: string;
    apiKey?: string;
  } | null;

  if (
    !body?.provider ||
    (body.provider !== "perplexity" && body.provider !== "openai") ||
    !body.apiKey
  ) {
    return json(
      { error: "provider ('perplexity' | 'openai') and apiKey are required" },
      400,
    );
  }

  const keyStore = new D1KeyStore(env.DB, userId, env.ENCRYPTION_SECRET);
  await keyStore.setKey(body.provider as KeyProvider, body.apiKey);
  return json({ ok: true });
}

export async function handleDashboardApiRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return corsPreflight();
  }

  const props = ctx.props as AuthProps | undefined;
  if (!props?.userId) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const { userId } = props;

  if (request.method === "POST" && url.pathname === "/api/run-check") {
    return handleRunCheck(request, env, userId);
  }
  if (request.method === "POST" && url.pathname === "/api/keys") {
    return handleSetKey(request, env, userId);
  }
  if (request.method === "GET" && url.pathname === "/api/keys") {
    return handleGetKeys(env, userId);
  }

  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const storage = new D1Storage(env.DB, userId);

  if (url.pathname === "/api/me") {
    return json({ userId: props.userId, login: props.login });
  }

  if (url.pathname === "/api/checks") {
    const query = url.searchParams.get("query") ?? undefined;
    const domain = url.searchParams.get("domain") ?? undefined;
    let history = await storage.getHistory(query);
    if (domain) {
      const lowerDomain = domain.toLowerCase();
      history = history.filter((r) =>
        r.targetDomain.toLowerCase().includes(lowerDomain),
      );
    }
    return json({ checks: history });
  }

  if (url.pathname === "/api/gap-history") {
    const domain = url.searchParams.get("domain") ?? undefined;
    const gapHistory = await storage.getGapHistory(domain);
    return json({ gapHistory });
  }

  if (url.pathname === "/api/sources") {
    const targetDomain = url.searchParams.get("targetDomain") ?? undefined;
    const query = url.searchParams.get("query") ?? undefined;
    const history = await storage.getHistory();
    const breakdown = computeSourcesBreakdown(history, { targetDomain, query });
    return json(breakdown);
  }

  if (url.pathname === "/api/trends") {
    const targetDomain = url.searchParams.get("targetDomain") ?? undefined;
    const query = url.searchParams.get("query") ?? undefined;
    const history = await storage.getHistory();
    const trend = computeTrend(history, { targetDomain, query });
    return json({ trend });
  }

  return json({ error: "Not found" }, 404);
}
