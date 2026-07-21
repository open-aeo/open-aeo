import { describe, it, expect } from "vitest";
import {
  aggregateCheckResults,
  medianPosition,
  standardDeviation,
} from "../src/core/sampling.js";
import { AeoCheckResult } from "../src/core/types.js";

// Build one single-sample result, deriving the sampling fields the way
// parseAeoResponse does.
function oneSample(opts: {
  cited?: boolean;
  position?: number | null;
  competitors?: string[];
  timestamp?: string;
}): AeoCheckResult {
  const cited = opts.cited ?? false;
  const position = opts.position ?? null;
  return {
    query: "best pm tool",
    targetDomain: "notion.so",
    engine: "perplexity",
    model: "sonar",
    cited,
    position,
    competitorUrls: opts.competitors ?? [],
    timestamp: opts.timestamp ?? "2026-07-21T10:00:00.000Z",
    sampleCount: 1,
    citedCount: cited ? 1 : 0,
    citationRate: cited ? 1 : 0,
    positions: position !== null ? [position] : [],
    positionSpread: null,
  };
}

describe("aggregateCheckResults", () => {
  it("reports a citation rate and best position across samples", () => {
    const agg = aggregateCheckResults([
      oneSample({ cited: true, position: 2 }),
      oneSample({ cited: true, position: 0 }),
      oneSample({ cited: false }),
    ]);

    expect(agg.sampleCount).toBe(3);
    expect(agg.citedCount).toBe(2);
    expect(agg.citationRate).toBeCloseTo(2 / 3);
    expect(agg.cited).toBe(true);
    expect(agg.position).toBe(0); // best (lowest) among cited samples
    expect(agg.positions).toEqual([2, 0]);
    expect(agg.positionSpread).toBe(1); // stddev of [2, 0]
  });

  it("has no spread when fewer than two samples cite", () => {
    const agg = aggregateCheckResults([
      oneSample({ cited: true, position: 3 }),
      oneSample({ cited: false }),
    ]);
    expect(agg.positionSpread).toBe(null);
  });

  it("is not cited when no sample cited", () => {
    const agg = aggregateCheckResults([
      oneSample({ cited: false }),
      oneSample({ cited: false }),
    ]);
    expect(agg.cited).toBe(false);
    expect(agg.citationRate).toBe(0);
    expect(agg.position).toBe(null);
  });

  it("de-duplicates the competitor union across samples", () => {
    const agg = aggregateCheckResults([
      oneSample({ competitors: ["https://a.com/x?utm_source=openai"] }),
      oneSample({ competitors: ["https://www.a.com/x/"] }),
      oneSample({ competitors: ["https://b.com"] }),
    ]);
    expect(agg.competitorUrls).toEqual([
      "https://a.com/x?utm_source=openai",
      "https://b.com",
    ]);
  });

  it("uses the latest sample timestamp", () => {
    const agg = aggregateCheckResults([
      oneSample({ timestamp: "2026-07-21T10:00:00.000Z" }),
      oneSample({ timestamp: "2026-07-21T12:00:00.000Z" }),
      oneSample({ timestamp: "2026-07-21T09:00:00.000Z" }),
    ]);
    expect(agg.timestamp).toBe("2026-07-21T12:00:00.000Z");
  });

  it("throws on an empty sample list", () => {
    expect(() => aggregateCheckResults([])).toThrowError(/at least one sample/);
  });
});

describe("standardDeviation", () => {
  it("is small for steady values and large for jumpy ones", () => {
    expect(standardDeviation([2, 2, 3])).toBe(0.47); // steady
    expect(standardDeviation([1, 5, 9])).toBe(3.27); // jumpy
  });

  it("is null with fewer than two values", () => {
    expect(standardDeviation([3])).toBe(null);
    expect(standardDeviation([])).toBe(null);
  });
});

describe("medianPosition", () => {
  it("returns the middle of an odd count", () => {
    const agg = aggregateCheckResults([
      oneSample({ cited: true, position: 0 }),
      oneSample({ cited: true, position: 2 }),
      oneSample({ cited: true, position: 4 }),
    ]);
    expect(medianPosition(agg)).toBe(2);
  });

  it("averages the middle two of an even count", () => {
    const agg = aggregateCheckResults([
      oneSample({ cited: true, position: 0 }),
      oneSample({ cited: true, position: 3 }),
    ]);
    expect(medianPosition(agg)).toBe(1.5);
  });

  it("returns null when never cited", () => {
    const agg = aggregateCheckResults([oneSample({ cited: false })]);
    expect(medianPosition(agg)).toBe(null);
  });
});
