import { EngineRegistry } from "./engineRegistry.js";
import { PerplexityApi } from "../adapters/PerplexityApi.js";
import { OpenAiSearch } from "../adapters/OpenAiSearch.js";
import { LlmQueryGenerator } from "../adapters/LlmQueryGenerator.js";
import { IQueryGenerator } from "./promptGenerator.js";

export interface EngineCredentials {
  perplexityApiKey?: string;
  openAiApiKey?: string;
}

function has(key?: string): key is string {
  return typeof key === "string" && key.trim() !== "";
}

export const NO_ENGINE_CONFIGURED_MESSAGE =
  "No answer engine is configured. Set PERPLEXITY_API_KEY or OPENAI_API_KEY (or both).";

// Build the engine registry from whatever keys are configured. Neither engine is
// mandatory on its own — the server runs on Perplexity, ChatGPT, or both — but at
// least one must be present, so a setup with no key fails loudly instead of
// starting an engine-less server. Registration order sets the primary engine used
// by the single-engine tools: Perplexity first when present, otherwise ChatGPT.
// Nothing here assumes Perplexity; the primary is simply whatever is configured.
export function buildEngineRegistry(
  credentials: EngineCredentials,
): EngineRegistry {
  const registry = new EngineRegistry();

  if (has(credentials.perplexityApiKey)) {
    registry.register(new PerplexityApi(credentials.perplexityApiKey));
  }
  if (has(credentials.openAiApiKey)) {
    registry.register(new OpenAiSearch(credentials.openAiApiKey));
  }

  if (registry.isEmpty()) {
    throw new Error(NO_ENGINE_CONFIGURED_MESSAGE);
  }

  return registry;
}

// Query generation is plain LLM brainstorming, not a citation check, so any
// configured provider works. Prefer Perplexity's `sonar` when its key is present
// (one fewer dependency for the common setup); otherwise use OpenAI. Throws when
// neither is configured, matching the engine registry.
export function buildQueryGenerator(
  credentials: EngineCredentials,
): IQueryGenerator {
  if (has(credentials.perplexityApiKey)) {
    return new LlmQueryGenerator(credentials.perplexityApiKey);
  }
  if (has(credentials.openAiApiKey)) {
    return new LlmQueryGenerator(credentials.openAiApiKey, {
      baseURL: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
    });
  }
  throw new Error(NO_ENGINE_CONFIGURED_MESSAGE);
}
