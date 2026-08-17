import { getAccessToken, logout } from "./auth";

const API_BASE = import.meta.env.PUBLIC_API_URL;

export class UnauthorizedError extends Error {}

async function handleResponse<T>(res: Response, path: string): Promise<T> {
  if (res.status === 401) {
    logout();
    throw new UnauthorizedError("Session expired");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `Request to ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiFetch<T>(path: string): Promise<T> {
  const token = getAccessToken();
  if (!token) throw new UnauthorizedError("Not logged in");

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<T>(res, path);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const token = getAccessToken();
  if (!token) throw new UnauthorizedError("Not logged in");

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res, path);
}

// Mirrors src/core/types.ts (AeoCheckResult) — kept as a local, minimal type
// rather than importing across the package boundary, since the dashboard is
// a separate deployable that only ever sees this shape over JSON.
export interface AeoCheckResult {
  query: string;
  targetDomain: string;
  engine: string;
  model: string;
  cited: boolean;
  position: number | null;
  competitorUrls: string[];
  timestamp: string;
  sampleCount: number;
  citedCount: number;
  citationRate: number;
}

export interface SourceDomain {
  domain: string;
  appearances: number;
  queries: string[];
}

export interface SourcesBreakdown {
  checksAnalysed: number;
  totalCompetitorUrls: number;
  uniqueDomains: number;
  domains: SourceDomain[];
}

export interface TrendPoint {
  date: string;
  checksCount: number;
  citationRate: number;
}

export type RunnableEngine = "perplexity" | "chatgpt";

export interface RunCheckRequest {
  query: string;
  targetDomain: string;
  brandName?: string;
  engine: RunnableEngine;
  samples?: number;
}

export interface KeyStatus {
  perplexity: boolean;
  openai: boolean;
}
