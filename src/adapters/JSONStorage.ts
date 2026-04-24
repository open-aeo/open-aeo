import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { IStorage } from "../ports/IStorage.js";
import { AeoCheckResult } from "../core/types.js";

export class JsonStorage implements IStorage {
  private filePath: string;
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
    } else {
      const folderPath = path.join(os.homedir(), ".open-aeo");
      this.filePath = path.join(folderPath, "history.json");
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
}
