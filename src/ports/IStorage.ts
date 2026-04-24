import { AeoCheckResult, GapAnalysisResult, CompetitorAnalysis } from "../core/types.js";

export interface IStorage {
  save(result: AeoCheckResult): Promise<void>;
  getHistory(query?: string): Promise<AeoCheckResult[]>;
  saveGapResult(result: GapAnalysisResult): Promise<void>;
  getGapHistory(domain?: string): Promise<GapAnalysisResult[]>;
  saveCompetitorAnalysis(analysis: CompetitorAnalysis): Promise<void>;
  getCompetitorHistory(domain?: string, query?: string): Promise<CompetitorAnalysis[]>;
}
