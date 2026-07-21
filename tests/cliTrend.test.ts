import { describe, it, expect } from "vitest";
import { computeTrend, isDrop } from "../src/cli/trend.js";
import { AeoCheckResult } from "../src/core/types.js";

function result(over: Partial<AeoCheckResult>): AeoCheckResult {
  const citationRate = over.citationRate ?? 0;
  return {
    query: "q",
    targetDomain: "linear.app",
    engine: "perplexity",
    model: "sonar",
    cited: over.cited ?? citationRate > 0,
    position: over.position ?? null,
    competitorUrls: [],
    timestamp: over.timestamp ?? "2026-07-21T10:00:00.000Z",
    sampleCount: over.sampleCount ?? 3,
    citedCount: over.citedCount ?? Math.round(citationRate * 3),
    citationRate,
    positions: [],
    positionSpread: null,
    ...over,
  };
}

describe("computeTrend", () => {
  it("is 'new' when there is no prior run", () => {
    const trend = computeTrend(result({ citationRate: 1 }), []);
    expect(trend.direction).toBe("new");
    expect(trend.previousRate).toBe(null);
  });

  it("is 'up' when the rate increased", () => {
    const prior = result({
      citationRate: 0.33,
      timestamp: "2026-07-20T10:00:00.000Z",
    });
    const trend = computeTrend(result({ citationRate: 1 }), [prior]);
    expect(trend.direction).toBe("up");
    expect(trend.previousRate).toBeCloseTo(0.33);
  });

  it("is 'down' when the rate decreased", () => {
    const prior = result({
      citationRate: 1,
      timestamp: "2026-07-20T10:00:00.000Z",
    });
    const trend = computeTrend(result({ citationRate: 0.33 }), [prior]);
    expect(trend.direction).toBe("down");
  });

  it("is 'same' when the rate is unchanged", () => {
    const prior = result({
      citationRate: 0.5,
      timestamp: "2026-07-20T10:00:00.000Z",
    });
    const trend = computeTrend(result({ citationRate: 0.5 }), [prior]);
    expect(trend.direction).toBe("same");
  });

  it("compares against the most recent prior for the same query/engine only", () => {
    const otherQuery = result({
      query: "different",
      citationRate: 1,
      timestamp: "2026-07-20T10:00:00.000Z",
    });
    const trend = computeTrend(result({ citationRate: 0 }), [otherQuery]);
    expect(trend.direction).toBe("new"); // no prior for THIS query
  });
});

describe("isDrop", () => {
  it("is a drop when cited before but not now", () => {
    const prior = result({
      cited: true,
      citationRate: 1,
      timestamp: "2026-07-20T10:00:00.000Z",
    });
    expect(isDrop(result({ cited: false, citationRate: 0 }), [prior])).toBe(
      true,
    );
  });

  it("is not a drop when still cited", () => {
    const prior = result({
      cited: true,
      citationRate: 1,
      timestamp: "2026-07-20T10:00:00.000Z",
    });
    expect(isDrop(result({ cited: true, citationRate: 0.33 }), [prior])).toBe(
      false,
    );
  });

  it("is not a drop on the first-ever run", () => {
    expect(isDrop(result({ cited: false }), [])).toBe(false);
  });
});
