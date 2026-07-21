import { describe, it, expect } from "vitest";
import { computeSourcesBreakdown } from "../src/core/sourcesBreakdown.js";
import { AeoCheckResult } from "../src/core/types.js";

function check(
  query: string,
  targetDomain: string,
  competitorUrls: string[],
): AeoCheckResult {
  return {
    query,
    targetDomain,
    engine: "perplexity",
    model: "sonar",
    cited: false,
    position: null,
    competitorUrls,
    timestamp: "2026-07-21T10:00:00.000Z",
    sampleCount: 1,
    citedCount: 0,
    citationRate: 0,
    positions: [],
    positionSpread: null,
  };
}

describe("computeSourcesBreakdown", () => {
  const history = [
    check("best pm tool", "linear.app", [
      "https://youtube.com/watch?v=1",
      "https://reddit.com/r/x",
    ]),
    check("linear vs jira", "linear.app", [
      "https://www.youtube.com/watch?v=2",
      "https://g2.com/linear",
    ]),
    check("best db", "supabase.com", ["https://youtube.com/watch?v=3"]),
  ];

  it("ranks domains by total appearances, normalizing hosts", () => {
    const breakdown = computeSourcesBreakdown(history);
    expect(breakdown.domains[0].domain).toBe("youtube.com");
    expect(breakdown.domains[0].appearances).toBe(3); // www + bare merged
    expect(breakdown.totalCompetitorUrls).toBe(5);
    expect(breakdown.checksAnalysed).toBe(3);
  });

  it("tracks the distinct queries a domain appeared for", () => {
    const breakdown = computeSourcesBreakdown(history);
    const youtube = breakdown.domains.find((d) => d.domain === "youtube.com")!;
    expect(youtube.queries.sort()).toEqual([
      "best db",
      "best pm tool",
      "linear vs jira",
    ]);
  });

  it("filters by target domain", () => {
    const breakdown = computeSourcesBreakdown(history, {
      targetDomain: "supabase.com",
    });
    expect(breakdown.checksAnalysed).toBe(1);
    expect(breakdown.domains).toHaveLength(1);
    expect(breakdown.domains[0].domain).toBe("youtube.com");
  });

  it("filters by query", () => {
    const breakdown = computeSourcesBreakdown(history, {
      query: "linear vs jira",
    });
    expect(breakdown.checksAnalysed).toBe(1);
    expect(breakdown.domains.map((d) => d.domain).sort()).toEqual([
      "g2.com",
      "youtube.com",
    ]);
  });

  it("handles empty history", () => {
    const breakdown = computeSourcesBreakdown([]);
    expect(breakdown.checksAnalysed).toBe(0);
    expect(breakdown.domains).toEqual([]);
  });
});
