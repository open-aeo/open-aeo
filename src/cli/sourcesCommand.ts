import { JsonStorage } from "../adapters/JSONStorage.js";
import { computeSourcesBreakdown } from "../core/sourcesBreakdown.js";
import { formatSourcesBreakdown } from "../mcp/tools.js";

interface SourcesArgs {
  targetDomain?: string;
  query?: string;
  limit: number;
  json: boolean;
}

function parseArgs(argv: string[]): SourcesArgs {
  const args: SourcesArgs = { limit: 15, json: false };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--domain":
        args.targetDomain = argv[++i];
        break;
      case "--query":
        args.query = argv[++i];
        break;
      case "--limit":
        args.limit = Number(argv[++i]);
        break;
      case "--json":
        args.json = true;
        break;
      default:
        throw new Error(`Unknown option: ${argv[i]}`);
    }
  }
  return args;
}

// `open-aeo sources [--domain d] [--query q] [--limit N] [--json]`
// Ranks the third-party domains winning citations across stored history.
export async function runSourcesCommand(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const storage = new JsonStorage();
  const history = await storage.getHistory();
  const breakdown = computeSourcesBreakdown(history, {
    targetDomain: args.targetDomain,
    query: args.query,
  });

  console.log(
    args.json
      ? JSON.stringify(breakdown, null, 2)
      : formatSourcesBreakdown(breakdown, args.limit),
  );
}
