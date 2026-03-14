import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { IStorage } from "../ports/IStorage.js";
import { AeoCheckResult } from "../core/types.js";

export class JsonStorage implements IStorage {
  private filePath: string;

  constructor() {
    const homeDir = os.homedir();
    const folderPath = path.join(homeDir, ".open-aeo");
    this.filePath = path.join(folderPath, "history.json");
  }

  private async ensureDirectory(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
  }

  async save(result: AeoCheckResult): Promise<void> {
    await this.ensureDirectory();

    let history: AeoCheckResult[] = [];

    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      history = JSON.parse(data);
    } catch (error) {
      console.log("file does not exist, please create");
    }

    history.push(result);

    await fs.writeFile(
      this.filePath,
      JSON.stringify(history, null, 2),
      "utf-8",
    );
  }

  async getHistory(query?: string): Promise<AeoCheckResult[]> {
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      const history: AeoCheckResult[] = JSON.parse(data);

      if (query) {
        return history.filter((item) => item.query === query);
      }

      return history;
    } catch (error) {
      return [];
    }
  }
}
