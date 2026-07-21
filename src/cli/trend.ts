import { AeoCheckResult } from "../core/types.js";

export type TrendDirection = "up" | "down" | "same" | "new";

export interface Trend {
  direction: TrendDirection;
  previousRate: number | null; // citation rate of the previous run, null if first time
  delta: number | null; // currentRate - previousRate
}

function mostRecentPrior(
  current: AeoCheckResult,
  priorHistory: AeoCheckResult[],
): AeoCheckResult | undefined {
  return priorHistory
    .filter(
      (r) =>
        r.query === current.query &&
        r.engine === current.engine &&
        r.targetDomain === current.targetDomain,
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
}

function rateOf(result: AeoCheckResult): number {
  // Old records predate citationRate; treat them as 0 or 1 from `cited`.
  return result.citationRate ?? (result.cited ? 1 : 0);
}

// Compare a fresh result to the most recent prior result for the same
// query + engine + domain. `priorHistory` must be the history snapshot taken
// BEFORE this run, so the current result does not compare against itself.
export function computeTrend(
  current: AeoCheckResult,
  priorHistory: AeoCheckResult[],
): Trend {
  const prior = mostRecentPrior(current, priorHistory);
  if (!prior) return { direction: "new", previousRate: null, delta: null };

  const previousRate = rateOf(prior);
  const delta = current.citationRate - previousRate;
  const direction = delta > 0.0001 ? "up" : delta < -0.0001 ? "down" : "same";
  return { direction, previousRate, delta };
}

// A "drop" is a regression: cited in the previous run, not cited now. This is the
// signal the CI gate fails on.
export function isDrop(
  current: AeoCheckResult,
  priorHistory: AeoCheckResult[],
): boolean {
  const prior = mostRecentPrior(current, priorHistory);
  if (!prior) return false;
  return prior.cited && !current.cited;
}
