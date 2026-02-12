-- FENAPRF MIGRATION V35: PUSH NOTIFICATION TICKETS
-- Objective: Support persistence of Expo tickets for receipt processing.

BEGIN;

CREATE TABLE IF NOT EXISTS push_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES push_campaigns(id) ON DELETE CASCADE,
    ticket_id TEXT UNIQUE NOT NULL,
    expo_push_token TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'ok', -- 'ok' or 'error'
    processed BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    error_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_tickets_campaign ON push_tickets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_push_tickets_unprocessed ON push_tickets(processed) WHERE processed = FALSE;

COMMIT;
