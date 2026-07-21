export interface TargetConfig {
  query: string;
  targetDomain: string;
  brandName?: string;
}

// Identifier for an answer engine. Each adapter reports its own name so
// results can be attributed to the engine that produced them.
export type EngineName = "perplexity" | "chatgpt" | "google-ai-overviews";

export const DEFAULT_ENGINE: EngineName = "perplexity";

export interface EngineResponse {
  answerText: string;
  citations: string[];
}

export interface AeoCheckResult {
  query: string;
  targetDomain: string;
  engine: EngineName; // which answer engine produced this result
  model: string; // the specific model behind that engine (e.g. "sonar", "gpt-4o")
  cited: boolean; // cited in at least one sample (citedCount > 0)
  position: number | null; // best (lowest) position among cited samples, null if never cited
  competitorUrls: string[]; // deduped union of competitors seen across samples
  timestamp: string;
  // Sampling fields. LLM answers are non-deterministic, so a check may run the
  // same query N times and aggregate. A single-sample check has sampleCount 1,
  // and old records without these fields read back as a single sample.
  sampleCount: number; // number of samples aggregated into this result (>= 1)
  citedCount: number; // how many of those samples cited the target
  citationRate: number; // citedCount / sampleCount, in [0, 1]
  positions: number[]; // position from each cited sample, for variance / median
  // Spread (population standard deviation) of the cited positions: how jumpy the
  // result is between runs. null when there are fewer than two cited positions,
  // i.e. not enough data to have a spread. Old records read back as null.
  positionSpread: number | null;
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
  category:
    | "content-structure"
    | "schema-markup"
    | "content-depth"
    | "freshness"
    | "authority";
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
