import { EngineRegistry } from "./engineRegistry.js";
import { PerplexityApi } from "../adapters/PerplexityApi.js";
import { OpenAiSearch } from "../adapters/OpenAiSearch.js";

export interface EngineFactoryOptions {
  perplexityApiKey: string;
  openAiApiKey?: string;
}

// Build the engine registry from configured keys. Perplexity is always
// registered (its key is required to run); ChatGPT registers only when an OpenAI
// key is present. Shared by the MCP server and the CLI so both see exactly the
// same set of engines.
export function buildEngineRegistry(
  options: EngineFactoryOptions,
): EngineRegistry {
  const registry = new EngineRegistry();
  registry.register(new PerplexityApi(options.perplexityApiKey));

  if (options.openAiApiKey && options.openAiApiKey.trim() !== "") {
    registry.register(new OpenAiSearch(options.openAiApiKey));
  }

  return registry;
}
