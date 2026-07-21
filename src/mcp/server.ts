// src/mcp/server.ts

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  handleAeoCheck,
  handleAeoReport,
  handleAeoHistory,
  handleAeoGapReport,
  handleAeoGapHistory,
  handleAeoAnalyse,
  handleAeoRecommend,
} from "./tools.js";
import { EngineName, GapTarget } from "../core/types.js";
import { EngineRegistry } from "../core/engineRegistry.js";
import { buildEngineRegistry } from "../core/engineFactory.js";
import { JsonStorage } from "../adapters/JSONStorage.js";
import { PageFetcher } from "../adapters/PageFetcher.js";
import { z } from "zod";

// Engine names a caller may request. Whether an engine actually runs depends on
// its API key being configured; the registry throws a clear error if a
// requested engine is not available.
const engineNameSchema = z.enum([
  "perplexity",
  "chatgpt",
  "google-ai-overviews",
]);

// LLM answers are non-deterministic, so aeo_check samples the query a few times
// and reports a citation rate. Default is a balance of signal vs API cost;
// override per call with `samples` or globally with OPEN_AEO_SAMPLES.
const DEFAULT_SAMPLES = 3;
const MAX_SAMPLES = 10;
// Pause between samples of the same query to stay under provider rate limits.
const SAMPLE_DELAY_MS = 1500;

function resolveDefaultSamples(): number {
  const fromEnv = Number(process.env.OPEN_AEO_SAMPLES);
  if (Number.isFinite(fromEnv) && fromEnv >= 1) {
    return Math.min(MAX_SAMPLES, Math.floor(fromEnv));
  }
  return DEFAULT_SAMPLES;
}

export class AeoMcpServer {
  private server: McpServer;
  private registry: EngineRegistry;
  private storage: JsonStorage;
  private fetcher: PageFetcher;

  constructor(apiKey: string) {
    // Perplexity is always available (its key is required to start the server).
    // Additional engines register only when their key is present, so the tool
    // set adapts to whatever the operator has configured. Shared with the CLI.
    this.registry = buildEngineRegistry({
      perplexityApiKey: apiKey,
      openAiApiKey: process.env.OPENAI_API_KEY,
    });

    this.storage = new JsonStorage();
    this.fetcher = new PageFetcher();
    this.server = new McpServer({ name: "open-aeo", version: "1.0.0" });
    this.setupHandlers();
  }

  // Resolve a requested engine selection to configured engines, defaulting to
  // every configured engine when none is specified.
  private selectEngines(names?: EngineName[]) {
    return this.registry.resolve(names);
  }
  private setupHandlers() {
    this.server.registerTool(
      "aeo_check",
      {
        description:
          "Perform a live AEO citation check for a single query to see if a domain is cited by AI answer engines. Runs across every configured engine by default, or the subset named in 'engines'.",
        inputSchema: {
          query: z
            .string()
            .describe("The search keyword (e.g. 'best note apps')"),
          targetDomain: z.string().describe("Your domain (e.g. 'notion.so')"),
          brandName: z
            .string()
            .optional()
            .describe("Your brand name for text matching"),
          engines: z
            .array(engineNameSchema)
            .optional()
            .describe(
              "Which answer engines to check. Omit to check all configured engines.",
            ),
          samples: z
            .number()
            .int()
            .min(1)
            .max(MAX_SAMPLES)
            .optional()
            .describe(
              `How many times to run the query per engine, reported as a citation rate. Default ${DEFAULT_SAMPLES} (or OPEN_AEO_SAMPLES).`,
            ),
        },
      },
      async ({ query, targetDomain, brandName, engines, samples }) => {
        try {
          const runs = samples ?? resolveDefaultSamples();
          return await handleAeoCheck(
            this.selectEngines(engines),
            this.storage,
            { query, targetDomain, brandName },
            runs > 1 ? SAMPLE_DELAY_MS : 0,
            runs,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text" as const, text: `Error: ${message}` }],
            isError: true,
          };
        }
      },
    );

    this.server.registerTool(
      "aeo_report",
      {
        description:
          "Run a batch AEO check for an array of targets. Each target is checked against every configured engine by default, or the subset named in 'engines'.",
        inputSchema: {
          targets: z
            .array(
              z.object({
                query: z.string(),
                targetDomain: z.string(),
                brandName: z.string().optional(),
              }),
            )
            .describe("Array of targets to check"),
          engines: z
            .array(engineNameSchema)
            .optional()
            .describe(
              "Which answer engines to check. Omit to check all configured engines.",
            ),
        },
      },
      async ({ targets, engines }) => {
        try {
          return await handleAeoReport(
            this.selectEngines(engines),
            this.storage,
            targets,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text" as const, text: `Error: ${message}` }],
            isError: true,
          };
        }
      },
    );

    this.server.registerTool(
      "aeo_history",
      {
        description:
          "Retrieve historical AEO citation data from local storage.",
        inputSchema: {
          query: z
            .string()
            .optional()
            .describe("Filter history by a specific query"),
          domain: z
            .string()
            .optional()
            .describe("Filter history by target domain"),
        },
      },
      async ({ query, domain }) => {
        try {
          return await handleAeoHistory(this.storage, query, domain);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text" as const, text: `Error: ${message}` }],
            isError: true,
          };
        }
      },
    );

