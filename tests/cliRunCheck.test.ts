import { describe, it, expect } from "vitest";
import { runConfigCheck } from "../src/cli/runCheck.js";
import { EngineRegistry } from "../src/core/engineRegistry.js";
import { IAnswerEngine } from "../src/ports/IAnswerEngine.js";
import { IStorage } from "../src/ports/IStorage.js";
import {
  AeoCheckResult,
  CompetitorAnalysis,
  EngineResponse,
  GapAnalysisResult,
} from "../src/core/types.js";

// Cites linear.app for queries containing "hit", not otherwise.
const fakeEngine: IAnswerEngine = {
  name: "perplexity",
  model: "sonar",
  async search(query: string): Promise<EngineResponse> {
    return query.includes("hit")
      ? {
          answerText: "",
          citations: ["https://linear.app/x", "https://asana.com"],
        }
      : { answerText: "", citations: ["https://asana.com"] };
  },
};

class SeededStorage implements IStorage {
  saved: AeoCheckResult[];
  constructor(prior: AeoCheckResult[]) {
    this.saved = [...prior];
  }
  async save(result: AeoCheckResult): Promise<void> {
    this.saved.push(result);
  }
  async getHistory(): Promise<AeoCheckResult[]> {
    return [...this.saved]; // copy, so the run's own saves don't leak into the snapshot
  }
  async saveGapResult(_r: GapAnalysisResult): Promise<void> {}
  async getGapHistory(): Promise<GapAnalysisResult[]> {
    return [];
  }
  async saveCompetitorAnalysis(_a: CompetitorAnalysis): Promise<void> {}
  async getCompetitorHistory(): Promise<CompetitorAnalysis[]> {
    return [];
  }
}

function prior(query: string, cited: boolean): AeoCheckResult {
  return {
    query,
    targetDomain: "linear.app",
    engine: "perplexity",
    model: "sonar",
    cited,
    position: cited ? 0 : null,
    competitorUrls: [],
    timestamp: "2026-07-20T10:00:00.000Z",
    sampleCount: 1,
    citedCount: cited ? 1 : 0,
    citationRate: cited ? 1 : 0,
    positions: cited ? [0] : [],
    positionSpread: null,
  };
}

describe("runConfigCheck", () => {
  const registry = new EngineRegistry().register(fakeEngine);

  it("checks every query, computes trend, and flags drops", async () => {
    // "miss query" was cited last run; now it is not -> a drop.
    const storage = new SeededStorage([
      prior("hit query", false),
      prior("miss query", true),
    ]);

    const report = await runConfigCheck(registry, storage, {
      targetDomain: "linear.app",
      samples: 1,
      queries: ["hit query", "miss query"],
    });

    expect(report.outcomes).toHaveLength(2);

    const hit = report.outcomes.find((o) => o.result.query === "hit query")!;
    expect(hit.result.cited).toBe(true);
    expect(hit.trend.direction).toBe("up"); // 0 -> 1
    expect(hit.dropped).toBe(false);

    const miss = report.outcomes.find((o) => o.result.query === "miss query")!;
    expect(miss.result.cited).toBe(false);
    expect(miss.dropped).toBe(true); // was cited, now not
    expect(report.droppedCount).toBe(1);
  });

  it("marks a first-ever query as new, not dropped", async () => {
    const storage = new SeededStorage([]);
    const report = await runConfigCheck(registry, storage, {
      targetDomain: "linear.app",
      samples: 1,
      queries: ["miss query"],
    });
    expect(report.outcomes[0].trend.direction).toBe("new");
    expect(report.droppedCount).toBe(0);
  });
});
