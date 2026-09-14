CREATE TABLE IF NOT EXISTS contributions (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  background TEXT NOT NULL CHECK (length(background) BETWEEN 4 AND 160),
  task TEXT NOT NULL CHECK (length(task) BETWEEN 4 AND 240),
  weekly_time TEXT NOT NULL CHECK (weekly_time IN ('lt1', '1-2', 'gt2')),
  duration TEXT NOT NULL CHECK (duration IN ('2w', '4w', 'long')),
  outcome TEXT NOT NULL CHECK (length(outcome) BETWEEN 12 AND 1200),
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  consent_no_sensitive INTEGER NOT NULL CHECK (consent_no_sensitive = 1),
  source_host TEXT NOT NULL,
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  review_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_contributions_review_queue
  ON contributions (review_status, created_at);
