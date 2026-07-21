import { IStorage } from "../ports/IStorage.js";
import {
  AeoCheckResult,
  GapAnalysisResult,
  CompetitorAnalysis,
} from "../core/types.js";

// In-memory storage for environments without a filesystem (e.g. Cloudflare
// Workers). It is per-instance and does NOT persist across requests — history
// resets each time. A durable backend (D1/KV) is tracked in BRG-142; until then
// the hosted Worker is stateless.
export class MemoryStorage implements IStorage {
  private history: AeoCheckResult[] = [];
  private gapHistory: GapAnalysisResult[] = [];
  private competitorHistory: CompetitorAnalysis[] = [];

  async save(result: AeoCheckResult): Promise<void> {
    this.history.push(result);
  }

  async getHistory(query?: string): Promise<AeoCheckResult[]> {
    if (!query) return [...this.history];
    return this.history.filter(
      (item) => item.query.toLowerCase() === query.toLowerCase(),
    );
  }

  async saveGapResult(result: GapAnalysisResult): Promise<void> {
    this.gapHistory.push(result);
  }

  async getGapHistory(domain?: string): Promise<GapAnalysisResult[]> {
    if (!domain) return [...this.gapHistory];
    const lower = domain.toLowerCase();
    return this.gapHistory.filter((item) =>
      item.gapTarget.targetDomain.toLowerCase().includes(lower),
    );
  }

  async saveCompetitorAnalysis(analysis: CompetitorAnalysis): Promise<void> {
    this.competitorHistory.push(analysis);
  }

  async getCompetitorHistory(
    domain?: string,
    query?: string,
  ): Promise<CompetitorAnalysis[]> {
    return this.competitorHistory.filter((item) => {
      if (
        domain &&
        !item.targetDomain.toLowerCase().includes(domain.toLowerCase())
      ) {
        return false;
      }
      if (query && !item.query.toLowerCase().includes(query.toLowerCase())) {
        return false;
      }
      return true;
    });
  }
}
