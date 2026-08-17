import { getAccessToken, logout } from "./auth";

const API_BASE = import.meta.env.PUBLIC_API_URL;

export class UnauthorizedError extends Error {}

export async function apiFetch<T>(path: string): Promise<T> {
  const token = getAccessToken();
  if (!token) throw new UnauthorizedError("Not logged in");

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    logout();
    throw new UnauthorizedError("Session expired");
  }
  if (!res.ok) {
    throw new Error(`Request to ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
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
