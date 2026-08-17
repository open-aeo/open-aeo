import type { D1Database } from "@cloudflare/workers-types";
import { IStorage } from "../ports/IStorage.js";
import {
  AeoCheckResult,
  GapAnalysisResult,
  CompetitorAnalysis,
} from "../core/types.js";

// Durable storage for the hosted Cloudflare Workers server, backed by D1
// (SQLite). Each row stores the full result as JSON in `data`; a few scalar
// columns exist only to support the filters IStorage already needs, mirroring
// JSONStorage's in-memory filter semantics exactly (see docs/storage.md and
// migrations/0001_init.sql). Requires the `checks` / `gap_results` /
// `competitor_analyses` tables from that migration to already exist.
export class D1Storage implements IStorage {
  constructor(private readonly db: D1Database) {}

  async save(result: AeoCheckResult): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO checks (query, target_domain, timestamp, data) VALUES (?, ?, ?, ?)`,
      )
      .bind(result.query, result.targetDomain, result.timestamp, JSON.stringify(result))
      .run();
  }

  async getHistory(query?: string): Promise<AeoCheckResult[]> {
    const statement = query
      ? this.db
          .prepare(`SELECT data FROM checks WHERE query = ? COLLATE NOCASE ORDER BY id`)
          .bind(query)
      : this.db.prepare(`SELECT data FROM checks ORDER BY id`);
    return this.readRows<AeoCheckResult>(statement);
  }

  async saveGapResult(result: GapAnalysisResult): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO gap_results (target_domain, timestamp, data) VALUES (?, ?, ?)`,
      )
      .bind(
        result.gapTarget.targetDomain,
        result.liveCheck.timestamp,
        JSON.stringify(result),
      )
      .run();
  }

  async getGapHistory(domain?: string): Promise<GapAnalysisResult[]> {
    const statement = domain
      ? this.db
          .prepare(
            `SELECT data FROM gap_results WHERE target_domain LIKE '%' || ? || '%' COLLATE NOCASE ORDER BY id`,
          )
          .bind(domain)
      : this.db.prepare(`SELECT data FROM gap_results ORDER BY id`);
    return this.readRows<GapAnalysisResult>(statement);
  }

  async saveCompetitorAnalysis(analysis: CompetitorAnalysis): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO competitor_analyses (query, target_domain, analysed_at, data) VALUES (?, ?, ?, ?)`,
      )
      .bind(
        analysis.query,
        analysis.targetDomain,
        analysis.analysedAt,
        JSON.stringify(analysis),
      )
      .run();
  }

  async getCompetitorHistory(
    domain?: string,
    query?: string,
  ): Promise<CompetitorAnalysis[]> {
    const conditions: string[] = [];
    const params: string[] = [];
    if (domain) {
      conditions.push(`target_domain LIKE '%' || ? || '%' COLLATE NOCASE`);
      params.push(domain);
    }
    if (query) {
      conditions.push(`query LIKE '%' || ? || '%' COLLATE NOCASE`);
      params.push(query);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const statement = this.db
      .prepare(
        `SELECT data FROM competitor_analyses ${where} ORDER BY analysed_at DESC`,
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
