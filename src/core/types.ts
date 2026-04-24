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

export interface GapTarget {
  query: string;
  targetDomain: string;
  brandName?: string;
  competitorDomains: string[];
  peecOpportunityScore?: number;
  peecTopicName?: string;
  source: "peec" | "manual";
}

export interface GapAnalysisResult {
  gapTarget: GapTarget;
  liveCheck: AeoCheckResult;
  confirmedGap: boolean;
  peecConfirmed: boolean;
  liveConfirmed: boolean;
  topCompetitorNow: string | null;
  recommendation: string;
}

export interface GapReportSummary {
  targetDomain: string;
  brandName?: string;
  totalGapsAnalysed: number;
  confirmedGaps: number;
  peecOnlyGaps: number;
  liveOnlyGaps: number;
  alreadyFixed: number;
  results: GapAnalysisResult[];
  generatedAt: string;
}
