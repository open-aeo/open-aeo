import { CheckOutcome, RunReport } from "./runCheck.js";
import { TrendDirection } from "./trend.js";

function arrow(direction: TrendDirection): string {
  switch (direction) {
    case "up":
      return "up";
    case "down":
      return "down";
    case "same":
      return "flat";
    case "new":
      return "new";
  }
}

function trendText(outcome: CheckOutcome): string {
  const { trend } = outcome;
  if (trend.direction === "new" || trend.previousRate === null) {
    return "new";
  }
  const deltaPct = Math.round((trend.delta ?? 0) * 100);
  const sign = deltaPct > 0 ? "+" : "";
  return `${arrow(trend.direction)} (${sign}${deltaPct}% vs last)`;
}

function outcomeLine(outcome: CheckOutcome): string {
  const { result } = outcome;
  const mark = result.cited ? "OK " : "XX ";
  const rate = `${result.citedCount}/${result.sampleCount} (${Math.round(result.citationRate * 100)}%)`;
  const dropped = outcome.dropped ? "  [DROP]" : "";
  return `${mark} "${result.query}" [${result.engine}] cited ${rate} — ${trendText(outcome)}${dropped}`;
}

// Human-readable report for the terminal / CI logs.
export function formatRunReport(report: RunReport): string {
  const total = report.outcomes.length;
  const cited = report.outcomes.filter((o) => o.result.cited).length;

  const lines = [
    `AEO check — ${report.targetDomain}`,
    `${cited}/${total} checks cited${report.droppedCount > 0 ? `  ·  ${report.droppedCount} dropped` : ""}`,
    "",
    ...report.outcomes.map(outcomeLine),
  ];
  return lines.join("\n");
}

// Machine-readable report for `--json` (feeding dashboards or other tooling).
export function runReportToJson(report: RunReport): unknown {
  return {
    targetDomain: report.targetDomain,
    droppedCount: report.droppedCount,
    checks: report.outcomes.map((outcome) => ({
      query: outcome.result.query,
      engine: outcome.result.engine,
      model: outcome.result.model,
      cited: outcome.result.cited,
      citationRate: outcome.result.citationRate,
      citedCount: outcome.result.citedCount,
      sampleCount: outcome.result.sampleCount,
      position: outcome.result.position,
      positionSpread: outcome.result.positionSpread,
      trend: outcome.trend,
      dropped: outcome.dropped,
    })),
  };
}
