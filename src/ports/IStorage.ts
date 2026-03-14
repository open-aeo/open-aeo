import { AeoCheckResult } from "../core/types.js";

export interface IStorage {
  save(result: AeoCheckResult): Promise<void>;
  getHistory(query?: string): Promise<AeoCheckResult[]>;
}
