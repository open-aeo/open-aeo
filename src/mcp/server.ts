// src/mcp/server.ts

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PerplexityApi } from "../adapters/PerplexityApi.js";
import {
  handleAeoCheck,
  handleAeoReport,
  handleAeoHistory,
  handleAeoGapReport,
  handleAeoGapHistory,
} from "./tools.js";
import { GapTarget } from "../core/types.js";
import { JsonStorage } from "../adapters/JSONStorage.js";
import { z } from "zod";

export class AeoMcpServer {
  private server: McpServer;
  private engine: PerplexityApi;
  private storage: JsonStorage;

  constructor(apiKey: string) {
    this.engine = new PerplexityApi(apiKey);
    this.storage = new JsonStorage();
    this.server = new McpServer({ name: "open-aeo", version: "1.0.0" });
    this.setupHandlers();
  }
  private setupHandlers() {
    this.server.registerTool(
      "aeo_check",
      {
        description:
          "Perform a live AEO citation check for a single query to see if a domain is cited by AI.",
        inputSchema: {
          query: z
            .string()
            .describe("The search keyword (e.g. 'best note apps')"),
          targetDomain: z.string().describe("Your domain (e.g. 'notion.so')"),
          brandName: z
            .string()
            .optional()
            .describe("Your brand name for text matching"),
        },
      },
      async ({ query, targetDomain, brandName }) => {
        try {
          return await handleAeoCheck(this.engine, this.storage, {
            query,
            targetDomain,
            brandName,
          });
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
        description: "Run a batch AEO check for an array of multiple targets.",
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
        },
      },
      async ({ targets }) => {
        try {
          return await handleAeoReport(this.engine, this.storage, targets);
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
            this.engine,
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
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("OpenAEO MCP Server running on stdio");
  }
}
