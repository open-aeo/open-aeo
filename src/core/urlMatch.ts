// URL and brand matching helpers for citation detection.
//
// The naive approach (`url.toLowerCase().includes(domain)`) is both too loose and
// too strict: "linear.app" matches "linear.app.spam.com" and "mylinear.app"
// (false positives), while tracking params and www/subdomain differences make the
// same page look like several. These helpers match on the URL host with proper
// boundaries and canonicalize away the noise.

// Query params that identify a click source, not a page. Stripped when
// canonicalizing so the same page is not counted twice across engines
// (e.g. OpenAI appends ?utm_source=openai to every citation).
const TRACKING_PARAM_PREFIXES = ["utm_"];
const TRACKING_PARAMS = new Set([
  "ref",
  "fbclid",
  "gclid",
  "gbraid",
  "wbraid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "source",
  "spm",
]);

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

function toUrl(rawUrl: string): URL | null {
  const trimmed = (rawUrl ?? "").trim();
  if (trimmed === "") return null;
  const input = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

function normalizeHost(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\.$/, "");
}

// The registrable host of a URL, lower-cased with a leading "www." and trailing
// dot removed. Accepts inputs with or without a scheme. Returns null if the input
// cannot be parsed as a URL.
export function extractHost(rawUrl: string): string | null {
  const url = toUrl(rawUrl);
  if (!url) return null;
  const host = normalizeHost(url.hostname);
  return host === "" ? null : host;
}

// Normalize a user-supplied target domain (which may arrive as "notion.so",
// "https://notion.so/", or "www.notion.so") down to a bare host.
export function normalizeDomain(domain: string): string | null {
  return extractHost(domain);
}

// True when a citation URL belongs to the target domain: an exact host match or a
// subdomain of it. Boundary-correct, so "linear.app" matches "docs.linear.app"
// but NOT "linear.app.spam.com" or "notlinear.app".
export function urlMatchesDomain(
  rawUrl: string,
  targetDomain: string,
): boolean {
  const host = extractHost(rawUrl);
  const domain = normalizeDomain(targetDomain);
  if (!host || !domain) return false;
  return host === domain || host.endsWith(`.${domain}`);
}

// Canonical key for de-duplication: host (no www) + path (no trailing slash),
// tracking params removed, fragment dropped. Falls back to the trimmed input when
// it cannot be parsed, so nothing is silently dropped.
export function canonicalizeUrl(rawUrl: string): string {
  const trimmed = (rawUrl ?? "").trim();
  const url = toUrl(trimmed);
  if (!url) return trimmed;

  const host = normalizeHost(url.hostname);
  const params = new URLSearchParams(url.search);
  for (const key of [...params.keys()]) {
    const lower = key.toLowerCase();
    const isTracking =
      TRACKING_PARAMS.has(lower) ||
      TRACKING_PARAM_PREFIXES.some((prefix) => lower.startsWith(prefix));
    if (isTracking) params.delete(key);
  }

  const path = url.pathname.replace(/\/+$/, "");
  const query = params.toString();
  return `${host}${path}${query ? `?${query}` : ""}`;
}

// De-duplicate URLs by canonical form, preserving first-seen order and the
// original strings (so the caller still shows real, clickable URLs).
export function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    const key = canonicalizeUrl(url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}

// Case-insensitive brand mention with word boundaries, so "Linear" matches
// "Linear is great" but not "linearly" or "nonlinear". Regex metacharacters in
// the brand are escaped, and boundaries are defined against alphanumerics so
// names like "Node.js" still match at their edges.
export function mentionsBrand(text: string, brand: string): boolean {
  const cleaned = (brand ?? "").trim();
  if (cleaned === "") return false;
  const escaped = cleaned.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i");
  return pattern.test(text);
}
