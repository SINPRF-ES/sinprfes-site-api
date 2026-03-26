CREATE TABLE IF NOT EXISTS cloudflare_edge_daily (
  metric_date DATE PRIMARY KEY,
  requests_total BIGINT NOT NULL DEFAULT 0,
  cached_requests BIGINT NOT NULL DEFAULT 0,
  threats_total BIGINT NOT NULL DEFAULT 0,
  page_views BIGINT NOT NULL DEFAULT 0,
  visits_total BIGINT NOT NULL DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cloudflare_edge_daily_synced_at
  ON cloudflare_edge_daily (synced_at DESC);
