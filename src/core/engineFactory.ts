import { EngineRegistry } from "./engineRegistry.js";
import { PerplexityApi } from "../adapters/PerplexityApi.js";
import { OpenAiSearch } from "../adapters/OpenAiSearch.js";
import { GoogleAiOverviews } from "../adapters/GoogleAiOverviews.js";

export interface EngineFactoryOptions {
  perplexityApiKey: string;
  openAiApiKey?: string;
  // DataForSEO "login:password", which sources Google AI Overviews.
  dataForSeoCredentials?: string;
}

// Build the engine registry from configured keys. Perplexity is always
// registered (its key is required to run); ChatGPT registers only when an OpenAI
// key is present, and Google AI Overviews only when DataForSEO credentials are.
// Shared by the MCP server and the CLI so both see exactly the same set of
// engines.
export function buildEngineRegistry(
  options: EngineFactoryOptions,
): EngineRegistry {
  const registry = new EngineRegistry();
  registry.register(new PerplexityApi(options.perplexityApiKey));

  if (options.openAiApiKey && options.openAiApiKey.trim() !== "") {
    registry.register(new OpenAiSearch(options.openAiApiKey));
  }

  // Requires a login:password pair. A value missing the colon is treated as
  // absent rather than thrown, so one bad stored credential leaves the other
  // engines runnable instead of failing the whole registry build.
  if (options.dataForSeoCredentials?.includes(":")) {
    registry.register(new GoogleAiOverviews(options.dataForSeoCredentials));
  }

  return registry;
}
