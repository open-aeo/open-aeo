import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  analyseGap,
  runGapReport,
  formatGapReport,
} from "../src/core/gapAnalyser.js";
import {
  GapTarget,
  GapAnalysisResult,
  GapReportSummary,
} from "../src/core/types.js";
import { IAnswerEngine } from "../src/ports/IAnswerEngine.js";
import { IStorage } from "../src/ports/IStorage.js";

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const searchMock = vi.fn();
const saveGapResultMock = vi.fn();

const mockEngine = { search: searchMock } as unknown as IAnswerEngine;
const mockStorage = {
  save: vi.fn(),
  getHistory: vi.fn(),
  saveGapResult: saveGapResultMock,
  getGapHistory: vi.fn(),
} as unknown as IStorage;

beforeEach(() => {
  vi.resetAllMocks();
  saveGapResultMock.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGapTarget(overrides: Partial<GapTarget> = {}): GapTarget {
  return {
    query: "best note taking apps",
    targetDomain: "notion.so",
    competitorDomains: ["evernote.com", "obsidian.md"],
    source: "peec",
    ...overrides,
  };
}

function makeGapAnalysisResult(overrides: {
  confirmedGap?: boolean;
  peecConfirmed?: boolean;
  liveConfirmed?: boolean;
  query?: string;
  topCompetitorNow?: string | null;
  peecOpportunityScore?: number;
} = {}): GapAnalysisResult {
  const {
    confirmedGap = false,
    peecConfirmed = false,
    liveConfirmed = false,
    query = "test query",
    topCompetitorNow = null,
    peecOpportunityScore,
  } = overrides;

  return {
    gapTarget: {
      query,
      targetDomain: "notion.so",
      competitorDomains: [],
      source: peecConfirmed ? "peec" : "manual",
      peecOpportunityScore,
    },
    liveCheck: {
      query,
      targetDomain: "notion.so",
      cited: !liveConfirmed,
      position: liveConfirmed ? null : 0,
      competitorUrls: topCompetitorNow ? [topCompetitorNow] : [],
      timestamp: new Date().toISOString(),
    },
    confirmedGap,
    peecConfirmed,
    liveConfirmed,
    topCompetitorNow,
    recommendation: "placeholder recommendation",
  };
}

// ---------------------------------------------------------------------------
// Suite 1: analyseGap
// ---------------------------------------------------------------------------

describe("analyseGap", () => {
  it("confirmed gap — Peec source, not cited live", async () => {
    const gap = makeGapTarget({ source: "peec" });
    searchMock.mockResolvedValueOnce({
      answerText: "Asana and Trello are the top project management tools.",
      citations: ["https://asana.com/features", "https://trello.com/"],
    });

    const result = await analyseGap(mockEngine, mockStorage, gap);

    expect(result.confirmedGap).toBe(true);
    expect(result.peecConfirmed).toBe(true);
    expect(result.liveConfirmed).toBe(true);
    expect(result.topCompetitorNow).toBe("https://asana.com/features");
    expect(result.recommendation).toContain("[!!] CONFIRMED GAP");
    expect(saveGapResultMock).toHaveBeenCalledOnce();
    expect(saveGapResultMock).toHaveBeenCalledWith(result);
  });

  it("closing gap — Peec source, now cited live", async () => {
    const gap = makeGapTarget({ source: "peec", brandName: "Notion" });
    searchMock.mockResolvedValueOnce({
      answerText: "Notion is the best tool for notes.",
      citations: ["https://notion.so/features"],
    });

    const result = await analyseGap(mockEngine, mockStorage, gap);

    expect(result.confirmedGap).toBe(false);
    expect(result.peecConfirmed).toBe(true);
    expect(result.liveConfirmed).toBe(false);
    expect(result.recommendation).toContain("[~] CLOSING GAP");
  });

  it("emerging gap — manual source, not cited live", async () => {
    const gap = makeGapTarget({ source: "manual" });
    searchMock.mockResolvedValueOnce({
      answerText: "Evernote is a great option for note taking.",
      citations: ["https://evernote.com/"],
    });

    const result = await analyseGap(mockEngine, mockStorage, gap);

    expect(result.liveConfirmed).toBe(true);
    expect(result.peecConfirmed).toBe(false);
    expect(result.confirmedGap).toBe(false);
    expect(result.recommendation).toContain("[!] EMERGING GAP");
  });

  it("no gap — cited in both", async () => {
    const gap = makeGapTarget({ source: "manual", brandName: "Notion" });
    searchMock.mockResolvedValueOnce({
      answerText: "Notion is the go-to tool for modern teams.",
      citations: ["https://notion.so/"],
    });

    const result = await analyseGap(mockEngine, mockStorage, gap);

    expect(result.confirmedGap).toBe(false);
    expect(result.peecConfirmed).toBe(false);
    expect(result.liveConfirmed).toBe(false);
    expect(result.recommendation).toContain("[ok] NO GAP");
  });

  it("engine error bubbles up from analyseGap", async () => {
    const gap = makeGapTarget();
    searchMock.mockRejectedValueOnce(new Error("API rate limit"));

    await expect(analyseGap(mockEngine, mockStorage, gap)).rejects.toThrow(
      "API rate limit",
    );
    expect(saveGapResultMock).not.toHaveBeenCalled();
  });

  it("passes brandName through to citation parser for text matching", async () => {
    // Domain is NOT in citations but brand IS in answer text — should still be cited
    const gap = makeGapTarget({ source: "manual", brandName: "Notion" });
    searchMock.mockResolvedValueOnce({
      answerText: "Many teams rely on Notion for their knowledge base.",
      citations: ["https://confluence.atlassian.com/"],
    });

    const result = await analyseGap(mockEngine, mockStorage, gap);

    expect(result.liveCheck.cited).toBe(true);
    expect(result.liveConfirmed).toBe(false);
  });

  it("topCompetitorNow is null when no competitor URLs returned", async () => {
    const gap = makeGapTarget({ source: "peec" });
    searchMock.mockResolvedValueOnce({
      answerText: "There is no clear winner for this query.",
      citations: [],
    });

    const result = await analyseGap(mockEngine, mockStorage, gap);

    expect(result.topCompetitorNow).toBeNull();
    // No citations means no competitors but also not cited (no notion.so) → gap
    expect(result.liveConfirmed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite 2: runGapReport
// ---------------------------------------------------------------------------

describe("runGapReport", () => {
  it("processes multiple gaps and returns correct summary counts", async () => {
    const gaps: GapTarget[] = [
      // gaps[0]: peec + not cited live → confirmed gap
      makeGapTarget({ query: "q1", source: "peec" }),
      // gaps[1]: peec + cited live → closing (peecOnly / alreadyFixed)
      makeGapTarget({ query: "q2", source: "peec", brandName: "Notion" }),
      // gaps[2]: manual + not cited live → emerging (liveOnly)
      makeGapTarget({ query: "q3", source: "manual" }),
      // gaps[3]: manual + cited live → no gap (already cited)
      makeGapTarget({ query: "q4", source: "manual", brandName: "Notion" }),
    ];

    searchMock
      .mockResolvedValueOnce({
        // q1: Asana wins, notion not cited
        answerText: "Asana is the best project management tool.",
        citations: ["https://asana.com/"],
      })
      .mockResolvedValueOnce({
        // q2: Notion now cited — gap closing
        answerText: "Notion is excellent for teams.",
        citations: ["https://notion.so/"],
      })
      .mockResolvedValueOnce({
        // q3: Evernote wins, notion not cited
        answerText: "Evernote is great for notes.",
        citations: ["https://evernote.com/"],
      })
      .mockResolvedValueOnce({
        // q4: Notion cited — no gap
        answerText: "Notion wins for productivity.",
        citations: ["https://notion.so/"],
      });

    const summary = await runGapReport(mockEngine, mockStorage, gaps, 0);

    expect(summary.confirmedGaps).toBe(1);
    expect(summary.peecOnlyGaps).toBe(1);
    expect(summary.liveOnlyGaps).toBe(1);
    expect(summary.alreadyFixed).toBe(1);
    expect(summary.results).toHaveLength(4);
    expect(summary.targetDomain).toBe("notion.so");
    expect(saveGapResultMock).toHaveBeenCalledTimes(4);
  });

  it("skips failed items and continues batch", async () => {
    const gaps: GapTarget[] = [
      makeGapTarget({ query: "q1" }),
      makeGapTarget({ query: "q2" }),
      makeGapTarget({ query: "q3" }),
    ];

    searchMock
      .mockResolvedValueOnce({
        answerText: "Asana is great.",
        citations: ["https://asana.com/"],
      })
      .mockRejectedValueOnce(new Error("Perplexity timeout"))
      .mockResolvedValueOnce({
        answerText: "Asana is great.",
        citations: ["https://asana.com/"],
      });

    const summary = await runGapReport(mockEngine, mockStorage, gaps, 0);

    expect(summary.results).toHaveLength(2);
    expect(summary.totalGapsAnalysed).toBe(2);
    expect(saveGapResultMock).toHaveBeenCalledTimes(2);
  });

  it("throws if gaps array is empty", async () => {
    await expect(
      runGapReport(mockEngine, mockStorage, [], 0),
    ).rejects.toThrow("No gap targets provided.");
  });

  it("picks most common targetDomain when gaps have mixed domains", async () => {
    const gaps: GapTarget[] = [
      makeGapTarget({ query: "q1", targetDomain: "notion.so" }),
      makeGapTarget({ query: "q2", targetDomain: "notion.so" }),
      makeGapTarget({ query: "q3", targetDomain: "other.com" }),
    ];

    searchMock.mockResolvedValue({
      answerText: "Asana wins.",
      citations: ["https://asana.com/"],
    });

    const summary = await runGapReport(mockEngine, mockStorage, gaps, 0);

    expect(summary.targetDomain).toBe("notion.so");
  });

  it("sets generatedAt to a valid ISO timestamp", async () => {
    const gap = makeGapTarget();
    searchMock.mockResolvedValueOnce({
      answerText: "Asana wins.",
      citations: ["https://asana.com/"],
    });

    const before = Date.now();
    const summary = await runGapReport(mockEngine, mockStorage, [gap], 0);
    const after = Date.now();

    const ts = new Date(summary.generatedAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// Suite 3: formatGapReport
// ---------------------------------------------------------------------------

describe("formatGapReport", () => {
  it("renders all four sections and orders confirmed gaps first", () => {
    const summary: GapReportSummary = {
      targetDomain: "notion.so",
      totalGapsAnalysed: 4,
      confirmedGaps: 1,
      peecOnlyGaps: 1,
      liveOnlyGaps: 1,
      alreadyFixed: 1,
      results: [
        makeGapAnalysisResult({
          confirmedGap: true,
          peecConfirmed: true,
          liveConfirmed: true,
          query: "confirmed query",
          topCompetitorNow: "https://asana.com/",
          peecOpportunityScore: 0.9,
        }),
        makeGapAnalysisResult({
          confirmedGap: false,
          peecConfirmed: false,
          liveConfirmed: true,
          query: "emerging query",
          topCompetitorNow: "https://evernote.com/",
        }),
        makeGapAnalysisResult({
          confirmedGap: false,
          peecConfirmed: true,
          liveConfirmed: false,
          query: "closing query",
        }),
        makeGapAnalysisResult({
          confirmedGap: false,
          peecConfirmed: false,
          liveConfirmed: false,
          query: "no gap query",
        }),
      ],
      generatedAt: new Date().toISOString(),
    };

    const output = formatGapReport(summary);

    expect(output).toContain("[!!] CONFIRMED GAPS");
    expect(output).toContain("[!] EMERGING GAPS");
    expect(output).toContain("[~] CLOSING GAPS");
    expect(output).toContain("[ok] ALREADY CITED");

    // Confirmed section must precede emerging section
    expect(output.indexOf("[!!] CONFIRMED GAPS")).toBeLessThan(
      output.indexOf("[!] EMERGING GAPS"),
    );
    // Emerging must precede closing
    expect(output.indexOf("[!] EMERGING GAPS")).toBeLessThan(
      output.indexOf("[~] CLOSING GAPS"),
    );
  });

  it("includes the target domain in the report header", () => {
    const summary: GapReportSummary = {
      targetDomain: "notion.so",
      totalGapsAnalysed: 0,
      confirmedGaps: 0,
      peecOnlyGaps: 0,
      liveOnlyGaps: 0,
      alreadyFixed: 0,
      results: [],
      generatedAt: new Date().toISOString(),
    };

    const output = formatGapReport(summary);
    expect(output).toContain("notion.so");
  });

  it("handles empty results without throwing", () => {
    const summary: GapReportSummary = {
      targetDomain: "notion.so",
      totalGapsAnalysed: 0,
      confirmedGaps: 0,
      peecOnlyGaps: 0,
      liveOnlyGaps: 0,
      alreadyFixed: 0,
      results: [],
      generatedAt: new Date().toISOString(),
    };

    expect(() => formatGapReport(summary)).not.toThrow();
    const output = formatGapReport(summary);
    expect(output).toContain("Total gaps analysed:  0");
  });

  it("sorts confirmed gaps by peecOpportunityScore descending", () => {
    const summary: GapReportSummary = {
      targetDomain: "notion.so",
      totalGapsAnalysed: 2,
      confirmedGaps: 2,
      peecOnlyGaps: 0,
      liveOnlyGaps: 0,
      alreadyFixed: 0,
      results: [
        makeGapAnalysisResult({
          confirmedGap: true,
          peecConfirmed: true,
          liveConfirmed: true,
          query: "low score query",
          peecOpportunityScore: 0.2,
        }),
        makeGapAnalysisResult({
          confirmedGap: true,
          peecConfirmed: true,
          liveConfirmed: true,
          query: "high score query",
          peecOpportunityScore: 0.95,
        }),
      ],
      generatedAt: new Date().toISOString(),
    };

    const output = formatGapReport(summary);

    // Higher score must appear before lower score
    expect(output.indexOf("high score query")).toBeLessThan(
      output.indexOf("low score query"),
    );
  });

  it("shows opportunity score and top competitor in confirmed gap entries", () => {
    const summary: GapReportSummary = {
      targetDomain: "notion.so",
      totalGapsAnalysed: 1,
      confirmedGaps: 1,
      peecOnlyGaps: 0,
      liveOnlyGaps: 0,
      alreadyFixed: 0,
      results: [
        makeGapAnalysisResult({
          confirmedGap: true,
          peecConfirmed: true,
          liveConfirmed: true,
          query: "best crm tool",
          topCompetitorNow: "https://hubspot.com/crm",
          peecOpportunityScore: 0.82,
        }),
      ],
      generatedAt: new Date().toISOString(),
    };

    const output = formatGapReport(summary);

    expect(output).toContain("https://hubspot.com/crm");
    expect(output).toContain("0.82");
  });
});
