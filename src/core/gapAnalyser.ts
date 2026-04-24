import {
  GapTarget,
  GapAnalysisResult,
  GapReportSummary,
  AeoCheckResult,
} from "./types.js";
import { parseAeoResponse } from "./citationParser.js";
import { IAnswerEngine } from "../ports/IAnswerEngine.js";
import { IStorage } from "../ports/IStorage.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateRecommendation(gap: GapAnalysisResult): string {
  const { confirmedGap, peecConfirmed, liveConfirmed, topCompetitorNow, gapTarget } =
    gap;
  const { query, peecOpportunityScore } = gapTarget;

  if (confirmedGap) {
    return (
      `[!!] CONFIRMED GAP: You are not cited for "${query}". ` +
      `${topCompetitorNow} is winning. Action: Create or update content targeting ` +
      `this query. Focus on ${query}-specific structured content (FAQ, how-to, or ` +
      `comparison page). Opportunity score: ${peecOpportunityScore ?? "N/A"}.`
    );
  }

  if (peecConfirmed && !liveConfirmed) {
    return (
      `[~] CLOSING GAP: Peec data shows you previously lost "${query}", but you ` +
      `are now cited live on Perplexity. Monitor for consistency across other ` +
      `AI engines. No immediate action needed.`
    );
  }

  if (!peecConfirmed && liveConfirmed) {
    return (
      `[!] EMERGING GAP: Live check shows you are not cited for "${query}" on ` +
      `Perplexity. This may be a newly emerged gap not yet in Peec data. ` +
      `Monitor and consider refreshing relevant content.`
    );
  }

  return `[ok] NO GAP: You are cited for "${query}" in both Peec data and live check.`;
}

export async function analyseGap(
  engine: IAnswerEngine,
  storage: IStorage,
  gap: GapTarget,
): Promise<GapAnalysisResult> {
  const response = await engine.search(gap.query);
  const liveCheck: AeoCheckResult = parseAeoResponse(
    { query: gap.query, targetDomain: gap.targetDomain, brandName: gap.brandName },
    response,
  );

  const peecConfirmed = gap.source === "peec";
  const liveConfirmed = !liveCheck.cited;
  const confirmedGap = peecConfirmed && liveConfirmed;
  const topCompetitorNow = liveCheck.competitorUrls[0] ?? null;

  const partial: GapAnalysisResult = {
    gapTarget: gap,
    liveCheck,
    confirmedGap,
    peecConfirmed,
    liveConfirmed,
    topCompetitorNow,
    recommendation: "",
  };

  const fullResult: GapAnalysisResult = {
    ...partial,
    recommendation: generateRecommendation(partial),
  };

  await storage.saveGapResult(fullResult);
  return fullResult;
}

