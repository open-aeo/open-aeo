import type { ExecutionContext } from "@cloudflare/workers-types";
import { D1Storage } from "../adapters/D1Storage.js";
import { computeSourcesBreakdown } from "../core/sourcesBreakdown.js";
import { computeTrend } from "../core/trends.js";
import type { Env } from "../worker.js";

// Read-only REST API for the web dashboard (BRG-145). Reuses the same OAuth
// 2.1 provider already stood up for MCP clients (BRG-143) — the dashboard is
// just another bearer-token client of /authorize + /token, so this handler
// only ever runs for a request the provider has already authenticated;
// ctx.props carries the same { userId, login } shape as the MCP path.

interface AuthProps {
  userId: string;
  login: string;
}

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
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
    },
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

  if (request.method !== "GET") {
    return json({ error: "Method not allowed; use GET" }, 405);
  }

  const url = new URL(request.url);
  const storage = new D1Storage(env.DB, props.userId);

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
