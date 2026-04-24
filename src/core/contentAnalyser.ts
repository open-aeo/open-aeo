import { PageFetcher } from "../adapters/PageFetcher.js";
import {
  AeoCheckResult,
  CompetitorAnalysis,
  PageSignals,
  RecommendationReport,
  RecommendedTask,
} from "./types.js";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function makeErrorSignals(url: string, message: string): PageSignals {
  return {
    url,
    fetchedAt: new Date().toISOString(),
    fetchError: message,
    wordCount: null,
    hasFaqSection: false,
    hasFaqSchema: false,
    hasComparisonTable: false,
    hasDirectAnswer: false,
    hasHowToSchema: false,
    hasArticleSchema: false,
    headingCount: null,
    internalLinkCount: null,
    externalLinkCount: null,
    hasLastModifiedDate: false,
    metaDescription: null,
    pageTitle: null,
    firstParagraph: null,
    schemaTypes: [],
  };
}

// ---------------------------------------------------------------------------
// Function 1 — analyseCompetitor
// ---------------------------------------------------------------------------

export async function analyseCompetitor(
  fetcher: PageFetcher,
  query: string,
  targetDomain: string,
  competitorUrl: string,
  citationPosition: number,
): Promise<CompetitorAnalysis> {
  let competitorDomain: string;
  try {
    competitorDomain = new URL(competitorUrl).hostname;
  } catch {
    competitorDomain = competitorUrl;
  }

  let signals: PageSignals;
  try {
    signals = await fetcher.fetch(competitorUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    signals = makeErrorSignals(competitorUrl, message);
  }

  return {
    query,
    targetDomain,
    competitorUrl,
    competitorDomain,
    citationPosition,
    signals,
    analysedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Function 2 — generateTasks
// ---------------------------------------------------------------------------

export function generateTasks(
  competitors: CompetitorAnalysis[],
  yourCited: boolean,
): RecommendedTask[] {
  const tasks: RecommendedTask[] = [];

  const domainsWithSignal = (
    predicate: (s: PageSignals) => boolean,
  ): string[] =>
    competitors
      .filter((c) => predicate(c.signals))
      .map((c) => c.competitorDomain);

  const found = (domains: string[]): string =>
    `Found on: ${domains.join(", ")}`;

  // Check 1 — FAQ section (schema or section element)
  const faqDomains = domainsWithSignal(
    (s) => s.hasFaqSchema || s.hasFaqSection,
  );
  if (faqDomains.length > 0) {
    tasks.push({
      priority: "high",
      category: "content-structure",
      title: "Add an FAQ section",
      description:
        "Create a dedicated FAQ section that directly answers common " +
        "questions about this topic. Use clear question headings and concise answers. " +
        "Structure each answer to stand alone as a complete sentence.",
      competitorEvidence: found(faqDomains),
    });
  }

  // Check 2 — Direct answer in first paragraph
  const directAnswerDomains = domainsWithSignal((s) => s.hasDirectAnswer);
  if (directAnswerDomains.length > 0 && !yourCited) {
    tasks.push({
      priority: "high",
      category: "content-structure",
      title: "Lead with a direct answer",
      description:
        "Rewrite the opening paragraph to directly answer the query in the first sentence. " +
        "Answer engines extract the first paragraph first. The opening sentence should " +
        "state the answer definitively, not introduce context.",
      competitorEvidence: found(directAnswerDomains),
    });
  }

  // Check 3 — FAQPage schema markup
  const faqSchemaDomains = domainsWithSignal((s) => s.hasFaqSchema);
  if (faqSchemaDomains.length > 0) {
    tasks.push({
      priority: "high",
      category: "schema-markup",
      title: "Add FAQPage schema markup",
      description:
        "Implement application/ld+json schema with @type FAQPage. " +
        "Each question and answer in your FAQ section should be represented as " +
        "a Question entity with acceptedAnswer. This is machine-readable and " +
        "directly increases the chance of citation.",
      competitorEvidence: found(faqSchemaDomains),
    });
  }

  // Check 4 — Article or BlogPosting schema
  const articleSchemaDomains = domainsWithSignal((s) => s.hasArticleSchema);
  if (articleSchemaDomains.length > 0) {
    tasks.push({
      priority: "medium",
      category: "schema-markup",
      title: "Add Article schema markup",
      description:
        "Add application/ld+json with @type Article or BlogPosting. " +
        "Include datePublished, dateModified, author, and headline fields. " +
        "Answer engines use this to assess content freshness and authorship.",
      competitorEvidence: found(articleSchemaDomains),
    });
  }

  // Check 5 — HowTo schema
  const howToSchemaDomains = domainsWithSignal((s) => s.hasHowToSchema);
  if (howToSchemaDomains.length > 0) {
    tasks.push({
      priority: "medium",
      category: "schema-markup",
      title: "Add HowTo schema markup",
      description:
        "If this page answers a procedural question, implement " +
        "application/ld+json with @type HowTo. Include named steps with " +
        "descriptions. Answer engines use HowTo schema for step-by-step queries.",
      competitorEvidence: found(howToSchemaDomains),
    });
  }

  // Check 6 — Comparison table
  const comparisonTableDomains = domainsWithSignal((s) => s.hasComparisonTable);
  if (comparisonTableDomains.length > 0) {
    tasks.push({
      priority: "medium",
      category: "content-structure",
      title: "Add a comparison table",
      description:
        "Include an HTML table comparing your product or approach against " +
        "relevant alternatives. Tables with 3 or more columns are frequently " +
        "extracted by answer engines for comparative queries. Use clear column headers.",
      competitorEvidence: found(comparisonTableDomains),
    });
  }

  // Check 7 — Content depth (word count)
  const competitorsWithWords = competitors.filter(
    (c) => c.signals.wordCount !== null && c.signals.wordCount > 0,
  );
  if (competitorsWithWords.length > 0) {
    const totalWords = competitorsWithWords.reduce(
      (sum, c) => sum + (c.signals.wordCount ?? 0),
      0,
    );
    const averageWordCount = totalWords / competitorsWithWords.length;
    if (averageWordCount > 800) {
      const wordEvidence = competitorsWithWords
        .map((c) => `${c.competitorDomain} (${c.signals.wordCount} words)`)
        .join(", ");
      tasks.push({
        priority: "medium",
        category: "content-depth",
        title: "Increase content depth",
        description:
          `Cited competitor pages average ${Math.round(averageWordCount)} words on this topic. ` +
          "Expand your coverage with specific data points, examples, and sub-topics. " +
          "Answer engines favour pages that comprehensively cover a topic over shorter overviews.",
        competitorEvidence: wordEvidence,
      });
    }
  }

  // Check 8 — Freshness signals
  const freshnessDomains = domainsWithSignal((s) => s.hasLastModifiedDate);
  if (freshnessDomains.length > 0) {
    tasks.push({
      priority: "low",
      category: "freshness",
      title: "Add a visible last-updated date",
      description:
        "Add a last-updated date to the page, both visibly in the content and in the " +
        "dateModified field of your Article schema. Answer engines discount outdated content. " +
        "If the page has been recently updated, make that visible.",
      competitorEvidence: found(freshnessDomains),
    });
  }

  // Check 9 — Heading structure
  const competitorsWithHeadings = competitors.filter(
    (c) => c.signals.headingCount !== null && c.signals.headingCount > 0,
  );
  if (competitorsWithHeadings.length > 0) {
    const totalHeadings = competitorsWithHeadings.reduce(
      (sum, c) => sum + (c.signals.headingCount ?? 0),
      0,
    );
    const averageHeadingCount = totalHeadings / competitorsWithHeadings.length;
    if (averageHeadingCount > 3) {
      const headingEvidence = competitorsWithHeadings
        .map((c) => `${c.competitorDomain} (${c.signals.headingCount} headings)`)
        .join(", ");
      tasks.push({
        priority: "low",
        category: "content-structure",
        title: "Improve heading structure",
        description:
          `Cited competitor pages use an average of ${Math.round(averageHeadingCount)} headings ` +
          "to break up content. Use descriptive h2 and h3 headings that frame sub-topics as " +
          "questions or statements answer engines can extract.",
        competitorEvidence: headingEvidence,
      });
    }
  }

  // Sort: high first, then medium, then low; stable within same priority
  const priorityOrder: Record<RecommendedTask["priority"], number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return tasks;
}

// ---------------------------------------------------------------------------
// Function 3 — buildRecommendationReport
// ---------------------------------------------------------------------------

export async function buildRecommendationReport(
  fetcher: PageFetcher,
  checkResult: AeoCheckResult,
  maxCompetitors = 3,
): Promise<RecommendationReport> {
  const urls = checkResult.competitorUrls.slice(0, maxCompetitors);
  const competitors: CompetitorAnalysis[] = [];

  for (let i = 0; i < urls.length; i++) {
    const analysis = await analyseCompetitor(
      fetcher,
      checkResult.query,
      checkResult.targetDomain,
      urls[i],
      i,
    );
    competitors.push(analysis);
    if (i < urls.length - 1) {
      await sleep(500);
    }
  }

  const tasks = generateTasks(competitors, checkResult.cited);

  return {
    query: checkResult.query,
    targetDomain: checkResult.targetDomain,
    yourCited: checkResult.cited,
    yourPosition: checkResult.position,
    competitors,
    tasks,
    generatedAt: new Date().toISOString(),
  };
}
