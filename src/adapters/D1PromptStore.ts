import type { D1Database } from "@cloudflare/workers-types";
import { IPromptStore, TrackedPrompt } from "../ports/IPromptStore.js";
import { EngineName } from "../core/types.js";

interface Row {
  id: string;
  query: string;
  target_domain: string;
  brand_name: string | null;
  engines: string;
  created_at: string;
}

function rowToPrompt(row: Row): TrackedPrompt {
  return {
    id: row.id,
    query: row.query,
    targetDomain: row.target_domain,
    brandName: row.brand_name,
    engines: JSON.parse(row.engines) as EngineName[],
    createdAt: row.created_at,
  };
}

// Saved/tracked prompts, scoped to one authenticated user (dashboard
// Prompts page). Mirrors D1KeyStore/D1Storage's per-user-scoped adapter
// shape (see migrations/0003_tracked_prompts.sql).
export class D1PromptStore implements IPromptStore {
  constructor(
    private readonly db: D1Database,
    private readonly userId: string,
  ) {}

  async create(
    input: Omit<TrackedPrompt, "id" | "createdAt">,
  ): Promise<TrackedPrompt> {
    const prompt: TrackedPrompt = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    await this.db
      .prepare(
        `INSERT INTO tracked_prompts (id, user_id, query, target_domain, brand_name, engines, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        prompt.id,
        this.userId,
        prompt.query,
        prompt.targetDomain,
        prompt.brandName,
        JSON.stringify(prompt.engines),
        prompt.createdAt,
      )
      .run();
    return prompt;
  }

  async list(): Promise<TrackedPrompt[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id, query, target_domain, brand_name, engines, created_at FROM tracked_prompts WHERE user_id = ? ORDER BY created_at DESC, rowid DESC`,
      )
      .bind(this.userId)
      .all<Row>();
    return results.map(rowToPrompt);
  }

  async delete(id: string): Promise<void> {
    await this.db
      .prepare(`DELETE FROM tracked_prompts WHERE id = ? AND user_id = ?`)
      .bind(id, this.userId)
      .run();
  }
}
