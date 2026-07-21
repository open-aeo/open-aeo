import { AeoCheckResult } from "./types.js";
import { extractHost } from "./urlMatch.js";

export interface SourceDomain {
  domain: string;
  appearances: number; // total competitor-URL appearances across checks
  queries: string[]; // distinct queries where this domain showed up
}

export interface SourcesBreakdown {
  checksAnalysed: number;
  totalCompetitorUrls: number;
  uniqueDomains: number;
  domains: SourceDomain[]; // sorted most-cited first
}

export interface SourcesFilter {
  targetDomain?: string;
  query?: string;
}

// Rank the third-party domains that keep appearing as competitors across the
// stored checks. The study behind open-aeo found ~86% of cited URLs are
// third-party, so "who keeps winning" is the actionable list: go earn a mention
// on these pages, not just polish your own. competitorUrls already excludes the
// target, so everything counted here is third-party by construction.
export function computeSourcesBreakdown(
  history: AeoCheckResult[],
  filter: SourcesFilter = {},
): SourcesBreakdown {
  const filtered = history.filter((result) => {
    if (
      filter.targetDomain &&
      result.targetDomain.toLowerCase() !== filter.targetDomain.toLowerCase()
    ) {
      return false;
    }
    if (
      filter.query &&
      result.query.toLowerCase() !== filter.query.toLowerCase()
    ) {
      return false;
    }
    return true;
  });

  const byDomain = new Map<
    string,
    { appearances: number; queries: Set<string> }
  >();
  let totalCompetitorUrls = 0;

  for (const result of filtered) {
    for (const url of result.competitorUrls) {
      const host = extractHost(url);
      if (!host) continue;
      totalCompetitorUrls += 1;
      const entry = byDomain.get(host) ?? {
        appearances: 0,
        queries: new Set<string>(),
      };
      entry.appearances += 1;
      entry.queries.add(result.query);
      byDomain.set(host, entry);
    }
  }

  const domains: SourceDomain[] = [...byDomain.entries()]
    .map(([domain, entry]) => ({
      domain,
      appearances: entry.appearances,
      queries: [...entry.queries],
    }))
    .sort(
      (a, b) =>
        b.appearances - a.appearances || a.domain.localeCompare(b.domain),
    );

  return {
    checksAnalysed: filtered.length,
    totalCompetitorUrls,
    uniqueDomains: domains.length,
    domains,
  };
}
