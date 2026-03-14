// src/mcp/server.ts

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PerplexityApi } from "../adapters/PerplexityApi.js";
import { handleAeoCheck, handleAeoReport } from "./tools.js";
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
        },
      },
      async ({ query }) => {
        try {
          const history = await this.storage.getHistory(query);
          const lines =
            history.length === 0
              ? ["No history found."]
              : history.map(
                  (r) =>
                    `${r.cited ? "✅" : "❌"}  "${r.query}" — ${r.targetDomain} — ${new Date(r.timestamp).toLocaleDateString()}`,
                );
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
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
