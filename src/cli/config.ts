import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

const engineNameSchema = z.enum([
  "perplexity",
  "chatgpt",
  "google-ai-overviews",
]);

// Schema for a queries.yaml file: one target domain/brand, a list of queries to
// check it against, and optional engine/sample/CI settings. Kept declarative so
// it can live in a repo and be diffed over time.
const configSchema = z.object({
  targetDomain: z.string().min(1),
  brandName: z.string().min(1).optional(),
  engines: z.array(engineNameSchema).min(1).optional(),
  samples: z.number().int().min(1).max(10).optional(),
  failOnDrop: z.boolean().optional(),
  queries: z.array(z.string().min(1)).min(1),
});

export type CliConfig = z.infer<typeof configSchema>;

// Load and validate a queries.yaml file. Throws a readable error (not a raw zod
// dump) so a misconfigured CI run tells the user exactly what to fix.
export function loadConfig(filePath: string): CliConfig {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch {
    throw new Error(`Could not read config file at "${filePath}".`);
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Config at "${filePath}" is not valid YAML: ${message}`, {
      cause: error,
    });
  }

  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map(
        (issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`,
      )
      .join("\n");
    throw new Error(`Config at "${filePath}" is invalid:\n${issues}`);
  }

  return result.data;
}
