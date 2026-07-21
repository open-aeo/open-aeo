import { LlmQueryGenerator } from "../adapters/LlmQueryGenerator.js";

interface GenerateArgs {
  input?: string;
  count: number;
  json: boolean;
}

function parseArgs(argv: string[]): GenerateArgs {
  const args: GenerateArgs = { count: 10, json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--count":
        args.count = Number(argv[++i]);
        break;
      case "--json":
        args.json = true;
        break;
      default:
        if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
        args.input = args.input ? `${args.input} ${arg}` : arg;
    }
  }
  return args;
}

// `open-aeo generate <domain-or-topic> [--count N] [--json]`
// Prints candidate queries as a queries.yaml snippet to paste and edit.
export async function runGenerateCommand(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  if (!args.input) {
    console.error("Usage: open-aeo generate <domain-or-topic> [--count N]");
    process.exit(1);
  }
  if (!Number.isFinite(args.count) || args.count < 1) {
    console.error("--count must be a positive integer.");
    process.exit(1);
  }

  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  if (!perplexityKey) {
    console.error(
      "FATAL ERROR: PERPLEXITY_API_KEY environment variable is missing.",
    );
    process.exit(1);
  }

  const generator = new LlmQueryGenerator(perplexityKey);
  const queries = await generator.generate(args.input, args.count);

  if (args.json) {
    console.log(JSON.stringify(queries, null, 2));
    return;
  }

  if (queries.length === 0) {
    console.error(`No queries generated for "${args.input}".`);
    process.exit(1);
  }

  console.log(
    `# Candidate queries for "${args.input}" — review, then keep the good ones.`,
  );
  console.log("queries:");
  for (const query of queries) {
    console.log(`  - ${query}`);
  }
}
