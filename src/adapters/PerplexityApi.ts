import OpenAI from "openai";
import { IAnswerEngine } from "../ports/IAnswerEngine";
import { EngineResponse } from "../core/types";

interface PerplexityResponse extends OpenAI.Chat.ChatCompletion {
  citations?: [];
}

export class PerplexityApi implements IAnswerEngine {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://api.perplexity.ai",
    });
  }

  async search(query: string): Promise<EngineResponse> {
    try {
      const response: PerplexityResponse =
        await this.client.chat.completions.create({
          model: "sonar",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful search assistant. Provide precise, accurate answers",
            },
            {
              role: "user",
              content: query,
            },
          ],
        });
      return {
        answerText: response.choices[0]?.message?.content ?? "",
        citations: response.citations ?? [],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to fetch data from Perplexity:", message);
      throw new Error(`Answer Engine API Error: ${message}`);
    }
  }
}
