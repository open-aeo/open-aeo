export interface TargetConfig {
  query: string;
  targetDomain: string;
  brandName?: string;
}

export interface EngineResponse {
  answerText: string;
  citations: string[];
}

export interface AeoCheckResult {
  query: string;
  targetDomain: string;
  cited: boolean;
  position: number | null; // e.g., 0 if target is the first citation, null if we lost
  competitorUrls: string[]; // If target lost, who won?
  timestamp: string;
}
