import { describe, it, expect } from "vitest";
import { runChecksAcrossEngines } from "../src/mcp/tools.js";
import { IAnswerEngine } from "../src/ports/IAnswerEngine.js";
import { IStorage } from "../src/ports/IStorage.js";
import {
  AeoCheckResult,
  CompetitorAnalysis,
  EngineName,
  EngineResponse,
  GapAnalysisResult,
  TargetConfig,
} from "../src/core/types.js";

function fakeEngine(name: EngineName, citations: string[]): IAnswerEngine {
  return {
    name,
    async search(): Promise<EngineResponse> {
      return { answerText: "", citations };
    },
  };
}

// Records what gets saved so the test can assert one result is persisted per
// engine. Only save/getHistory are exercised here.
class RecordingStorage implements IStorage {
  saved: AeoCheckResult[] = [];
  async save(result: AeoCheckResult): Promise<void> {
    this.saved.push(result);
  }
  async getHistory(): Promise<AeoCheckResult[]> {
    return this.saved;
  }
  async saveGapResult(_result: GapAnalysisResult): Promise<void> {}
  async getGapHistory(): Promise<GapAnalysisResult[]> {
    return [];
  }
  async saveCompetitorAnalysis(_analysis: CompetitorAnalysis): Promise<void> {}
  async getCompetitorHistory(): Promise<CompetitorAnalysis[]> {
    return [];
  }
}

describe("runChecksAcrossEngines", () => {
  const config: TargetConfig = {
    query: "best project management tool",
    targetDomain: "linear.app",
  };

  it("returns one result per engine, tagged with the engine name", async () => {
    const storage = new RecordingStorage();
    const engines = [
      fakeEngine("perplexity", ["https://linear.app/features"]),
      fakeEngine("chatgpt", ["https://asana.com"]),
    ];

    const results = await runChecksAcrossEngines(engines, storage, config);

    expect(results.map((r) => r.engine)).toEqual(["perplexity", "chatgpt"]);
    // Perplexity cited linear.app at position 0; ChatGPT did not cite it.
    expect(results[0].cited).toBe(true);
    expect(results[0].position).toBe(0);
    expect(results[1].cited).toBe(false);
  });

  it("persists one result per engine", async () => {
    const storage = new RecordingStorage();
    const engines = [fakeEngine("perplexity", []), fakeEngine("chatgpt", [])];

    await runChecksAcrossEngines(engines, storage, config);

    expect(storage.saved).toHaveLength(2);
    expect(storage.saved.map((r) => r.engine)).toEqual([
      "perplexity",
      "chatgpt",
    ]);
  });
});
