// OAuth 2.1 Authorization Code + PKCE, public client — the dashboard is just
// another client of the same server the MCP clients authenticate against
// (BRG-143's @cloudflare/workers-oauth-provider). No cookies, no separate
// GitHub OAuth App: log in, get a bearer token, send it as Authorization on
// every /api/* request.

const API_BASE = import.meta.env.PUBLIC_API_URL;
const CLIENT_ID_KEY = "open_aeo_client_id";
const TOKEN_KEY = "open_aeo_access_token";
const PKCE_KEY = "open_aeo_pkce"; // sessionStorage: { verifier, state }

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return new Uint8Array(digest);
}

function randomString(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function getOrRegisterClientId(): Promise<string> {
  const cached = localStorage.getItem(CLIENT_ID_KEY);
  if (cached) return cached;

  const res = await fetch(`${API_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "open-aeo dashboard",
      redirect_uris: [`${window.location.origin}/callback`],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    }),
  });
  if (!res.ok) {
    throw new Error(`Client registration failed: ${res.status}`);
  }
  const client = (await res.json()) as { client_id: string };
  localStorage.setItem(CLIENT_ID_KEY, client.client_id);
  return client.client_id;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return getAccessToken() !== null;
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function startLogin(): Promise<void> {
  const clientId = await getOrRegisterClientId();
  const verifier = randomString(48);
  const state = randomString(16);
  const challenge = base64UrlEncode(await sha256(verifier));

  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state }));

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: `${window.location.origin}/callback`,
    scope: "profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  window.location.href = `${API_BASE}/authorize?${params.toString()}`;
}

export async function completeLogin(url: URL): Promise<void> {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    throw new Error("Missing code or state in callback URL");
  }

  const stored = sessionStorage.getItem(PKCE_KEY);
  if (!stored) throw new Error("Missing PKCE verifier — try logging in again");
  const { verifier, state: expectedState } = JSON.parse(stored) as {
    verifier: string;
    state: string;
  };
  if (state !== expectedState) throw new Error("OAuth state mismatch");

  const clientId = await getOrRegisterClientId();
  const res = await fetch(`${API_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${window.location.origin}/callback`,
      client_id: clientId,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status}`);
  }
  const token = (await res.json()) as { access_token: string };
  localStorage.setItem(TOKEN_KEY, token.access_token);
  sessionStorage.removeItem(PKCE_KEY);
}
