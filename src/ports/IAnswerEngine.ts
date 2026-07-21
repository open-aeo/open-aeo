import { EngineName, EngineResponse } from "../core/types.js";

export interface IAnswerEngine {
  // Stable identifier for this engine, used to attribute results and to
  // select engines by name. Set by each adapter.
  readonly name: EngineName;
  search(query: string): Promise<EngineResponse>;
}
