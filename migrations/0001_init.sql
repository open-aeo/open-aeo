-- Durable storage for the hosted Cloudflare Workers server (BRG-142).
-- Each table keeps the full result as JSON in `data` plus the scalar columns
-- IStorage's filter methods need, mirroring JSONStorage's in-memory filters.

CREATE TABLE checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  target_domain TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX idx_checks_query ON checks(query);

CREATE TABLE gap_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_domain TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX idx_gap_results_domain ON gap_results(target_domain);

CREATE TABLE competitor_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  target_domain TEXT NOT NULL,
  analysed_at TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX idx_competitor_domain ON competitor_analyses(target_domain);
