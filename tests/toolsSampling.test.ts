import { describe, it, expect } from "vitest";
import { runSingleCheck } from "../src/mcp/tools.js";
import { IAnswerEngine } from "../src/ports/IAnswerEngine.js";
import { IStorage } from "../src/ports/IStorage.js";
import {
  AeoCheckResult,
  CompetitorAnalysis,
  EngineName,
  EngineResponse,
  GapAnalysisResult,
} from "../src/core/types.js";

// Engine that cites the target on even-numbered calls and misses on odd ones, so
// a 4-sample run is cited exactly twice (a 50% rate).
function alternatingEngine(name: EngineName): IAnswerEngine {
  let call = 0;
  return {
    name,
    async search(): Promise<EngineResponse> {
      const cited = call % 2 === 0;
      call += 1;
      return {
        answerText: "",
        citations: cited
          ? ["https://linear.app/features", "https://asana.com"]
          : ["https://asana.com"],
      };
    },
  };
}

class RecordingStorage implements IStorage {
  saved: AeoCheckResult[] = [];
  async save(result: AeoCheckResult): Promise<void> {
    this.saved.push(result);
  }
  async getHistory(): Promise<AeoCheckResult[]> {
    return this.saved;
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

describe("runSingleCheck with sampling", () => {
  it("aggregates N samples into one saved result with a citation rate", async () => {
    const storage = new RecordingStorage();
    const result = await runSingleCheck(
      alternatingEngine("perplexity"),
      storage,
      { query: "best pm tool", targetDomain: "linear.app" },
      4,
    );

    expect(result.sampleCount).toBe(4);
    expect(result.citedCount).toBe(2);
    expect(result.citationRate).toBe(0.5);
    expect(result.cited).toBe(true);
    expect(result.position).toBe(0);
    expect(result.competitorUrls).toContain("https://asana.com");

    // One aggregated row is saved, not one per sample.
    expect(storage.saved).toHaveLength(1);
    expect(storage.saved[0].sampleCount).toBe(4);
  });

  it("defaults to a single sample", async () => {
    const storage = new RecordingStorage();
    const result = await runSingleCheck(
      alternatingEngine("perplexity"),
      storage,
      {
        query: "q",
        targetDomain: "linear.app",
      },
    );
    expect(result.sampleCount).toBe(1);
    expect(storage.saved).toHaveLength(1);
  });
});
