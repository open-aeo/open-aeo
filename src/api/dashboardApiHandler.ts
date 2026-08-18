import type { ExecutionContext } from "@cloudflare/workers-types";
import { D1Storage } from "../adapters/D1Storage.js";
import { D1KeyStore } from "../adapters/D1KeyStore.js";
import { D1PromptStore } from "../adapters/D1PromptStore.js";
import { KeyProvider } from "../ports/IKeyStore.js";
import { buildEngineRegistry } from "../core/engineFactory.js";
import {
  runChecksAcrossEngines,
  type CheckProgressEvent,
} from "../mcp/tools.js";
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

// Engines a check can be run against. Each still needs its provider key set
// before it will actually run; see handleRunCheck's `skipped` list.
const RUNNABLE_ENGINES: EngineName[] = [
  "perplexity",
  "chatgpt",
  "google-ai-overviews",
];
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
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

// Streamed event shape, one JSON object per line (newline-delimited JSON).
// Reuses CheckProgressEvent from runChecksAcrossEngines directly so the
// stream reflects exactly what the shared check-running code emits, plus a
// terminal "done" or "error" frame the client can key off to stop reading.
type RunCheckStreamEvent =
  | CheckProgressEvent
  | { type: "done"; skipped: EngineName[] }
  | { type: "error"; message: string };

function ndjsonStream(
  produce: (send: (event: RunCheckStreamEvent) => Promise<void>) => Promise<void>,
  ctx: ExecutionContext,
): Response {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const send = (event: RunCheckStreamEvent) =>
    writer.write(encoder.encode(JSON.stringify(event) + "\n")).then(() => undefined);

  const work = produce(send)
    .catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      await send({ type: "error", message }).catch(() => {});
    })
    .finally(() => writer.close().catch(() => {}));
  ctx.waitUntil(work);

  return new Response(readable, {
    headers: {
      "content-type": "application/x-ndjson",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache",
    },
  });
}

async function handleRunCheck(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  userId: string,
): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    query?: string;
    targetDomain?: string;
    brandName?: string;
    engines?: string[];
    samples?: number;
  } | null;

  if (!body?.query || !body.targetDomain) {
    return json({ error: "query and targetDomain are required" }, 400);
  }
  const requested = (body.engines ?? []).filter((e): e is EngineName =>
    RUNNABLE_ENGINES.includes(e as EngineName),
  );
  if (requested.length === 0) {
    return json(
      { error: `engines must include at least one of: ${RUNNABLE_ENGINES.join(", ")}` },
      400,
    );
  }

  const samples = Math.min(
    MAX_SAMPLES,
    Math.max(1, Math.floor(body.samples ?? 1)),
  );

  const keyStore = new D1KeyStore(env.DB, userId, env.ENCRYPTION_SECRET);
  const perplexityApiKey = (await keyStore.getKey("perplexity")) ?? "";
  const openAiApiKey = (await keyStore.getKey("openai")) ?? undefined;
  const dataForSeoCredentials =
    (await keyStore.getKey("dataforseo")) ?? undefined;
  const registry = buildEngineRegistry({
    perplexityApiKey,
    openAiApiKey,
    dataForSeoCredentials,
  });

  // Run whichever requested engines actually have a key configured; report
  // the rest as skipped rather than failing the whole request over one
  // missing key (each engine's key is independent).
  const configured = requested.filter((name) => registry.has(name));
  const skipped = requested.filter((name) => !registry.has(name));
  if (configured.length === 0) {
    return json(
      {
        error: `No API key set for ${requested.join(", ")}. Set one in Settings first.`,
      },
      400,
    );
  }
  const engines = registry.resolve(configured);
  const { query, targetDomain, brandName } = body;

  return ndjsonStream(async (send) => {
    const storage = new D1Storage(env.DB, userId);
    await runChecksAcrossEngines(
      engines,
      storage,
      { query, targetDomain, brandName },
      samples > 1 || engines.length > 1 ? 1500 : 0,
      samples,
      (event) => {
        void send(event);
      },
    );
    await send({ type: "done", skipped });
  }, ctx);
}

async function handleGetKeys(env: Env, userId: string): Promise<Response> {
  const keyStore = new D1KeyStore(env.DB, userId, env.ENCRYPTION_SECRET);
  const [perplexity, openai, dataforseo] = await Promise.all([
    keyStore.getKey("perplexity"),
    keyStore.getKey("openai"),
    keyStore.getKey("dataforseo"),
  ]);
  return json({
    perplexity: perplexity !== null,
    openai: openai !== null,
    dataforseo: dataforseo !== null,
  });
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

  const providers: KeyProvider[] = ["perplexity", "openai", "dataforseo"];
  if (
    !body?.provider ||
    !providers.includes(body.provider as KeyProvider) ||
    !body.apiKey
  ) {
    return json(
      {
        error: `provider (${providers
          .map((p) => `'${p}'`)
          .join(" | ")}) and apiKey are required`,
      },
      400,
    );
  }

  // DataForSEO authenticates with a login:password pair rather than a single
  // token. Reject a malformed pair here so a stored key is always usable;
  // otherwise the failure surfaces much later, as a broken check run.
  if (body.provider === "dataforseo" && !body.apiKey.includes(":")) {
    return json(
      { error: "DataForSEO credentials must be in 'login:password' form" },
      400,
    );
  }

  const keyStore = new D1KeyStore(env.DB, userId, env.ENCRYPTION_SECRET);
  await keyStore.setKey(body.provider as KeyProvider, body.apiKey);
  return json({ ok: true });
}

