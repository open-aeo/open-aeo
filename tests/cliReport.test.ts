import { describe, it, expect } from "vitest";
import { formatRunReport, runReportToJson } from "../src/cli/report.js";
import { RunReport } from "../src/cli/runCheck.js";
import { AeoCheckResult } from "../src/core/types.js";

function result(query: string, cited: boolean): AeoCheckResult {
  return {
    query,
    targetDomain: "linear.app",
    engine: "perplexity",
    model: "sonar",
    cited,
    position: cited ? 0 : null,
    competitorUrls: [],
    timestamp: "2026-07-21T10:00:00.000Z",
    sampleCount: 3,
    citedCount: cited ? 2 : 0,
    citationRate: cited ? 2 / 3 : 0,
    positions: cited ? [0, 1] : [],
    positionSpread: cited ? 0.5 : null,
  };
}

const report: RunReport = {
  targetDomain: "linear.app",
  droppedCount: 1,
  outcomes: [
    {
      result: result("hit query", true),
      trend: { direction: "up", previousRate: 0.33, delta: 0.33 },
      dropped: false,
    },
    {
      result: result("miss query", false),
      trend: { direction: "down", previousRate: 1, delta: -1 },
      dropped: true,
    },
  ],
};

describe("formatRunReport", () => {
  it("summarises counts and marks drops", () => {
    const text = formatRunReport(report);
    expect(text).toContain("linear.app");
    expect(text).toContain("1/2 checks cited");
    expect(text).toContain("1 dropped");
    expect(text).toContain('"hit query"');
    expect(text).toContain("[DROP]");
  });
});

describe("runReportToJson", () => {
  it("emits structured per-check data", () => {
    const json = runReportToJson(report) as {
      targetDomain: string;
      droppedCount: number;
      checks: Array<{ query: string; dropped: boolean; citationRate: number }>;
    };
    expect(json.targetDomain).toBe("linear.app");
    expect(json.droppedCount).toBe(1);
    expect(json.checks).toHaveLength(2);
    expect(json.checks[1].dropped).toBe(true);
    expect(json.checks[0].citationRate).toBeCloseTo(2 / 3);
  });
});
