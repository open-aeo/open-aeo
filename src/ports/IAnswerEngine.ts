import { EngineResponse } from "../core/types.js";

export interface IAnswerEngine {
  search(query: string): Promise<EngineResponse>;
}