async function handleListPrompts(env: Env, userId: string): Promise<Response> {
  const promptStore = new D1PromptStore(env.DB, userId);
  const storage = new D1Storage(env.DB, userId);
  const prompts = await promptStore.list();

  const withHistory = await Promise.all(
    prompts.map(async (prompt) => {
      const history = (await storage.getHistory(prompt.query)).filter(
        (r) => r.targetDomain.toLowerCase() === prompt.targetDomain.toLowerCase(),
      );
      const lastResult = history.at(-1) ?? null;
      const trend = computeTrend(history);
      return { ...prompt, lastResult, trend };
    }),
  );

  return json({ prompts: withHistory });
}

async function handleCreatePrompt(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    query?: string;
    targetDomain?: string;
    brandName?: string;
    engines?: string[];
  } | null;

  if (!body?.query || !body.targetDomain) {
    return json({ error: "query and targetDomain are required" }, 400);
  }
  const engines = (body.engines ?? []).filter((e): e is EngineName =>
    RUNNABLE_ENGINES.includes(e as EngineName),
  );
  if (engines.length === 0) {
    return json(
      { error: `engines must include at least one of: ${RUNNABLE_ENGINES.join(", ")}` },
      400,
    );
  }

  const promptStore = new D1PromptStore(env.DB, userId);
  const prompt = await promptStore.create({
    query: body.query,
    targetDomain: body.targetDomain,
    brandName: body.brandName ?? null,
    engines,
  });
  return json({ prompt }, 201);
}

async function handleDeletePrompt(
  env: Env,
  userId: string,
  id: string,
): Promise<Response> {
  const promptStore = new D1PromptStore(env.DB, userId);
  await promptStore.delete(id);
  return json({ ok: true });
}

async function handleCompetitors(
  env: Env,
  userId: string,
  targetDomain: string | undefined,
): Promise<Response> {
  const storage = new D1Storage(env.DB, userId);
  const allHistory = await storage.getHistory();

  // "Competitors" only means something relative to one target domain — mixing
  // checks for different domains together would merge unrelated competitor
  // sets. Report the domains actually present so the client can offer a
  // selector, and default to the first one if none was requested.
  const availableDomains = [...new Set(allHistory.map((r) => r.targetDomain))].sort();
  const selectedDomain = targetDomain ?? availableDomains[0];

  const history = selectedDomain
    ? allHistory.filter(
        (r) => r.targetDomain.toLowerCase() === selectedDomain.toLowerCase(),
      )
    : [];

  const breakdown = computeSourcesBreakdown(history);
  const citedCount = history.filter((r) => r.cited).length;
  const yourCitedRate = history.length > 0 ? citedCount / history.length : 0;

  const domains = breakdown.domains.map((d) => ({
    ...d,
    // Share of your checks this domain showed up in, so it's directly
    // comparable to yourCitedRate rather than a raw appearance count.
    shareOfChecks: breakdown.checksAnalysed > 0 ? d.appearances / breakdown.checksAnalysed : 0,
  }));

  return json({
    targetDomain: selectedDomain ?? null,
    availableDomains,
    yourCitedRate,
    checksAnalysed: breakdown.checksAnalysed,
    domains,
  });
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
    return handleRunCheck(request, env, ctx, userId);
  }
  if (request.method === "POST" && url.pathname === "/api/keys") {
    return handleSetKey(request, env, userId);
  }
  if (request.method === "GET" && url.pathname === "/api/keys") {
    return handleGetKeys(env, userId);
  }
  if (request.method === "GET" && url.pathname === "/api/prompts") {
    return handleListPrompts(env, userId);
  }
  if (request.method === "POST" && url.pathname === "/api/prompts") {
    return handleCreatePrompt(request, env, userId);
  }
  const promptIdMatch = url.pathname.match(/^\/api\/prompts\/([^/]+)$/);
  if (request.method === "DELETE" && promptIdMatch) {
    return handleDeletePrompt(env, userId, promptIdMatch[1]);
  }
  if (request.method === "GET" && url.pathname === "/api/competitors") {
    const targetDomain = url.searchParams.get("targetDomain") ?? undefined;
    return handleCompetitors(env, userId, targetDomain);
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
