import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { IStorage } from "../ports/IStorage.js";
import { AeoCheckResult, GapAnalysisResult, CompetitorAnalysis } from "../core/types.js";

export class JsonStorage implements IStorage {
  private filePath: string;
  private gapFilePath: string;
  private competitorFilePath: string;
  private saveQueue: Promise<void> = Promise.resolve();

  constructor() {
    const envPath = process.env.OPEN_AEO_STORE_PATH;
    if (envPath && envPath.trim() !== "") {
      if (!path.isAbsolute(envPath)) {
        throw new Error(
          `OPEN_AEO_STORE_PATH must be an absolute path, got: "${envPath}"`,
        );
      }
      this.filePath = envPath;
      this.gapFilePath = path.join(path.dirname(envPath), "gap-history.json");
      this.competitorFilePath = path.join(path.dirname(envPath), "competitor-history.json");
    } else {
      const folderPath = path.join(os.homedir(), ".open-aeo");
      this.filePath = path.join(folderPath, "history.json");
      this.gapFilePath = path.join(folderPath, "gap-history.json");
      this.competitorFilePath = path.join(folderPath, "competitor-history.json");
    }
  }

  private async ensureDirectory(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
  }

  private async readHistory(): Promise<AeoCheckResult[]> {
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      try {
        return JSON.parse(data) as AeoCheckResult[];
      } catch {
        console.error(
          `Warning: history file at "${this.filePath}" contains invalid JSON. Returning empty history.`,
        );
        return [];
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        return [];
      }
      throw error;
    }
  }
  async save(result: AeoCheckResult): Promise<void> {
    this.saveQueue = this.saveQueue.then(async () => {
      await this.ensureDirectory();
      const history = await this.readHistory();
      history.push(result);
      await fs.writeFile(
        this.filePath,
        JSON.stringify(history, null, 2),
        "utf-8",
      );
    });
    return this.saveQueue;
  }

  async getHistory(query?: string): Promise<AeoCheckResult[]> {
    const history = await this.readHistory();
    if (!query) return history;

    return history.filter(
      (item) => item.query.toLowerCase() === query.toLowerCase(),
    );
  }

  private async readGapHistory(): Promise<GapAnalysisResult[]> {
    try {
      const data = await fs.readFile(this.gapFilePath, "utf-8");
      try {
        return JSON.parse(data) as GapAnalysisResult[];
      } catch {
        console.error(
          `Warning: gap history file at "${this.gapFilePath}" contains invalid JSON. Returning empty history.`,
        );
        return [];
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        return [];
      }
      throw error;
    }
  }

  async saveGapResult(result: GapAnalysisResult): Promise<void> {
    this.saveQueue = this.saveQueue.then(async () => {
      await this.ensureDirectory();
      const history = await this.readGapHistory();
      history.push(result);
      await fs.writeFile(
        this.gapFilePath,
        JSON.stringify(history, null, 2),
        "utf-8",
      );
    });
    return this.saveQueue;
  }

  async getGapHistory(domain?: string): Promise<GapAnalysisResult[]> {
    const history = await this.readGapHistory();
    if (!domain) return history;

    const lowerDomain = domain.toLowerCase();
    return history.filter((item) =>
      item.gapTarget.targetDomain.toLowerCase().includes(lowerDomain),
    );
  }

  private async readCompetitorHistory(): Promise<CompetitorAnalysis[]> {
    try {
      const data = await fs.readFile(this.competitorFilePath, "utf-8");
      try {
        return JSON.parse(data) as CompetitorAnalysis[];
      } catch {
        console.error(
          `Warning: competitor history file at "${this.competitorFilePath}" contains invalid JSON. Returning empty history.`,
        );
        return [];
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        return [];
      }
      throw error;
    }
  }

  async saveCompetitorAnalysis(analysis: CompetitorAnalysis): Promise<void> {
    this.saveQueue = this.saveQueue.then(async () => {
      await this.ensureDirectory();
      const history = await this.readCompetitorHistory();
      history.push(analysis);
      await fs.writeFile(
        this.competitorFilePath,
        JSON.stringify(history, null, 2),
        "utf-8",
      );
    });
    return this.saveQueue;
  }

  async getCompetitorHistory(
    domain?: string,
    query?: string,
  ): Promise<CompetitorAnalysis[]> {
    const history = await this.readCompetitorHistory();

    const filtered = history.filter((item) => {
      if (domain && !item.targetDomain.toLowerCase().includes(domain.toLowerCase())) {
        return false;
      }
      if (query && !item.query.toLowerCase().includes(query.toLowerCase())) {
        return false;
      }
      return true;
    });

    return filtered.sort((a, b) =>
      b.analysedAt.localeCompare(a.analysedAt),
    );
  }
}
