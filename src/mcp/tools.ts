import { parseAeoResponse } from "../core/citationParser.js";
import {
  AeoCheckResult,
  GapTarget,
  RecommendationReport,
  TargetConfig,
} from "../core/types.js";
import { IAnswerEngine } from "../ports/IAnswerEngine.js";
import { IStorage } from "../ports/IStorage.js";
import { runGapReport, formatGapReport } from "../core/gapAnalyser.js";
import {
  analyseCompetitor,
  buildRecommendationReport,
} from "../core/contentAnalyser.js";
import { PageFetcher } from "../adapters/PageFetcher.js";

export async function handleAeoGapReport(
  engine: IAnswerEngine,
  storage: IStorage,
  gaps: GapTarget[],
  delayMs?: number,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const summary = await runGapReport(engine, storage, gaps, delayMs);
  const report = formatGapReport(summary);
  return { content: [{ type: "text", text: report }] };
}

export async function handleAeoGapHistory(
  storage: IStorage,
  domain?: string,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const history = await storage.getGapHistory(domain);

  if (history.length === 0) {
    return { content: [{ type: "text", text: "No gap history found." }] };
  }

  // Group by query, keep most recent result per query
  const byQuery = new Map<string, (typeof history)[number]>();
  for (const result of history) {
    const existing = byQuery.get(result.gapTarget.query);
    if (
      !existing ||
      result.liveCheck.timestamp > existing.liveCheck.timestamp
    ) {
      byQuery.set(result.gapTarget.query, result);
    }
  }

  const label = domain ?? "all domains";
  const lines = [`Gap History -- ${label} (${byQuery.size} entries)`, ""];

  for (const r of byQuery.values()) {
    const marker = r.confirmedGap
      ? "[!!]"
      : r.liveConfirmed
        ? "[!]"
        : r.peecConfirmed
          ? "[~]"
          : "[ok]";
    const date = new Date(r.liveCheck.timestamp).toLocaleDateString();
    const competitor = r.topCompetitorNow ?? "none";
    lines.push(
      `${marker} "${r.gapTarget.query}" -- ${date} -- top competitor: ${competitor}`,
    );
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

export async function handleAeoHistory(
  storage: IStorage,
  query?: string,
  domain?: string,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  let history = await storage.getHistory(query);

  if (domain) {
    const lowerDomain = domain.toLowerCase();
    history = history.filter((r) =>
      r.targetDomain.toLowerCase().includes(lowerDomain),
    );
  }

  const header = `History: ${history.length} results`;
  const lines = history.map(
    (r) =>
      `${r.cited ? "✅" : "❌"} "${r.query}" — ${r.targetDomain} — position: ${r.position ?? "N/A"} — ${new Date(r.timestamp).toLocaleDateString()}`,
  );

  return {
    content: [{ type: "text", text: [header, ...lines].join("\n") }],
  };
}

export async function runSingleCheck(
  engine: IAnswerEngine,
  storage: IStorage,
  config: TargetConfig,
): Promise<AeoCheckResult> {
  const response = await engine.search(config.query);
  const result = parseAeoResponse(config, response);
  await storage.save(result);
  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function handleAeoCheck(
  engine: IAnswerEngine,
  storage: IStorage,
  config: TargetConfig,
) {
  const result = await runSingleCheck(engine, storage, config);

  return {
    content: [
      {
        type: "text" as const,
        text: [
          `AEO Check Complete.`,
          `Query:         "${result.query}"`,
          `Target Domain: ${result.targetDomain}`,
          `Cited:         ${result.cited ? "YES" : "NO"}`,
          `Position:      ${result.position ?? "N/A"}`,
          ``,
          `Top Competitors Cited:`,
          ...result.competitorUrls
            .slice(0, 3)
            .map((url, i) => `  ${i + 1}. ${url}`),
        ].join("\n"),
      },
    ],
  };
}

function formatRecommendationReport(report: RecommendationReport): string {
  const citedLine = report.yourCited
    ? `Cited at position ${report.yourPosition ?? "?"}`
    : "Not cited";

  const lines: string[] = [
    `Recommendation Report`,
    `Query:         "${report.query}"`,
    `Target Domain: ${report.targetDomain}`,
    `Your Status:   ${citedLine}`,
    `Competitors Analysed: ${report.competitors.length}`,
    `Generated:     ${new Date(report.generatedAt).toLocaleString()}`,
    ``,
  ];

  if (report.competitors.length > 0) {
    lines.push(`Competitor Pages:`);
    for (const c of report.competitors) {
      const status = c.signals.fetchError
        ? `fetch error: ${c.signals.fetchError}`
        : `${c.signals.wordCount ?? "?"} words, ${c.signals.headingCount ?? "?"} headings`;
      lines.push(`  ${c.citationPosition + 1}. ${c.competitorDomain} -- ${status}`);
    }
    lines.push(``);
  }

  if (report.tasks.length === 0) {
    lines.push(`No specific recommendations generated.`);
  } else {
    lines.push(`Recommended Actions (${report.tasks.length}):`);
    lines.push(``);
    for (const task of report.tasks) {
      const marker =
        task.priority === "high"
          ? "[HIGH]"
          : task.priority === "medium"
            ? "[MED] "
            : "[LOW] ";
      lines.push(`${marker} ${task.title}`);
      lines.push(`       Category: ${task.category}`);
      lines.push(`       ${task.description}`);
      lines.push(`       Evidence: ${task.competitorEvidence}`);
      lines.push(``);
    }
  }

  return lines.join("\n");
}

export async function handleAeoAnalyse(
  fetcher: PageFetcher,
  storage: IStorage,
  competitorUrl: string,
  query: string,
  targetDomain: string,
  citationPosition: number,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const analysis = await analyseCompetitor(
    fetcher,
    query,
    targetDomain,
    competitorUrl,
    citationPosition,
  );
  await storage.saveCompetitorAnalysis(analysis);

  const statusLine = analysis.signals.fetchError
    ? `Fetch failed: ${analysis.signals.fetchError}`
    : `Fetched OK`;

  const lines = [
    `Competitor Analysis`,
    `URL:           ${analysis.competitorUrl}`,
    `Domain:        ${analysis.competitorDomain}`,
    `Query:         "${analysis.query}"`,
    `Position:      ${analysis.citationPosition + 1}`,
    `Status:        ${statusLine}`,
    ``,
    `Page Signals:`,
    `  Word count:       ${analysis.signals.wordCount ?? "N/A"}`,
    `  Heading count:    ${analysis.signals.headingCount ?? "N/A"}`,
    `  FAQ section:      ${analysis.signals.hasFaqSection ? "yes" : "no"}`,
    `  FAQ schema:       ${analysis.signals.hasFaqSchema ? "yes" : "no"}`,
    `  Article schema:   ${analysis.signals.hasArticleSchema ? "yes" : "no"}`,
    `  HowTo schema:     ${analysis.signals.hasHowToSchema ? "yes" : "no"}`,
    `  Direct answer:    ${analysis.signals.hasDirectAnswer ? "yes" : "no"}`,
    `  Comparison table: ${analysis.signals.hasComparisonTable ? "yes" : "no"}`,
    `  Last modified:    ${analysis.signals.hasLastModifiedDate ? "yes" : "no"}`,
    `  Meta description: ${analysis.signals.metaDescription ?? "none"}`,
  ];

  if (analysis.signals.schemaTypes.length > 0) {
    lines.push(`  Schema types:     ${analysis.signals.schemaTypes.join(", ")}`);
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

export async function handleAeoRecommend(
  engine: IAnswerEngine,
  fetcher: PageFetcher,
  storage: IStorage,
  config: TargetConfig,
  maxCompetitors = 3,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const checkResult = await runSingleCheck(engine, storage, config);
  const report = await buildRecommendationReport(fetcher, checkResult, maxCompetitors);
  return { content: [{ type: "text", text: formatRecommendationReport(report) }] };
}

export async function handleAeoReport(
  engine: IAnswerEngine,
  storage: IStorage,
  configs: TargetConfig[],
  delayMs = 2000,
) {
  type BatchEntry =
    | { ok: true; result: AeoCheckResult }
    | { ok: false; query: string; error: string };

  const entries: BatchEntry[] = [];

  for (const config of configs) {
    try {
      const result = await runSingleCheck(engine, storage, config);
      entries.push({ ok: true, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      entries.push({ ok: false, query: config.query, error: message });
    }
    if (config !== configs.at(-1)) await sleep(delayMs);
  }

  const wins = entries.filter((e) => e.ok && e.result.cited).length;
  const losses = entries.filter((e) => e.ok && !e.result.cited).length;
  const errors = entries.filter((e) => !e.ok).length;

  const lines = entries.map((e) =>
    e.ok
      ? `${e.result.cited ? "✅" : "❌"}  "${e.result.query}" — ${
          e.result.cited
            ? `cited at position ${e.result.position}`
            : `not cited · top result: ${e.result.competitorUrls[0] ?? "none"}`
        }`
      : `⚠️  "${e.query}" — error: ${e.error}`,
  );

  return {
    content: [
      {
        type: "text" as const,
        text: [
          `Batch Report — ${configs.length} queries`,
          `✅ ${wins} cited  ❌ ${losses} not cited  ${errors > 0 ? `⚠️ ${errors} errors` : ""}`,
          ``,
          ...lines,
        ].join("\n"),
      },
    ],
  };
}
