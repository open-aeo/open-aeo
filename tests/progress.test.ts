import { describe, it, expect } from "vitest";
import {
  computeProgress,
  formatProgressReport,
} from "../src/core/progress.js";
import { AeoCheckResult, EngineName } from "../src/core/types.js";

function check(
  opts: {
    query: string;
    targetDomain: string;
    timestamp: string;
    cited: boolean;
    position?: number | null;
    citationRate?: number;
    engine?: EngineName;
  },
): AeoCheckResult {
  const cited = opts.cited;
  return {
    query: opts.query,
    targetDomain: opts.targetDomain,
    engine: opts.engine ?? "perplexity",
    model: "sonar",
    cited,
    position: opts.position ?? null,
    competitorUrls: [],
    timestamp: opts.timestamp,
    sampleCount: 1,
    citedCount: cited ? 1 : 0,
    citationRate: opts.citationRate ?? (cited ? 1 : 0),
    positions: [],
    positionSpread: null,
  };
}

describe("computeProgress", () => {
  it("marks a query that went from absent to cited as a win", () => {
    const history = [
      check({
        query: "best pm tool",
        targetDomain: "linear.app",
        timestamp: "2026-07-01T10:00:00.000Z",
        cited: false,
      }),
      check({
        query: "best pm tool",
        targetDomain: "linear.app",
        timestamp: "2026-07-20T10:00:00.000Z",
        cited: true,
        position: 1,
      }),
    ];
    const report = computeProgress(history, { targetDomain: "linear.app" });
    expect(report.wins).toBe(1);
    expect(report.entries[0].outcome).toBe("won");
    expect(report.entries[0].checks).toBe(2);
  });

  it("marks a query that lost its citation as a regression", () => {
    const history = [
      check({
        query: "notion alternative",
        targetDomain: "linear.app",
        timestamp: "2026-07-01T10:00:00.000Z",
        cited: true,
        position: 2,
      }),
      check({
        query: "notion alternative",
        targetDomain: "linear.app",
        timestamp: "2026-07-20T10:00:00.000Z",
        cited: false,
      }),
    ];
    const report = computeProgress(history);
    expect(report.losses).toBe(1);
    expect(report.entries[0].outcome).toBe("lost");
  });

  it("uses the earliest as baseline and latest as current regardless of input order", () => {
    const history = [
      check({
        query: "q",
        targetDomain: "d.com",
        timestamp: "2026-07-20T10:00:00.000Z",
        cited: true,
        position: 1,
        citationRate: 1,
      }),
      check({
        query: "q",
        targetDomain: "d.com",
        timestamp: "2026-07-01T10:00:00.000Z",
        cited: true,
        position: 4,
        citationRate: 0.3,
      }),
    ];
    const report = computeProgress(history);
    const entry = report.entries[0];
    expect(entry.baseline.citationRate).toBe(0.3);
    expect(entry.latest.citationRate).toBe(1);
    expect(entry.outcome).toBe("improved");
    expect(entry.positionDelta).toBe(3); // 4 -> 1, moved up three places
  });

  it("calls a small citation-rate wobble steady, not improved", () => {
    const history = [
      check({
        query: "q",
        targetDomain: "d.com",
        timestamp: "2026-07-01T10:00:00.000Z",
        cited: true,
        position: 2,
        citationRate: 0.6,
      }),
      check({
        query: "q",
        targetDomain: "d.com",
        timestamp: "2026-07-20T10:00:00.000Z",
        cited: true,
        position: 2,
        citationRate: 0.7,
      }),
    ];
    const report = computeProgress(history);
    expect(report.entries[0].outcome).toBe("steady-cited");
  });

  it("tracks each engine as its own trajectory", () => {
    const history = [
      check({
        query: "q",
        targetDomain: "d.com",
        timestamp: "2026-07-01T10:00:00.000Z",
        cited: false,
        engine: "perplexity",
      }),
      check({
        query: "q",
        targetDomain: "d.com",
        timestamp: "2026-07-20T10:00:00.000Z",
        cited: true,
        position: 1,
        engine: "perplexity",
      }),
      check({
        query: "q",
        targetDomain: "d.com",
        timestamp: "2026-07-01T10:00:00.000Z",
        cited: true,
        position: 1,
        engine: "chatgpt",
      }),
      check({
        query: "q",
        targetDomain: "d.com",
        timestamp: "2026-07-20T10:00:00.000Z",
        cited: false,
        engine: "chatgpt",
      }),
    ];
    const report = computeProgress(history);
    expect(report.entriesAnalysed).toBe(2);
    expect(report.wins).toBe(1);
    expect(report.losses).toBe(1);
  });

  it("excludes single-check queries but counts them", () => {
    const history = [
      check({
        query: "only once",
        targetDomain: "d.com",
        timestamp: "2026-07-01T10:00:00.000Z",
        cited: true,
        position: 1,
      }),
    ];
    const report = computeProgress(history);
    expect(report.entriesAnalysed).toBe(0);
    expect(report.singleCheckQueries).toBe(1);
  });

  it("filters by query and engine", () => {
    const history = [
      check({
        query: "keep",
        targetDomain: "d.com",
        timestamp: "2026-07-01T10:00:00.000Z",
        cited: false,
      }),
      check({
        query: "keep",
        targetDomain: "d.com",
        timestamp: "2026-07-20T10:00:00.000Z",
        cited: true,
        position: 1,
      }),
      check({
        query: "drop",
        targetDomain: "d.com",
        timestamp: "2026-07-01T10:00:00.000Z",
        cited: false,
      }),
      check({
        query: "drop",
        targetDomain: "d.com",
        timestamp: "2026-07-20T10:00:00.000Z",
        cited: true,
        position: 1,
      }),
    ];
    const report = computeProgress(history, { query: "keep" });
    expect(report.entriesAnalysed).toBe(1);
    expect(report.entries[0].query).toBe("keep");
  });

  it("treats legacy records without sampling fields as a single sample", () => {
    const legacyAbsent = {
      query: "q",
      targetDomain: "d.com",
      engine: "perplexity",
      model: "sonar",
      cited: false,
      position: null,
      competitorUrls: [],
      timestamp: "2026-07-01T10:00:00.000Z",
    } as unknown as AeoCheckResult;
    const legacyCited = {
      query: "q",
      targetDomain: "d.com",
      engine: "perplexity",
      model: "sonar",
      cited: true,
      position: 1,
      competitorUrls: [],
      timestamp: "2026-07-20T10:00:00.000Z",
    } as unknown as AeoCheckResult;
    const report = computeProgress([legacyAbsent, legacyCited]);
    expect(report.entries[0].outcome).toBe("won");
    expect(report.entries[0].baseline.citationRate).toBe(0);
    expect(report.entries[0].latest.citationRate).toBe(1);
  });

  it("orders wins ahead of regressions and other outcomes", () => {
    const mk = (query: string, from: boolean, to: boolean) => [
      check({
        query,
        targetDomain: "d.com",
        timestamp: "2026-07-01T10:00:00.000Z",
        cited: from,
        position: from ? 1 : null,
      }),
      check({
        query,
        targetDomain: "d.com",
        timestamp: "2026-07-20T10:00:00.000Z",
        cited: to,
        position: to ? 1 : null,
      }),
    ];
    const history = [
      ...mk("still-absent-q", false, false),
      ...mk("lost-q", true, false),
      ...mk("won-q", false, true),
    ];
    const report = computeProgress(history);
    expect(report.entries.map((e) => e.outcome)).toEqual([
      "won",
      "lost",
      "still-absent",
    ]);
  });
});

describe("formatProgressReport", () => {
  it("leads with the win and shows the before/after dates", () => {
    const history = [
      check({
        query: "best pm tool",
        targetDomain: "linear.app",
        timestamp: "2026-07-01T10:00:00.000Z",
        cited: false,
      }),
      check({
        query: "best pm tool",
        targetDomain: "linear.app",
        timestamp: "2026-07-20T10:00:00.000Z",
        cited: true,
        position: 1,
      }),
    ];
    const text = formatProgressReport(
      computeProgress(history, { targetDomain: "linear.app" }),
    );
    expect(text).toContain("AEO PROGRESS -- linear.app");
    expect(text).toContain("[WON]");
    expect(text).toContain('"best pm tool"');
    expect(text).toContain("citation rate 0% -> 100%");
  });

  it("explains the empty case with a nudge to re-run", () => {
    const history = [
      check({
        query: "only once",
        targetDomain: "d.com",
        timestamp: "2026-07-01T10:00:00.000Z",
        cited: true,
        position: 1,
      }),
    ];
    const text = formatProgressReport(computeProgress(history));
    expect(text).toContain("only one check");
  });
});
