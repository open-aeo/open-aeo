import { EngineName } from "../core/types.js";

export interface TrackedPrompt {
  id: string;
  query: string;
  targetDomain: string;
  brandName: string | null;
  engines: EngineName[];
  createdAt: string;
}

export interface IPromptStore {
  create(
    input: Omit<TrackedPrompt, "id" | "createdAt">,
  ): Promise<TrackedPrompt>;
  list(): Promise<TrackedPrompt[]>;
  delete(id: string): Promise<void>;
}
