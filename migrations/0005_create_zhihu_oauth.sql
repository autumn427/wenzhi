CREATE TABLE IF NOT EXISTS zhihu_oauth_pending (
  session_hash TEXT PRIMARY KEY,
  state_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS zhihu_oauth_pending_expiry ON zhihu_oauth_pending(expires_at);
CREATE TABLE IF NOT EXISTS zhihu_oauth_sessions (
  session_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS zhihu_oauth_sessions_expiry ON zhihu_oauth_sessions(expires_at);
