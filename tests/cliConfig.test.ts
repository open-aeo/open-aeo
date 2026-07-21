import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/cli/config.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "open-aeo-cfg-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function write(content: string): string {
  const filePath = join(dir, "queries.yaml");
  writeFileSync(filePath, content);
  return filePath;
}

describe("loadConfig", () => {
  it("loads a valid config", () => {
    const path = write(
      `targetDomain: linear.app\nbrandName: Linear\nsamples: 3\nqueries:\n  - a\n  - b\n`,
    );
    const config = loadConfig(path);
    expect(config.targetDomain).toBe("linear.app");
    expect(config.brandName).toBe("Linear");
    expect(config.samples).toBe(3);
    expect(config.queries).toEqual(["a", "b"]);
  });

  it("errors when targetDomain is missing", () => {
    const path = write(`queries:\n  - a\n`);
    expect(() => loadConfig(path)).toThrowError(/targetDomain/);
  });

  it("errors when there are no queries", () => {
    const path = write(`targetDomain: x\nqueries: []\n`);
    expect(() => loadConfig(path)).toThrowError(/queries/);
  });

  it("rejects an unknown engine", () => {
    const path = write(`targetDomain: x\nengines: [bing]\nqueries:\n  - a\n`);
    expect(() => loadConfig(path)).toThrowError(/invalid/i);
  });

  it("errors when the file does not exist", () => {
    expect(() => loadConfig(join(dir, "nope.yaml"))).toThrowError(
      /Could not read/,
    );
  });
});
