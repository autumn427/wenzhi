CREATE TABLE IF NOT EXISTS telemetry_daily (
  metric_date TEXT NOT NULL,
  event_name TEXT NOT NULL CHECK (length(event_name) BETWEEN 1 AND 48),
  route_code TEXT NOT NULL DEFAULT '' CHECK (route_code IN ('', 'A', 'B', 'C')),
  day INTEGER NOT NULL DEFAULT 0 CHECK (day IN (0, 30, 90, 150, 180)),
  device TEXT NOT NULL DEFAULT '' CHECK (device IN ('', 'mobile', 'desktop')),
  release TEXT NOT NULL DEFAULT '',
  event_count INTEGER NOT NULL DEFAULT 0 CHECK (event_count >= 0),
  value_total INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (metric_date, event_name, route_code, day, device, release)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_daily_date
  ON telemetry_daily (metric_date, event_name);
