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

export interface PageSignals {
  url: string;
  fetchedAt: string;
  fetchError: string | null;
  wordCount: number | null;
  hasFaqSection: boolean;
  hasFaqSchema: boolean;
  hasComparisonTable: boolean;
  hasDirectAnswer: boolean;
  hasHowToSchema: boolean;
  hasArticleSchema: boolean;
  headingCount: number | null;
  internalLinkCount: number | null;
  externalLinkCount: number | null;
  hasLastModifiedDate: boolean;
  metaDescription: string | null;
  pageTitle: string | null;
  firstParagraph: string | null;
  schemaTypes: string[];
}

export interface CompetitorAnalysis {
  query: string;
  targetDomain: string;
  competitorUrl: string;
  competitorDomain: string;
  citationPosition: number;
  signals: PageSignals;
  analysedAt: string;
}

export interface RecommendedTask {
  priority: "high" | "medium" | "low";
  category: "content-structure" | "schema-markup" | "content-depth" | "freshness" | "authority";
  title: string;
  description: string;
  competitorEvidence: string;
}

export interface RecommendationReport {
  query: string;
  targetDomain: string;
  yourCited: boolean;
  yourPosition: number | null;
  competitors: CompetitorAnalysis[];
  tasks: RecommendedTask[];
  generatedAt: string;
}
