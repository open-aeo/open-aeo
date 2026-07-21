import { EngineName } from "./types.js";
import { IAnswerEngine } from "../ports/IAnswerEngine.js";

// Holds the answer engines available at runtime and resolves a requested
// selection to the engines that are actually registered. Registration order
// is preserved: the first engine registered is the "primary", used by tools
// that still operate on a single engine (recommend, gap analysis).
export class EngineRegistry {
  private engines = new Map<EngineName, IAnswerEngine>();

  register(engine: IAnswerEngine): this {
    this.engines.set(engine.name, engine);
    return this;
  }

  has(name: EngineName): boolean {
    return this.engines.has(name);
  }

  get(name: EngineName): IAnswerEngine {
    const engine = this.engines.get(name);
    if (!engine) {
      throw new Error(
        `Answer engine "${name}" is not configured. Available: ${this.names().join(", ") || "none"}.`,
      );
    }
    return engine;
  }

  names(): EngineName[] {
    return [...this.engines.keys()];
  }

  isEmpty(): boolean {
    return this.engines.size === 0;
  }

  // The default single engine for tools that do not yet run multi-engine.
  primary(): IAnswerEngine {
    const first = this.engines.values().next().value;
    if (!first) {
      throw new Error("No answer engines are configured.");
    }
    return first;
  }

  // Resolve a requested selection to registered engines. Passing no selection
  // (or an empty list) returns every registered engine. Requesting an engine
  // that is not configured is an error, so the caller learns why it is absent
  // rather than silently getting fewer results.
  resolve(selection?: EngineName[]): IAnswerEngine[] {
    if (!selection || selection.length === 0) {
      return this.names().map((name) => this.get(name));
    }
    const seen = new Set<EngineName>();
    const resolved: IAnswerEngine[] = [];
    for (const name of selection) {
      if (seen.has(name)) continue;
      seen.add(name);
      resolved.push(this.get(name));
    }
    return resolved;
  }
}