    this.server.registerTool(
      "aeo_gap_report",
      {
        description: `Run a live AEO gap analysis. Takes a list of queries where competitors are beating you (from Peec gap data or manual input) and validates each gap live against Perplexity. Returns a prioritised report showing confirmed gaps, emerging gaps, and which gaps are already closing, with specific content recommendations for each confirmed gap.`,
        inputSchema: {
          gaps: z
            .array(
              z.object({
                query: z.string().describe("The search query to check"),
                targetDomain: z
                  .string()
                  .describe("Your domain (e.g. 'notion.so')"),
                brandName: z.string().optional().describe("Your brand name"),
                competitorDomains: z
                  .array(z.string())
                  .describe(
                    "Competitor domains that Peec found beating you on this query",
                  ),
                peecOpportunityScore: z
                  .number()
                  .min(0)
                  .max(1)
                  .optional()
                  .describe(
                    "Opportunity score from Peec (0-1, higher = bigger gap)",
                  ),
                peecTopicName: z
                  .string()
                  .optional()
                  .describe("Topic grouping from Peec for organising output"),
                source: z
                  .enum(["peec", "manual"])
                  .describe(
                    "Whether this gap was identified by Peec or entered manually",
                  ),
              }),
            )
            .describe("Array of gap targets to analyse"),
          delayMs: z
            .number()
            .min(0)
            .max(10000)
            .optional()
            .describe(
              "Delay between API calls in ms (default: 2000). Increase if hitting rate limits.",
            ),
        },
      },
      async ({ gaps, delayMs }) => {
        try {
          return await handleAeoGapReport(
            this.registry.primary(),
            this.storage,
            gaps as GapTarget[],
            delayMs,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text" as const, text: `Error: ${message}` }],
            isError: true,
          };
        }
      },
    );

    this.server.registerTool(
      "aeo_gap_history",
      {
        description: `Retrieve historical gap analysis results. Shows trends over time -- which gaps were confirmed previously, which have since closed, and which are getting worse. Use this to track progress week-over-week.`,
        inputSchema: {
          domain: z
            .string()
            .optional()
            .describe(
              "Filter by your domain (e.g. 'notion.so'). Omit for all domains.",
            ),
        },
      },
      async ({ domain }) => {
        try {
          return await handleAeoGapHistory(this.storage, domain);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text" as const, text: `Error: ${message}` }],
            isError: true,
          };
        }
      },
    );

    this.server.registerTool(
      "aeo_analyse",
      {
        description:
          "Fetch and analyse a single competitor page. Returns page signals (word count, schema types, FAQ, direct answer, etc.) and saves the analysis to local storage. Use this to inspect a specific URL that is beating you on a query.",
        inputSchema: {
          competitorUrl: z
            .string()
            .url()
            .describe("Full URL of the competitor page to analyse"),
          query: z.string().describe("The query this competitor ranks for"),
          targetDomain: z.string().describe("Your domain (e.g. 'acemate.ai')"),
          citationPosition: z
            .number()
            .int()
            .min(0)
            .describe(
              "0-based position at which this URL appears in AI citations",
            ),
        },
      },
      async ({ competitorUrl, query, targetDomain, citationPosition }) => {
        try {
          return await handleAeoAnalyse(
            this.fetcher,
            this.storage,
            competitorUrl,
            query,
            targetDomain,
            citationPosition,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text" as const, text: `Error: ${message}` }],
            isError: true,
          };
        }
      },
    );

    this.server.registerTool(
      "aeo_recommend",
      {
        description:
          "Run a live AEO check and generate a prioritised list of content recommendations to improve citation chances. Fetches the top competitor pages, analyses their signals, and returns specific actionable tasks ranked by impact.",
        inputSchema: {
          query: z.string().describe("The search query to check and analyse"),
          targetDomain: z.string().describe("Your domain (e.g. 'acemate.ai')"),
          brandName: z
            .string()
            .optional()
            .describe("Your brand name for text matching"),
          maxCompetitors: z
            .number()
            .int()
            .min(1)
            .max(5)
            .optional()
            .describe(
              "Max competitor pages to fetch and analyse (default: 3, max: 5)",
            ),
        },
      },
      async ({ query, targetDomain, brandName, maxCompetitors }) => {
        try {
          return await handleAeoRecommend(
            this.registry.primary(),
            this.fetcher,
            this.storage,
            { query, targetDomain, brandName },
            maxCompetitors,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text" as const, text: `Error: ${message}` }],
            isError: true,
          };
        }
      },
    );
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("OpenAEO MCP Server running on stdio");
  }
}
