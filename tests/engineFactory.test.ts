import { describe, it, expect } from "vitest";
import {
  buildEngineRegistry,
  buildQueryGenerator,
  NO_ENGINE_CONFIGURED_MESSAGE,
} from "../src/core/engineFactory.js";

describe("buildEngineRegistry", () => {
  it("registers only Perplexity when only its key is set", () => {
    const registry = buildEngineRegistry({ perplexityApiKey: "pk" });
    expect(registry.names()).toEqual(["perplexity"]);
    expect(registry.primary().name).toBe("perplexity");
  });

  it("runs on OpenAI alone — no Perplexity key required", () => {
    const registry = buildEngineRegistry({ openAiApiKey: "ok" });
    expect(registry.names()).toEqual(["chatgpt"]);
    // The primary is whatever is configured, not a hardcoded Perplexity default.
    expect(registry.primary().name).toBe("chatgpt");
  });

  it("registers both and keeps Perplexity primary when both keys are set", () => {
    const registry = buildEngineRegistry({
      perplexityApiKey: "pk",
      openAiApiKey: "ok",
    });
    expect(registry.names()).toEqual(["perplexity", "chatgpt"]);
    expect(registry.primary().name).toBe("perplexity");
  });

  it("treats blank/whitespace keys as absent", () => {
    const registry = buildEngineRegistry({
      perplexityApiKey: "   ",
      openAiApiKey: "ok",
    });
    expect(registry.names()).toEqual(["chatgpt"]);
  });

  it("throws a clear error when no key is configured", () => {
    expect(() => buildEngineRegistry({})).toThrow(NO_ENGINE_CONFIGURED_MESSAGE);
    expect(() =>
      buildEngineRegistry({ perplexityApiKey: "", openAiApiKey: "  " }),
    ).toThrow(NO_ENGINE_CONFIGURED_MESSAGE);
  });
});

describe("buildQueryGenerator", () => {
  it("builds a generator from Perplexity when present", () => {
    const generator = buildQueryGenerator({ perplexityApiKey: "pk" });
    expect(typeof generator.generate).toBe("function");
  });

  it("falls back to OpenAI when only that key is present", () => {
    const generator = buildQueryGenerator({ openAiApiKey: "ok" });
    expect(typeof generator.generate).toBe("function");
  });

  it("throws when neither key is configured", () => {
    expect(() => buildQueryGenerator({})).toThrow(
      NO_ENGINE_CONFIGURED_MESSAGE,
    );
  });
});
