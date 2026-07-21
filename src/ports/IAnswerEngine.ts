import { EngineName, EngineResponse } from "../core/types.js";

export interface IAnswerEngine {
  // Stable identifier for this engine, used to attribute results and to
  // select engines by name. Set by each adapter.
  readonly name: EngineName;
  // The specific model backing this engine (e.g. "sonar", "gpt-4o"). Stored on
  // each result so a citation is attributable to a model version, not just an
  // engine — model behaviour drifts over time.
  readonly model: string;
  search(query: string): Promise<EngineResponse>;
}
