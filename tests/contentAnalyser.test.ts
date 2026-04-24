import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateTasks,
  analyseCompetitor,
  buildRecommendationReport,
} from "../src/core/contentAnalyser.js";
import {
  CompetitorAnalysis,
  AeoCheckResult,
  PageSignals,
} from "../src/core/types.js";
import { PageFetcher } from "../src/adapters/PageFetcher.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSignals(overrides: Partial<PageSignals> = {}): PageSignals {
  return {
    url: "https://example.com",
    fetchedAt: "2025-01-01T00:00:00.000Z",
    fetchError: null,
    wordCount: 0,
    hasFaqSection: false,
    hasFaqSchema: false,
    hasComparisonTable: false,
    hasDirectAnswer: false,
    hasHowToSchema: false,
    hasArticleSchema: false,
    headingCount: 0,
    internalLinkCount: 0,
    externalLinkCount: 0,
    hasLastModifiedDate: false,
    metaDescription: null,
    pageTitle: null,
    firstParagraph: null,
    schemaTypes: [],
    ...overrides,
  };
}

function makeCompetitorAnalysis(
  overrides: Partial<CompetitorAnalysis> = {},
): CompetitorAnalysis {
  return {
    query: "best tool",
    targetDomain: "example.com",
    competitorUrl: "https://competitor.com",
    competitorDomain: "competitor.com",
    citationPosition: 0,
    signals: makeSignals(),
    analysedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// generateTasks
// ---------------------------------------------------------------------------

describe("generateTasks", () => {
  it("generates FAQ task when competitor has FAQ schema", () => {
    const competitors: CompetitorAnalysis[] = [
      makeCompetitorAnalysis({
        competitorDomain: "asana.com",
        signals: makeSignals({ hasFaqSchema: true }),
      }),
    ];

    const tasks = generateTasks(competitors, false);

    const faqTask = tasks.find((t) => t.title === "Add an FAQ section");
    expect(faqTask).toBeDefined();
    expect(faqTask!.competitorEvidence).toContain("asana.com");
  });

  it("generates direct answer task when competitor has it and you are not cited", () => {
    const competitors: CompetitorAnalysis[] = [
      makeCompetitorAnalysis({
        signals: makeSignals({ hasDirectAnswer: true }),
      }),
    ];

    const tasks = generateTasks(competitors, false);

    const task = tasks.find((t) => t.title === "Lead with a direct answer");
    expect(task).toBeDefined();
  });

  it("does not generate direct answer task when you are already cited", () => {
    const competitors: CompetitorAnalysis[] = [
      makeCompetitorAnalysis({
        signals: makeSignals({ hasDirectAnswer: true }),
      }),
    ];

    const tasks = generateTasks(competitors, true);

    const task = tasks.find((t) => t.title === "Lead with a direct answer");
    expect(task).toBeUndefined();
  });

  it("generates word count task when average competitor word count exceeds 800", () => {
    const competitors: CompetitorAnalysis[] = [
      makeCompetitorAnalysis({ signals: makeSignals({ wordCount: 1000 }) }),
      makeCompetitorAnalysis({ signals: makeSignals({ wordCount: 1200 }) }),
    ];

    const tasks = generateTasks(competitors, false);

    const task = tasks.find((t) => t.title === "Increase content depth");
    expect(task).toBeDefined();
    expect(task!.description).toContain("1100");
  });

  it("does not generate word count task when average is below 800", () => {
    const competitors: CompetitorAnalysis[] = [
      makeCompetitorAnalysis({ signals: makeSignals({ wordCount: 400 }) }),
    ];

    const tasks = generateTasks(competitors, false);

    const task = tasks.find((t) => t.title === "Increase content depth");
    expect(task).toBeUndefined();
  });

  it("sorts tasks with high priority before medium before low", () => {
    const competitors: CompetitorAnalysis[] = [
      makeCompetitorAnalysis({
        signals: makeSignals({
          hasFaqSection: true,
          hasFaqSchema: true,
          hasDirectAnswer: true,
          hasArticleSchema: true,
          hasHowToSchema: true,
          hasComparisonTable: true,
          wordCount: 1200,
          headingCount: 5,
          hasLastModifiedDate: true,
        }),
      }),
    ];

    const tasks = generateTasks(competitors, false);

    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0].priority).toBe("high");

    const firstLowIndex = tasks.findIndex((t) => t.priority === "low");
    const lastHighIndex = tasks.findLastIndex((t) => t.priority === "high");

    if (firstLowIndex !== -1 && lastHighIndex !== -1) {
      expect(firstLowIndex).toBeGreaterThan(lastHighIndex);
    }
  });

  it("returns empty array when no competitors provided", () => {
    const tasks = generateTasks([], false);
    expect(tasks).toEqual([]);
  });

  it("does not generate a task for a signal no competitor has", () => {
    const competitors: CompetitorAnalysis[] = [
      makeCompetitorAnalysis({ signals: makeSignals() }),
    ];

    const tasks = generateTasks(competitors, false);
    expect(tasks).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// analyseCompetitor
// ---------------------------------------------------------------------------

describe("analyseCompetitor", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns CompetitorAnalysis with correct fields when fetch succeeds", async () => {
    const fetcher = new PageFetcher();
    const mockSignals = makeSignals({ fetchError: null, hasFaqSchema: true });
    vi.spyOn(fetcher, "fetch").mockResolvedValue(mockSignals);

    const result = await analyseCompetitor(
      fetcher,
      "best note app",
      "notion.so",
      "https://evernote.com/compare",
      1,
    );

    expect(result.competitorUrl).toBe("https://evernote.com/compare");
    expect(result.competitorDomain).toBe("evernote.com");
    expect(result.citationPosition).toBe(1);
    expect(result.signals.hasFaqSchema).toBe(true);
    expect(() => new Date(result.analysedAt).toISOString()).not.toThrow();
  });

  it("returns fetchError in signals when URL is invalid", async () => {
    const fetcher = new PageFetcher();

    const result = await analyseCompetitor(
      fetcher,
      "best note app",
      "notion.so",
      "not-a-url",
      0,
    );

    expect(result.signals.fetchError).not.toBeNull();
    expect(result.signals.fetchError!.startsWith("Invalid URL")).toBe(true);
    expect(result.competitorDomain).toBe("not-a-url");
  });
});

// ---------------------------------------------------------------------------
// buildRecommendationReport
// ---------------------------------------------------------------------------

describe("buildRecommendationReport", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns report with tasks when competitor pages are fetched", async () => {
    const fetcher = new PageFetcher();
    const mockSignals = makeSignals({
      fetchError: null,
      hasFaqSchema: true,
      wordCount: 1200,
    });
    vi.spyOn(fetcher, "fetch").mockResolvedValue(mockSignals);

    const checkResult: AeoCheckResult = {
      query: "best crm software",
      targetDomain: "hubspot.com",
      cited: false,
      position: null,
      competitorUrls: [
        "https://salesforce.com/crm",
        "https://pipedrive.com/crm",
      ],
      timestamp: new Date().toISOString(),
    };

    const report = await buildRecommendationReport(fetcher, checkResult, 2);

    expect(report.query).toBe("best crm software");
    expect(report.yourCited).toBe(false);
    expect(report.competitors.length).toBe(2);
    expect(report.tasks.length).toBeGreaterThan(0);

    const faqTask = report.tasks.find((t) => t.title === "Add an FAQ section");
    expect(faqTask).toBeDefined();
  });

  it("respects maxCompetitors limit", async () => {
    const fetcher = new PageFetcher();
    const mockSignals = makeSignals({ fetchError: null });
    vi.spyOn(fetcher, "fetch").mockResolvedValue(mockSignals);

    const checkResult: AeoCheckResult = {
      query: "best crm software",
      targetDomain: "hubspot.com",
      cited: false,
      position: null,
      competitorUrls: [
        "https://a.com",
        "https://b.com",
        "https://c.com",
      ],
      timestamp: new Date().toISOString(),
    };

    const report = await buildRecommendationReport(fetcher, checkResult, 1);

    expect(report.competitors.length).toBe(1);
  });

  it("handles fetch failure gracefully — report still returns", async () => {
    const fetcher = new PageFetcher();
    vi.spyOn(fetcher, "fetch").mockRejectedValue(new Error("network error"));

    const checkResult: AeoCheckResult = {
      query: "best crm software",
      targetDomain: "hubspot.com",
      cited: false,
      position: null,
      competitorUrls: ["https://salesforce.com/crm"],
      timestamp: new Date().toISOString(),
    };

    await expect(
      buildRecommendationReport(fetcher, checkResult, 1),
    ).resolves.toBeDefined();

    const report = await buildRecommendationReport(fetcher, checkResult, 1);
    expect(report.competitors.length).toBe(1);
    expect(report.competitors[0].signals.fetchError).not.toBeNull();
  });
});
