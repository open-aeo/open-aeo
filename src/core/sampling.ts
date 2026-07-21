import { AeoCheckResult } from "./types.js";
import { dedupeUrls } from "./urlMatch.js";

// Combine several single-query samples (or already-aggregated results) into one
// AeoCheckResult with a citation rate. LLM answers are non-deterministic, so one
// check is one roll of the dice; aggregating N samples turns "cited?" into "cited
// in X of N runs", which is the defensible number.
//
// All samples must be for the same query / targetDomain / engine; the first
// sample's identity is used. Throws on an empty input so callers do not silently
// produce a meaningless zero-sample result.
export function aggregateCheckResults(
  samples: AeoCheckResult[],
): AeoCheckResult {
  if (samples.length === 0) {
    throw new Error("aggregateCheckResults requires at least one sample.");
  }

  const first = samples[0];

  const sampleCount = samples.reduce((sum, s) => sum + s.sampleCount, 0);
  const citedCount = samples.reduce((sum, s) => sum + s.citedCount, 0);
  const positions = samples.flatMap((s) => s.positions);
  const competitorUrls = dedupeUrls(samples.flatMap((s) => s.competitorUrls));

  return {
    query: first.query,
    targetDomain: first.targetDomain,
    engine: first.engine,
    cited: citedCount > 0,
    // Best (lowest-index) position observed across the samples that cited us.
    position: positions.length > 0 ? Math.min(...positions) : null,
    competitorUrls,
    // Latest sample timestamp, so history sorts by when the check finished.
    timestamp: samples.reduce(
      (latest, s) => (s.timestamp > latest ? s.timestamp : latest),
      first.timestamp,
    ),
    sampleCount,
    citedCount,
    citationRate: sampleCount > 0 ? citedCount / sampleCount : 0,
    positions,
  };
}

// Median of the cited-sample positions, or null if never cited. Handy for
// reporting a "typical" position that is not skewed by one lucky run.
export function medianPosition(result: AeoCheckResult): number | null {
  const sorted = [...result.positions].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}
