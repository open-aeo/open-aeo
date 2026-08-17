import { describe, it, expect } from "vitest";
import { computeTrend } from "../src/core/trends.js";
import { AeoCheckResult } from "../src/core/types.js";

function check(overrides: Partial<AeoCheckResult> = {}): AeoCheckResult {
  return {
    query: "best pm tool",
    targetDomain: "linear.app",
    engine: "perplexity",
    model: "sonar",
    cited: true,
    position: 1,
    competitorUrls: [],
    timestamp: "2026-07-21T10:00:00.000Z",
    sampleCount: 1,
    citedCount: 1,
    citationRate: 1,
    positions: [1],
    positionSpread: null,
    ...overrides,
  };
}

describe("computeTrend", () => {
  it("buckets checks by UTC calendar day", () => {
    const history = [
      check({ timestamp: "2026-07-21T01:00:00.000Z", citationRate: 1 }),
      check({ timestamp: "2026-07-21T23:00:00.000Z", citationRate: 0 }),
      check({ timestamp: "2026-07-22T09:00:00.000Z", citationRate: 0.5 }),
    ];

    const trend = computeTrend(history);
    expect(trend).toEqual([
      { date: "2026-07-21", checksCount: 2, citationRate: 0.5 },
      { date: "2026-07-22", checksCount: 1, citationRate: 0.5 },
    ]);
  });

  it("returns points sorted ascending by date regardless of input order", () => {
    const history = [
      check({ timestamp: "2026-07-23T00:00:00.000Z" }),
      check({ timestamp: "2026-07-21T00:00:00.000Z" }),
      check({ timestamp: "2026-07-22T00:00:00.000Z" }),
    ];
    expect(computeTrend(history).map((p) => p.date)).toEqual([
      "2026-07-21",
      "2026-07-22",
      "2026-07-23",
    ]);
  });

  it("filters by target domain", () => {
    const history = [
      check({ targetDomain: "linear.app" }),
      check({ targetDomain: "notion.so", timestamp: "2026-07-22T00:00:00.000Z" }),
    ];
    const trend = computeTrend(history, { targetDomain: "notion.so" });
    expect(trend).toHaveLength(1);
    expect(trend[0].date).toBe("2026-07-22");
  });

  it("filters by query", () => {
    const history = [
      check({ query: "best pm tool" }),
      check({ query: "linear vs jira", timestamp: "2026-07-22T00:00:00.000Z" }),
    ];
    const trend = computeTrend(history, { query: "linear vs jira" });
    expect(trend).toHaveLength(1);
    expect(trend[0].date).toBe("2026-07-22");
  });

  it("handles empty history", () => {
    expect(computeTrend([])).toEqual([]);
  });
});
