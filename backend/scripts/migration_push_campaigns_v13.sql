-- scripts/migration_push_campaigns_v13.sql

CREATE TABLE IF NOT EXISTS push_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    body TEXT NOT NULL,
    target_type TEXT NOT NULL DEFAULT 'ALL',
    target_value JSONB,
    data JSONB,
    created_by INTEGER REFERENCES filiados(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'SENT',
    sent_at TIMESTAMPTZ,
    result JSONB
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_push_campaigns_created_at ON push_campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_campaigns_status ON push_campaigns(status);
