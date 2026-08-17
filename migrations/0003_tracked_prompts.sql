-- Saved/tracked prompts for the dashboard's Prompts page (fast-follow on
-- BRG-145): a query a user monitors over time, distinct from one-off Run
-- tab checks. No competitor_domains column — competitors are read from
-- actual check history (computeSourcesBreakdown), not a maintained list.

CREATE TABLE tracked_prompts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  query TEXT NOT NULL,
  target_domain TEXT NOT NULL,
  brand_name TEXT,
  engines TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_tracked_prompts_user ON tracked_prompts(user_id);
