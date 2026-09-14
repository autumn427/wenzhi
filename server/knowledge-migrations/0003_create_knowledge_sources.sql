-- Search snapshots are intentionally source summaries only.  Raw prompts and
-- answer bodies never enter this table.
CREATE TABLE IF NOT EXISTS knowledge_sources (
  query_hash TEXT NOT NULL CHECK (length(query_hash) = 64),
  normalized_query TEXT NOT NULL CHECK (length(normalized_query) BETWEEN 2 AND 160),
  source_id TEXT NOT NULL CHECK (length(source_id) BETWEEN 1 AND 180),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 180),
  excerpt TEXT NOT NULL DEFAULT '' CHECK (length(excerpt) <= 520),
  source_url TEXT NOT NULL CHECK (length(source_url) <= 500),
  author TEXT NOT NULL DEFAULT '' CHECK (length(author) <= 80),
  score REAL NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 1),
  authority TEXT NOT NULL DEFAULT '' CHECK (length(authority) <= 8),
  votes INTEGER NOT NULL DEFAULT 0 CHECK (votes >= 0),
  retrieved_at TEXT NOT NULL,
  release TEXT NOT NULL DEFAULT '' CHECK (length(release) <= 80),
  PRIMARY KEY (query_hash, source_id, retrieved_at)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_sources_query_time
  ON knowledge_sources (query_hash, retrieved_at DESC);