export async function runGapReport(
  engine: IAnswerEngine,
  storage: IStorage,
  gaps: GapTarget[],
  delayMs = 2000,
): Promise<GapReportSummary> {
  if (gaps.length === 0) {
    throw new Error("No gap targets provided.");
  }

  // Determine the most common targetDomain across all gaps
  const domainFreq = new Map<string, number>();
  for (const g of gaps) {
    domainFreq.set(g.targetDomain, (domainFreq.get(g.targetDomain) ?? 0) + 1);
  }
  let targetDomain = gaps[0].targetDomain;
  let maxDomainCount = 0;
  for (const [domain, count] of domainFreq) {
    if (count > maxDomainCount) {
      maxDomainCount = count;
      targetDomain = domain;
    }
  }

  // Determine the most common brandName across all gaps
  const brandFreq = new Map<string, number>();
  for (const g of gaps) {
    if (g.brandName) {
      brandFreq.set(g.brandName, (brandFreq.get(g.brandName) ?? 0) + 1);
    }
  }
  let brandName: string | undefined;
  let maxBrandCount = 0;
  for (const [brand, count] of brandFreq) {
    if (count > maxBrandCount) {
      maxBrandCount = count;
      brandName = brand;
    }
  }

  const results: GapAnalysisResult[] = [];

  for (let i = 0; i < gaps.length; i++) {
    try {
      const result = await analyseGap(engine, storage, gaps[i]);
      results.push(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error analysing gap for "${gaps[i].query}": ${message}`);
    }
    if (i < gaps.length - 1) {
      await sleep(delayMs);
    }
  }

  const confirmedGaps = results.filter((r) => r.confirmedGap).length;
  const peecOnlyGaps = results.filter((r) => r.peecConfirmed && !r.liveConfirmed).length;
  const liveOnlyGaps = results.filter((r) => !r.peecConfirmed && r.liveConfirmed).length;
  const alreadyFixed = results.filter((r) => r.peecConfirmed && !r.liveConfirmed).length;

  return {
    targetDomain,
    brandName,
    totalGapsAnalysed: results.length,
    confirmedGaps,
    peecOnlyGaps,
    liveOnlyGaps,
    alreadyFixed,
    results,
    generatedAt: new Date().toISOString(),
  };
}

export function formatGapReport(summary: GapReportSummary): string {
  const confirmed = summary.results
    .filter((r) => r.confirmedGap)
    .sort(
      (a, b) =>
        (b.gapTarget.peecOpportunityScore ?? 0) -
        (a.gapTarget.peecOpportunityScore ?? 0),
    );
  const emerging = summary.results.filter(
    (r) => !r.peecConfirmed && r.liveConfirmed,
  );
  const closing = summary.results.filter(
    (r) => r.peecConfirmed && !r.liveConfirmed,
  );
  const alreadyCited = summary.results.filter(
    (r) => !r.peecConfirmed && !r.liveConfirmed,
  );

  const alreadyCitedCount =
    summary.totalGapsAnalysed -
    summary.confirmedGaps -
    summary.liveOnlyGaps -
    summary.peecOnlyGaps;

  const divider = "=".repeat(43);
  const subDivider = "-".repeat(41);
  const date = new Date(summary.generatedAt).toLocaleString();

  const lines: string[] = [
    divider,
    `AEO GAP REPORT -- ${summary.targetDomain}`,
    `Generated: ${date}`,
    divider,
    "",
    "SUMMARY",
    `Total gaps analysed:  ${summary.totalGapsAnalysed}`,
    `[!!] Confirmed gaps:  ${summary.confirmedGaps}  (both Peec + live)`,
    `[!]  Emerging gaps:   ${summary.liveOnlyGaps}  (live only)`,
    `[~]  Closing gaps:    ${summary.peecOnlyGaps}  (Peec gap, now cited live)`,
    `[ok] Already cited:   ${alreadyCitedCount}`,
  ];

  if (confirmed.length > 0) {
    lines.push(
      "",
      subDivider,
      "[!!] CONFIRMED GAPS (act on these first)",
      subDivider,
      "",
    );
    confirmed.forEach((r, i) => {
      lines.push(
        `${i + 1}. "${r.gapTarget.query}"`,
        `   Top competitor: ${r.topCompetitorNow ?? "N/A"}`,
        `   Opportunity score: ${r.gapTarget.peecOpportunityScore ?? "N/A"}`,
        `   -> ${r.recommendation}`,
        "",
      );
    });
  }

  if (emerging.length > 0) {
    lines.push(subDivider, "[!] EMERGING GAPS (live only)", subDivider, "");
    emerging.forEach((r, i) => {
      lines.push(
        `${i + 1}. "${r.gapTarget.query}"`,
        `   Top competitor: ${r.topCompetitorNow ?? "N/A"}`,
        `   -> ${r.recommendation}`,
        "",
      );
    });
  }

  if (closing.length > 0) {
    lines.push(
      subDivider,
      "[~] CLOSING GAPS (Peec gap, now cited live)",
      subDivider,
      "",
    );
    closing.forEach((r, i) => {
      lines.push(`${i + 1}. "${r.gapTarget.query}"`, `   -> ${r.recommendation}`, "");
    });
  }

  if (alreadyCited.length > 0) {
    lines.push(subDivider, "[ok] ALREADY CITED", subDivider, "");
    alreadyCited.forEach((r, i) => {
      lines.push(`${i + 1}. "${r.gapTarget.query}"`, "");
    });
  }

  return lines.join("\n");
}
