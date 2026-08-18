import {
  AuthorizationError,
  type AuthRequest,
} from "@cloudflare/workers-oauth-provider";
import type { ExportedHandler } from "@cloudflare/workers-types";
import type { Env } from "../worker.js";
import { sign, verify, generateId } from "../lib/crypto.js";

// The OAuthProvider's defaultHandler (BRG-143): everything that isn't an
// authenticated /mcp request. Implements the two routes the provider itself
// does not (authorizeEndpoint is "not handled by the provider" per its own
// docs), delegating identity to GitHub — mirroring the Jlog project's
// apps/api/src/routes/auth.ts, adapted to hand off to
// env.OAUTH_PROVIDER.completeAuthorization() instead of a session cookie.

const NONCE_COOKIE = "open_aeo_oauth_nonce";
const NONCE_TTL_SECONDS = 10 * 60;

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const withPadding = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  return atob(withPadding);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface GithubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

interface GithubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

async function handleAuthorize(request: Request, env: Env): Promise<Response> {
  let oauthRequest: AuthRequest;
  try {
    oauthRequest = await env.OAUTH_PROVIDER.parseAuthRequest(request);
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    if (!error.redirectUri) {
      return new Response(error.description, { status: 400 });
    }
    const redirect = new URL(error.redirectUri);
    redirect.searchParams.set("error", error.code);
    redirect.searchParams.set("error_description", error.description);
    if (error.state) redirect.searchParams.set("state", error.state);
    return Response.redirect(redirect.toString(), 302);
  }

  const client = await env.OAUTH_PROVIDER.lookupClient(oauthRequest.clientId);
  if (!client) {
    return new Response("Unknown OAuth client", { status: 400 });
  }

  const nonce = await generateId(16);
  const signedNonce = await sign(nonce, env.ENCRYPTION_SECRET);
  const state = base64UrlEncode(JSON.stringify({ nonce, authReq: oauthRequest }));

  const callbackUrl = new URL("/callback", request.url).toString();
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: callbackUrl,
    scope: "read:user user:email",
    state,
  });

  const isLocalhost = new URL(request.url).hostname === "localhost";
  const headers = new Headers({
    Location: `https://github.com/login/oauth/authorize?${params.toString()}`,
  });
  headers.append(
    "Set-Cookie",
    `${NONCE_COOKIE}=${signedNonce}; HttpOnly; Path=/callback; Max-Age=${NONCE_TTL_SECONDS}; SameSite=Lax${isLocalhost ? "" : "; Secure"}`,
  );

  return new Response(null, { status: 302, headers });
}

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

async function upsertUser(
  db: Env["DB"],
  githubUser: GithubUser,
  email: string,
): Promise<{ id: string; login: string }> {
  const existing = await db
    .prepare(`SELECT id FROM users WHERE github_id = ?`)
    .bind(githubUser.id)
    .first<{ id: string }>();

  const userId = existing?.id ?? crypto.randomUUID();

  if (existing) {
    await db
      .prepare(
        `UPDATE users SET login = ?, name = ?, avatar_url = ? WHERE id = ?`,
      )
      .bind(githubUser.login, githubUser.name, githubUser.avatar_url, userId)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO users (id, github_id, login, name, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        userId,
        githubUser.id,
        githubUser.login,
        githubUser.name,
        githubUser.avatar_url,
        new Date().toISOString(),
      )
      .run();
  }

  void email; // reserved for future use (e.g. notifications); not stored today

  return { id: userId, login: githubUser.login };
}

async function handleCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return json({ error: "Missing code or state parameter" }, 400);
  }

  let parsedState: { nonce: string; authReq: AuthRequest };
  try {
    parsedState = JSON.parse(base64UrlDecode(state));
  } catch {
    return json({ error: "Invalid state parameter" }, 400);
  }

  const nonceCookie = getCookie(request, NONCE_COOKIE);
  if (!nonceCookie) {
    return json({ error: "Missing OAuth nonce cookie" }, 400);
  }
  const verifiedNonce = await verify(nonceCookie, env.ENCRYPTION_SECRET);
  if (!verifiedNonce || verifiedNonce !== parsedState.nonce) {
    return json({ error: "Invalid OAuth state" }, 400);
  }

  const callbackUrl = new URL("/callback", request.url).toString();
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: callbackUrl,
    }),
  });
  if (!tokenRes.ok) {
    return json({ error: "Failed to exchange code for token" }, 502);
  }
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
  };
  if (!tokenData.access_token) {
    return json(
      { error: tokenData.error ?? "No access_token in GitHub response" },
      502,
    );
  }

  const authHeader = `token ${tokenData.access_token}`;
  const [userRes, emailsRes] = await Promise.all([
    fetch("https://api.github.com/user", {
      headers: { Authorization: authHeader, "User-Agent": "open-aeo" },
    }),
    fetch("https://api.github.com/user/emails", {
      headers: { Authorization: authHeader, "User-Agent": "open-aeo" },
    }),
  ]);
  if (!userRes.ok || !emailsRes.ok) {
    return json({ error: "Failed to fetch user from GitHub" }, 502);
  }

  const githubUser = (await userRes.json()) as GithubUser;
  const emails = (await emailsRes.json()) as GithubEmail[];
  const primaryEmail =
    emails.find((e) => e.primary && e.verified)?.email ??
    emails.find((e) => e.verified)?.email ??
    githubUser.email;
  if (!primaryEmail) {
    return json({ error: "GitHub account has no verified email address" }, 400);
  }

  const user = await upsertUser(env.DB, githubUser, primaryEmail);

  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: parsedState.authReq,
    userId: user.id,
    metadata: { login: user.login },
    scope: parsedState.authReq.scope,
    props: { userId: user.id, login: user.login },
  });

  const headers = new Headers({ Location: redirectTo });
  headers.append(
    "Set-Cookie",
    `${NONCE_COOKIE}=; HttpOnly; Path=/callback; Max-Age=0`,
  );
  return new Response(null, { status: 302, headers });
}

// `@types/node`'s ambient fetch types (used throughout this file) and
// `@cloudflare/workers-types`' own Request/Response (which ExportedHandler is
// typed against) are structurally close but not identical — this cast is the
// standard escape hatch where the two ambient type packages disagree; at
// runtime on Workers both are the same underlying objects.
export const githubOAuthHandler = {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ status: "ok" });
    }
    if (request.method === "GET" && url.pathname === "/authorize") {
      return handleAuthorize(request, env);
    }
    if (request.method === "GET" && url.pathname === "/callback") {
      return handleCallback(request, env);
    }

    return json({ error: "Not found" }, 404);
  },
} as unknown as ExportedHandler<Env>;
