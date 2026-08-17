import { describe, it, expect, beforeEach } from "vitest";
import { D1Storage } from "../src/adapters/D1Storage.js";
import { createFakeD1 } from "./helpers/fakeD1.js";
import {
  AeoCheckResult,
  GapAnalysisResult,
  CompetitorAnalysis,
} from "../src/core/types.js";

function makeCheck(overrides: Partial<AeoCheckResult> = {}): AeoCheckResult {
  return {
    query: "best crm",
    targetDomain: "example.com",
    engine: "perplexity",
    model: "sonar",
    cited: true,
    position: 1,
    competitorUrls: ["https://rival.com"],
    timestamp: "2026-08-01T00:00:00.000Z",
    sampleCount: 1,
    citedCount: 1,
    citationRate: 1,
    positions: [1],
    positionSpread: null,
    ...overrides,
  };
}

function makeGapResult(
  overrides: Partial<GapAnalysisResult> = {},
): GapAnalysisResult {
  return {
    gapTarget: {
      query: "best crm",
      targetDomain: "example.com",
      competitorDomains: ["rival.com"],
      source: "manual",
    },
    liveCheck: makeCheck(),
    confirmedGap: true,
    peecConfirmed: false,
    liveConfirmed: true,
    topCompetitorNow: "rival.com",
    recommendation: "add a comparison page",
    ...overrides,
  };
}

function makeCompetitorAnalysis(
  overrides: Partial<CompetitorAnalysis> = {},
): CompetitorAnalysis {
  return {
    query: "best crm",
    targetDomain: "example.com",
    competitorUrl: "https://rival.com/crm",
    competitorDomain: "rival.com",
    citationPosition: 0,
    signals: {
      url: "https://rival.com/crm",
      fetchedAt: "2026-08-01T00:00:00.000Z",
      fetchError: null,
      wordCount: 1200,
      hasFaqSection: true,
      hasFaqSchema: false,
      hasComparisonTable: true,
      hasDirectAnswer: false,
      hasHowToSchema: false,
      hasArticleSchema: true,
      headingCount: 8,
      internalLinkCount: 5,
      externalLinkCount: 2,
      hasLastModifiedDate: true,
      metaDescription: "Best CRM tools compared",
      pageTitle: "CRM Comparison",
      firstParagraph: "Here are the best CRMs.",
      schemaTypes: ["Article"],
    },
    analysedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("D1Storage", () => {
  let storage: D1Storage;

  beforeEach(() => {
    storage = new D1Storage(createFakeD1(), "user-1");
  });

  it("round-trips a saved check through getHistory", async () => {
    const check = makeCheck();
    await storage.save(check);
    const history = await storage.getHistory();
    expect(history).toEqual([check]);
  });

  it("getHistory matches query case-insensitively and exactly", async () => {
    await storage.save(makeCheck({ query: "Best CRM" }));
    await storage.save(makeCheck({ query: "crm software" }));

    const results = await storage.getHistory("best crm");
    expect(results).toHaveLength(1);
    expect(results[0].query).toBe("Best CRM");
  });

  it("round-trips a saved gap result through getGapHistory", async () => {
    const gap = makeGapResult();
    await storage.saveGapResult(gap);
    const history = await storage.getGapHistory();
    expect(history).toEqual([gap]);
  });

  it("getGapHistory matches domain as a case-insensitive substring", async () => {
    await storage.saveGapResult(
      makeGapResult({
        gapTarget: {
          query: "best crm",
          targetDomain: "Example.com",
          competitorDomains: [],
          source: "manual",
        },
      }),
    );
    await storage.saveGapResult(
      makeGapResult({
        gapTarget: {
          query: "best crm",
          targetDomain: "other.com",
          competitorDomains: [],
          source: "manual",
        },
      }),
    );

    const results = await storage.getGapHistory("example");
    expect(results).toHaveLength(1);
    expect(results[0].gapTarget.targetDomain).toBe("Example.com");
  });

  it("round-trips a saved competitor analysis through getCompetitorHistory", async () => {
    const analysis = makeCompetitorAnalysis();
    await storage.saveCompetitorAnalysis(analysis);
    const history = await storage.getCompetitorHistory();
    expect(history).toEqual([analysis]);
  });

  it("getCompetitorHistory filters by domain and query substrings", async () => {
    await storage.saveCompetitorAnalysis(
      makeCompetitorAnalysis({ targetDomain: "example.com", query: "best crm" }),
    );
    await storage.saveCompetitorAnalysis(
      makeCompetitorAnalysis({ targetDomain: "other.com", query: "best crm" }),
    );

    const results = await storage.getCompetitorHistory("example", "crm");
    expect(results).toHaveLength(1);
    expect(results[0].targetDomain).toBe("example.com");
  });

  it("getCompetitorHistory sorts newest analysedAt first", async () => {
    await storage.saveCompetitorAnalysis(
      makeCompetitorAnalysis({ analysedAt: "2026-08-01T00:00:00.000Z" }),
    );
    await storage.saveCompetitorAnalysis(
      makeCompetitorAnalysis({ analysedAt: "2026-08-03T00:00:00.000Z" }),
    );
    await storage.saveCompetitorAnalysis(
      makeCompetitorAnalysis({ analysedAt: "2026-08-02T00:00:00.000Z" }),
    );

    const results = await storage.getCompetitorHistory();
    expect(results.map((r) => r.analysedAt)).toEqual([
      "2026-08-03T00:00:00.000Z",
      "2026-08-02T00:00:00.000Z",
      "2026-08-01T00:00:00.000Z",
    ]);
  });
});

describe("D1Storage user isolation", () => {
  it("two users only ever see their own checks, gap results, and competitor analyses", async () => {
    const db = createFakeD1();
    const userA = new D1Storage(db, "user-a");
    const userB = new D1Storage(db, "user-b");

    await userA.save(makeCheck({ query: "user a's query" }));
    await userB.save(makeCheck({ query: "user b's query" }));
    await userA.saveGapResult(makeGapResult());
    await userB.saveGapResult(makeGapResult());
    await userA.saveCompetitorAnalysis(makeCompetitorAnalysis());
    await userB.saveCompetitorAnalysis(makeCompetitorAnalysis());

    const historyA = await userA.getHistory();
    expect(historyA).toHaveLength(1);
    expect(historyA[0].query).toBe("user a's query");

    const historyB = await userB.getHistory();
    expect(historyB).toHaveLength(1);
    expect(historyB[0].query).toBe("user b's query");

    expect(await userA.getGapHistory()).toHaveLength(1);
    expect(await userB.getGapHistory()).toHaveLength(1);
    expect(await userA.getCompetitorHistory()).toHaveLength(1);
    expect(await userB.getCompetitorHistory()).toHaveLength(1);
  });
});
