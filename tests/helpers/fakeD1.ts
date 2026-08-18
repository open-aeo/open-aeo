import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { D1Database } from "@cloudflare/workers-types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "../../migrations");

// Minimal shim exposing only the D1Database surface the adapters call
// (prepare().bind().run()/.all()/.first()), backed by a real in-memory SQLite
// engine (better-sqlite3) so adapters' actual SQL runs, without needing a
// workerd/Miniflare runtime. Applies every migration in order, so it always
// reflects the current schema.
export function createFakeD1(): D1Database {
  const sqlite = new Database(":memory:");
  for (const file of readdirSync(migrationsDir).sort()) {
    if (file.endsWith(".sql")) {
      sqlite.exec(readFileSync(join(migrationsDir, file), "utf-8"));
    }
  }

  return {
    prepare(query: string) {
      const stmt = sqlite.prepare(query);
      let boundArgs: unknown[] = [];
      const statement = {
        bind(...args: unknown[]) {
          boundArgs = args;
          return statement;
        },
        async run() {
          stmt.run(...boundArgs);
          return {};
        },
        async all<U>() {
          return { results: stmt.all(...boundArgs) as U[] };
        },
        async first<U>() {
          return (stmt.get(...boundArgs) as U) ?? null;
        },
      };
      return statement;
    },
  } as unknown as D1Database;
}
