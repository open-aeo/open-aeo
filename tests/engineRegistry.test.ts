import { describe, it, expect } from "vitest";
import { EngineRegistry } from "../src/core/engineRegistry.js";
import { IAnswerEngine } from "../src/ports/IAnswerEngine.js";
import { EngineName, EngineResponse } from "../src/core/types.js";

function fakeEngine(name: EngineName): IAnswerEngine {
  return {
    name,
    async search(): Promise<EngineResponse> {
      return { answerText: `answer from ${name}`, citations: [] };
    },
  };
}

describe("EngineRegistry", () => {
  it("registers and retrieves engines by name", () => {
    const registry = new EngineRegistry();
    registry.register(fakeEngine("perplexity"));

    expect(registry.has("perplexity")).toBe(true);
    expect(registry.has("chatgpt")).toBe(false);
    expect(registry.get("perplexity").name).toBe("perplexity");
  });

  it("reports whether it is empty", () => {
    const registry = new EngineRegistry();
    expect(registry.isEmpty()).toBe(true);
    registry.register(fakeEngine("perplexity"));
    expect(registry.isEmpty()).toBe(false);
  });

  it("throws a clear error when getting an unconfigured engine", () => {
    const registry = new EngineRegistry();
    registry.register(fakeEngine("perplexity"));

    expect(() => registry.get("chatgpt")).toThrowError(
      /"chatgpt" is not configured/,
    );
  });

  it("treats the first registered engine as primary", () => {
    const registry = new EngineRegistry();
    registry.register(fakeEngine("perplexity"));
    registry.register(fakeEngine("chatgpt"));

    expect(registry.primary().name).toBe("perplexity");
  });

  it("primary throws when no engines are configured", () => {
    const registry = new EngineRegistry();
    expect(() => registry.primary()).toThrowError(/No answer engines/);
  });

  it("resolves to all engines in registration order when no selection is given", () => {
    const registry = new EngineRegistry();
    registry.register(fakeEngine("perplexity"));
    registry.register(fakeEngine("chatgpt"));

    expect(registry.resolve().map((engine) => engine.name)).toEqual([
      "perplexity",
      "chatgpt",
    ]);
    expect(registry.resolve([]).map((engine) => engine.name)).toEqual([
      "perplexity",
      "chatgpt",
    ]);
  });

  it("resolves a requested subset", () => {
    const registry = new EngineRegistry();
    registry.register(fakeEngine("perplexity"));
    registry.register(fakeEngine("chatgpt"));

    expect(registry.resolve(["chatgpt"]).map((engine) => engine.name)).toEqual([
      "chatgpt",
    ]);
  });

  it("de-duplicates a repeated selection", () => {
    const registry = new EngineRegistry();
    registry.register(fakeEngine("perplexity"));

    expect(
      registry
        .resolve(["perplexity", "perplexity"])
        .map((engine) => engine.name),
    ).toEqual(["perplexity"]);
  });

  it("throws when a requested engine is not configured", () => {
    const registry = new EngineRegistry();
    registry.register(fakeEngine("perplexity"));

    expect(() => registry.resolve(["chatgpt"])).toThrowError(
      /"chatgpt" is not configured/,
    );
  });
});
