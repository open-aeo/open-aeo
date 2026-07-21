import { describe, it, expect } from "vitest";
import {
  handleAeoSources,
  handleAeoGenerateQueries,
} from "../src/mcp/tools.js";
import { IStorage } from "../src/ports/IStorage.js";
import { IQueryGenerator } from "../src/core/promptGenerator.js";
import {
  AeoCheckResult,
  CompetitorAnalysis,
  GapAnalysisResult,
} from "../src/core/types.js";

function check(query: string, competitorUrls: string[]): AeoCheckResult {
  return {
    query,
    targetDomain: "linear.app",
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

class HistoryStorage implements IStorage {
  constructor(private history: AeoCheckResult[]) {}
  async save(): Promise<void> {}
  async getHistory(): Promise<AeoCheckResult[]> {
    return this.history;
  }
  async saveGapResult(): Promise<void> {}
  async getGapHistory(): Promise<GapAnalysisResult[]> {
    return [];
  }
  async saveCompetitorAnalysis(): Promise<void> {}
  async getCompetitorHistory(): Promise<CompetitorAnalysis[]> {
    return [];
  }
}

describe("handleAeoSources", () => {
  it("reports the top domains from history", async () => {
    const storage = new HistoryStorage([
      check("q1", ["https://youtube.com/a", "https://reddit.com/b"]),
      check("q2", ["https://youtube.com/c"]),
    ]);
    const out = await handleAeoSources(storage);
    const text = out.content[0].text;
    expect(text).toContain("youtube.com");
    expect(text).toContain("2 appearance(s)");
  });

  it("handles no history gracefully", async () => {
    const out = await handleAeoSources(new HistoryStorage([]));
    expect(out.content[0].text).toMatch(/No stored checks/);
  });
});

describe("handleAeoGenerateQueries", () => {
  const generator: IQueryGenerator = {
    async generate(input: string, count: number): Promise<string[]> {
      return Array.from(
        { length: count },
        (_unused, i) => `${input} query ${i + 1}`,
      );
    },
  };

  it("formats generated queries for pasting into a config", async () => {
    const out = await handleAeoGenerateQueries(generator, "linear.app", 3);
    const text = out.content[0].text;
    expect(text).toContain("Generated 3 candidate queries");
    expect(text).toContain("- linear.app query 1");
    expect(text).toContain("queries.yaml");
  });

  it("reports when nothing is generated", async () => {
    const empty: IQueryGenerator = {
      async generate() {
        return [];
      },
    };
    const out = await handleAeoGenerateQueries(empty, "obscure", 5);
    expect(out.content[0].text).toMatch(/No queries generated/);
  });
});
