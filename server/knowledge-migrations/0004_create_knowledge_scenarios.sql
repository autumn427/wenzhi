-- A compact, auditable value card for each successful evidence search.
-- It stores topic hints and source IDs, never raw prompts or answer bodies.
CREATE TABLE IF NOT EXISTS knowledge_scenarios (
  query_hash TEXT NOT NULL CHECK (length(query_hash) = 64),
  generated_at TEXT NOT NULL,
  query TEXT NOT NULL CHECK (length(query) BETWEEN 2 AND 160),
  target_user TEXT NOT NULL CHECK (length(target_user) BETWEEN 2 AND 160),
  pain_point TEXT NOT NULL CHECK (length(pain_point) BETWEEN 2 AND 240),
  ai_role TEXT NOT NULL CHECK (length(ai_role) BETWEEN 2 AND 240),
  value_signal TEXT NOT NULL CHECK (length(value_signal) BETWEEN 2 AND 320),
  limitations TEXT NOT NULL CHECK (length(limitations) BETWEEN 2 AND 320),
  evidence_refs TEXT NOT NULL DEFAULT '[]' CHECK (length(evidence_refs) <= 2000),
  release TEXT NOT NULL DEFAULT '' CHECK (length(release) <= 80),
  PRIMARY KEY (query_hash, generated_at)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_scenarios_query_time
  ON knowledge_scenarios (query_hash, generated_at DESC);

