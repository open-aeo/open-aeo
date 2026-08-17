-- Per-user accounts and encrypted provider API keys (BRG-143). Scopes the
-- existing D1 storage (0001_init.sql / BRG-142) per user.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  github_id INTEGER NOT NULL UNIQUE,
  login TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE user_provider_keys (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, provider)
);

ALTER TABLE checks ADD COLUMN user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE gap_results ADD COLUMN user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE competitor_analyses ADD COLUMN user_id TEXT NOT NULL DEFAULT '';

CREATE INDEX idx_checks_user ON checks(user_id);
CREATE INDEX idx_gap_results_user ON gap_results(user_id);
CREATE INDEX idx_competitor_user ON competitor_analyses(user_id);
