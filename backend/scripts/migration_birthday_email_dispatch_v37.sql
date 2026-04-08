-- Migration v37: log de disparos individuais de e-mail de aniversário
-- Objetivo: garantir idempotência por data + destinatário + tipo de envio.

CREATE TABLE IF NOT EXISTS birthday_email_dispatch_log (
    id BIGSERIAL PRIMARY KEY,
    send_type VARCHAR(50) NOT NULL,
    reference_date DATE NOT NULL,
    recipient_key VARCHAR(120) NOT NULL,
    filiado_id INTEGER,
    recipient_name VARCHAR(255),
    target_email VARCHAR(320),
    status VARCHAR(20) NOT NULL,
    provider_message_id VARCHAR(255),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_birthday_email_dispatch_status CHECK (status IN ('pending', 'sent', 'failed', 'skipped'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_birthday_email_dispatch_idempotency
ON birthday_email_dispatch_log (send_type, reference_date, recipient_key);

CREATE INDEX IF NOT EXISTS idx_birthday_email_dispatch_reference_date
ON birthday_email_dispatch_log (reference_date DESC);
