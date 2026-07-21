import OpenAI from "openai";
import { IQueryGenerator, parseQueryList } from "../core/promptGenerator.js";

export interface LlmQueryGeneratorOptions {
  baseURL?: string;
  model?: string;
}

// Generates candidate queries with an OpenAI-compatible chat model. Defaults to
// Perplexity's `sonar` (its key is always configured), but can point at OpenAI or
// any compatible endpoint. Plain completion, no web search — this is brainstorming,
// not a citation check.
export class LlmQueryGenerator implements IQueryGenerator {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, options: LlmQueryGeneratorOptions = {}) {
    this.client = new OpenAI({
      apiKey,
      baseURL: options.baseURL ?? "https://api.perplexity.ai",
    });
    this.model = options.model ?? "sonar";
  }

  async generate(input: string, count: number): Promise<string[]> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "system",
          content:
            "You generate realistic search queries people type into AI answer engines. Return only a JSON array of strings, no prose.",
        },
        {
          role: "user",
          content:
            `Generate ${count} distinct, natural-language queries for which "${input}" ` +
            `would be a relevant answer, product, or source. Mix intents ` +
            `(comparisons, "best X for Y", how-to, alternatives). ` +
            `Return only a JSON array of ${count} strings.`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    return parseQueryList(text, count);
  }
}
