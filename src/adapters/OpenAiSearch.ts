import OpenAI from "openai";
import type { Response as OpenAIResponse } from "openai/resources/responses/responses";
import { IAnswerEngine } from "../ports/IAnswerEngine.js";
import { EngineName, EngineResponse } from "../core/types.js";

// ChatGPT-backed answer engine. Uses the OpenAI Responses API with the
// web_search tool so answers arrive with real source citations. AEO needs the
// cited URLs, not just the prose: an answer with no sources tells us nothing
// about who is winning the query.
export class OpenAiSearch implements IAnswerEngine {
  readonly name: EngineName = "chatgpt";
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = "gpt-4o") {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async search(query: string): Promise<EngineResponse> {
    try {
      const response = await this.client.responses.create({
        model: this.model,
        tools: [{ type: "web_search_preview" }],
        input: query,
      });

      return {
        answerText: response.output_text ?? "",
        citations: extractCitations(response),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to fetch data from OpenAI:", message);
      throw new Error(`Answer Engine API Error: ${message}`, { cause: error });
    }
  }
}

// Pull URL citations out of a Responses API result, de-duplicated and in the
// order they appear in the answer so citation position stays meaningful. Kept
// separate and exported so it can be unit-tested without hitting the network.
export function extractCitations(response: OpenAIResponse): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type !== "output_text") continue;
      for (const annotation of part.annotations ?? []) {
        if (annotation.type !== "url_citation") continue;
        if (annotation.url && !seen.has(annotation.url)) {
          seen.add(annotation.url);
          urls.push(annotation.url);
        }
      }
    }
  }

  return urls;
}
