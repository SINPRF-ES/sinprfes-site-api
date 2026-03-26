CREATE TABLE IF NOT EXISTS site_access_logs (
  id BIGSERIAL PRIMARY KEY,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  path TEXT,
  origem_tipo VARCHAR(50) NOT NULL DEFAULT 'desconhecida',
  origem_valor TEXT,
  referrer_host VARCHAR(200),
  utm_source VARCHAR(120),
  utm_medium VARCHAR(120),
  utm_campaign VARCHAR(120),
  ip VARCHAR(80),
  user_agent VARCHAR(400)
);

CREATE INDEX IF NOT EXISTS idx_site_access_logs_accessed_at ON site_access_logs (accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_access_logs_origem ON site_access_logs (origem_tipo, origem_valor);
CREATE INDEX IF NOT EXISTS idx_site_access_logs_path ON site_access_logs (path);
