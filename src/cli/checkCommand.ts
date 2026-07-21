import { buildEngineRegistry } from "../core/engineFactory.js";
import { JsonStorage } from "../adapters/JSONStorage.js";
import { loadConfig } from "./config.js";
import { runConfigCheck } from "./runCheck.js";
import { formatRunReport, runReportToJson } from "./report.js";

interface CheckArgs {
  config: string;
  json: boolean;
  samples?: number;
  failOnDrop?: boolean;
}

// Minimal flag parser for `open-aeo check`. Kept dependency-free and matching the
// hand-rolled style already used by the install command.
function parseArgs(argv: string[]): CheckArgs {
  const args: CheckArgs = { config: "queries.yaml", json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--config":
      case "-c":
        args.config = argv[++i] ?? args.config;
        break;
      case "--json":
        args.json = true;
        break;
      case "--samples":
        args.samples = Number(argv[++i]);
        break;
      case "--fail-on-drop":
        args.failOnDrop = true;
        break;
      case "--no-fail":
        args.failOnDrop = false;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  return args;
}

// `open-aeo check --config queries.yaml [--json] [--samples N] [--fail-on-drop]`
// Runs checks headlessly (no desktop app or MCP host needed) and exits non-zero
// when a tracked target has dropped out of citations, so it can gate CI.
export async function runCheckCommand(argv: string[]): Promise<void> {
  const args = parseArgs(argv);

  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  if (!perplexityKey) {
    console.error(
      "FATAL ERROR: PERPLEXITY_API_KEY environment variable is missing.",
    );
    process.exit(1);
  }

  const config = loadConfig(args.config);
  if (args.samples !== undefined) {
    if (!Number.isFinite(args.samples) || args.samples < 1) {
      console.error("--samples must be a positive integer.");
      process.exit(1);
    }
    config.samples = Math.floor(args.samples);
  }

  const registry = buildEngineRegistry({
    perplexityApiKey: perplexityKey,
    openAiApiKey: process.env.OPENAI_API_KEY,
  });
  const storage = new JsonStorage();

  const report = await runConfigCheck(registry, storage, config);

  console.log(
    args.json
      ? JSON.stringify(runReportToJson(report), null, 2)
      : formatRunReport(report),
  );

  const failOnDrop = args.failOnDrop ?? config.failOnDrop ?? false;
  if (failOnDrop && report.droppedCount > 0) {
    console.error(
      `\n${report.droppedCount} target(s) dropped out of citations since the last run.`,
    );
    process.exit(1);
  }
}
