import { IAnswerEngine } from "../ports/IAnswerEngine.js";
import { EngineName, EngineResponse } from "../core/types.js";

// Scaffold for a Google AI Overviews answer engine.
//
// Google exposes no citations API, so sourcing AI Overviews means either a paid
// SERP provider (SerpAPI / DataForSEO) or scraping. That sourcing decision, and
// the live implementation, are tracked separately in BRG-139 and are NOT part of
// this ticket. This class only marks the extension point: the multi-engine seam
// already treats it like any other IAnswerEngine, so wiring it in later is an
// adapter plus one line of registration with no change to tools or core.
//
// It is intentionally NOT registered by the server, so it can never run live in
// its current form. Constructing and calling it fails loudly rather than
// returning fake data.
export class GoogleAiOverviews implements IAnswerEngine {
  readonly name: EngineName = "google-ai-overviews";

  async search(query: string): Promise<EngineResponse> {
    throw new Error(
      `Google AI Overviews engine is not implemented yet (tracked in BRG-139); ` +
        `cannot check "${query}". It needs a citation source (paid SERP provider ` +
        `or scraping) to be decided first.`,
    );
  }
}
