import { parseAeoResponse } from "../core/citationParser.js";
import { AeoCheckResult, TargetConfig, GapTarget } from "../core/types.js";
import { IAnswerEngine } from "../ports/IAnswerEngine.js";
import { IStorage } from "../ports/IStorage.js";
import { runGapReport, formatGapReport } from "../core/gapAnalyser.js";

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

async function runSingleCheck(
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
