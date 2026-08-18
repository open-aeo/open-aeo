import type { D1Database } from "@cloudflare/workers-types";
import { IStorage } from "../ports/IStorage.js";
import {
  AeoCheckResult,
  GapAnalysisResult,
  CompetitorAnalysis,
} from "../core/types.js";

// Durable storage for the hosted Cloudflare Workers server, backed by D1
// (SQLite), scoped to one authenticated user (BRG-143). Each row stores the
// full result as JSON in `data`; a few scalar columns exist only to support
// the filters IStorage already needs, mirroring JSONStorage's in-memory
// filter semantics exactly (see docs/storage.md, migrations/0001_init.sql,
// and migrations/0002_users_and_keys.sql for the user_id columns).
export class D1Storage implements IStorage {
  constructor(
    private readonly db: D1Database,
    private readonly userId: string,
  ) {}

  async save(result: AeoCheckResult): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO checks (query, target_domain, timestamp, data, user_id) VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(
        result.query,
        result.targetDomain,
        result.timestamp,
        JSON.stringify(result),
        this.userId,
      )
      .run();
  }

  async getHistory(query?: string): Promise<AeoCheckResult[]> {
    const statement = query
      ? this.db
          .prepare(
            `SELECT data FROM checks WHERE user_id = ? AND query = ? COLLATE NOCASE ORDER BY id`,
          )
          .bind(this.userId, query)
      : this.db
          .prepare(`SELECT data FROM checks WHERE user_id = ? ORDER BY id`)
          .bind(this.userId);
    return this.readRows<AeoCheckResult>(statement);
  }

  async saveGapResult(result: GapAnalysisResult): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO gap_results (target_domain, timestamp, data, user_id) VALUES (?, ?, ?, ?)`,
      )
      .bind(
        result.gapTarget.targetDomain,
        result.liveCheck.timestamp,
        JSON.stringify(result),
        this.userId,
      )
      .run();
  }

  async getGapHistory(domain?: string): Promise<GapAnalysisResult[]> {
    const statement = domain
      ? this.db
          .prepare(
            `SELECT data FROM gap_results WHERE user_id = ? AND target_domain LIKE '%' || ? || '%' COLLATE NOCASE ORDER BY id`,
          )
          .bind(this.userId, domain)
      : this.db
          .prepare(`SELECT data FROM gap_results WHERE user_id = ? ORDER BY id`)
          .bind(this.userId);
    return this.readRows<GapAnalysisResult>(statement);
  }

  async saveCompetitorAnalysis(analysis: CompetitorAnalysis): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO competitor_analyses (query, target_domain, analysed_at, data, user_id) VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(
        analysis.query,
        analysis.targetDomain,
        analysis.analysedAt,
        JSON.stringify(analysis),
        this.userId,
      )
      .run();
  }

  async getCompetitorHistory(
    domain?: string,
    query?: string,
  ): Promise<CompetitorAnalysis[]> {
    const conditions: string[] = [`user_id = ?`];
    const params: string[] = [this.userId];
    if (domain) {
      conditions.push(`target_domain LIKE '%' || ? || '%' COLLATE NOCASE`);
      params.push(domain);
    }
    if (query) {
      conditions.push(`query LIKE '%' || ? || '%' COLLATE NOCASE`);
      params.push(query);
    }
    const statement = this.db
      .prepare(
        `SELECT data FROM competitor_analyses WHERE ${conditions.join(" AND ")} ORDER BY analysed_at DESC`,
      )
      .bind(...params);
    return this.readRows<CompetitorAnalysis>(statement);
  }

  private async readRows<T>(statement: {
    all<U = Record<string, unknown>>(): Promise<{ results: U[] }>;
  }): Promise<T[]> {
    const { results } = await statement.all<{ data: string }>();
    return results.map((row) => JSON.parse(row.data) as T);
  }
}
