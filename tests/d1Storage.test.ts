import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { D1Database } from "@cloudflare/workers-types";
import { D1Storage } from "../src/adapters/D1Storage.js";
import {
  AeoCheckResult,
  GapAnalysisResult,
  CompetitorAnalysis,
} from "../src/core/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationSql = readFileSync(
  join(__dirname, "../migrations/0001_init.sql"),
  "utf-8",
);

// Minimal shim exposing only the D1Database surface D1Storage calls, backed by
// a real in-memory SQLite engine (better-sqlite3) so the adapter's actual SQL
// runs, without needing a workerd/Miniflare runtime.
function createFakeD1(): D1Database {
  const sqlite = new Database(":memory:");
  sqlite.exec(migrationSql);

  return {
    prepare(query: string) {
      const stmt = sqlite.prepare(query);
      let boundArgs: unknown[] = [];
      const statement = {
        bind(...args: unknown[]) {
          boundArgs = args;
          return statement;
        },
        async run() {
          stmt.run(...boundArgs);
          return {};
        },
        async all<U>() {
          return { results: stmt.all(...boundArgs) as U[] };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
}

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
    storage = new D1Storage(createFakeD1());
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
