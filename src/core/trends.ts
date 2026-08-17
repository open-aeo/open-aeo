import { AeoCheckResult } from "./types.js";

export interface TrendFilter {
  targetDomain?: string;
  query?: string;
}

export interface TrendPoint {
  date: string; // UTC calendar day, YYYY-MM-DD
  checksCount: number; // number of checks aggregated into this day
  citationRate: number; // average citationRate across those checks, in [0, 1]
}

function utcDay(timestamp: string): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

// Bucket stored checks by UTC calendar day and average their citation rate,
// so a dashboard can plot "is the trend improving" rather than showing a
// single point-in-time snapshot. Days with no checks are simply absent —
// callers that need a continuous axis fill gaps themselves.
export function computeTrend(
  history: AeoCheckResult[],
  filter: TrendFilter = {},
): TrendPoint[] {
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

  const byDay = new Map<string, { sum: number; count: number }>();
  for (const result of filtered) {
    const day = utcDay(result.timestamp);
    const entry = byDay.get(day) ?? { sum: 0, count: 0 };
    entry.sum += result.citationRate;
    entry.count += 1;
    byDay.set(day, entry);
  }

  return [...byDay.entries()]
    .map(([date, { sum, count }]) => ({
      date,
      checksCount: count,
      citationRate: sum / count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
