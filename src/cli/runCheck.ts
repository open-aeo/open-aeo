import { EngineRegistry } from "../core/engineRegistry.js";
import { IStorage } from "../ports/IStorage.js";
import { AeoCheckResult } from "../core/types.js";
import { runChecksAcrossEngines } from "../mcp/tools.js";
import { CliConfig } from "./config.js";
import { computeTrend, isDrop, Trend } from "./trend.js";

export interface CheckOutcome {
  result: AeoCheckResult;
  trend: Trend;
  dropped: boolean;
}

export interface RunReport {
  targetDomain: string;
  outcomes: CheckOutcome[];
  droppedCount: number;
}

// Default samples for a CLI/CI run. Sampling is the whole point of a defensible
// number, so default above 1; a config can override.
export const CLI_DEFAULT_SAMPLES = 3;
const SAMPLE_DELAY_MS = 1500;

// Run every query in the config against the selected engines, comparing each
// result to prior history for a trend. The registry and storage are injected, so
// this is testable with fakes and has no dependency on env or the network beyond
// whatever the engines do.
export async function runConfigCheck(
  registry: EngineRegistry,
  storage: IStorage,
  config: CliConfig,
): Promise<RunReport> {
  const engines = registry.resolve(config.engines);
  const samples = config.samples ?? CLI_DEFAULT_SAMPLES;

  // Snapshot history BEFORE the run so trends compare against the previous run,
  // not against results we are about to save.
  const priorHistory = await storage.getHistory();

  const outcomes: CheckOutcome[] = [];
  for (const query of config.queries) {
    const results = await runChecksAcrossEngines(
      engines,
      storage,
      { query, targetDomain: config.targetDomain, brandName: config.brandName },
      samples > 1 ? SAMPLE_DELAY_MS : 0,
      samples,
    );
    for (const result of results) {
      outcomes.push({
        result,
        trend: computeTrend(result, priorHistory),
        dropped: isDrop(result, priorHistory),
      });
    }
  }

  return {
    targetDomain: config.targetDomain,
    outcomes,
    droppedCount: outcomes.filter((outcome) => outcome.dropped).length,
  };
}
