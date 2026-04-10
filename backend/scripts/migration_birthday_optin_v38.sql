-- Migration v38: adiciona opt-in de comunicação para filiados
-- Objetivo: permitir bloqueio de mensagens automáticas (ex.: felicitações de aniversário)

ALTER TABLE filiados
ADD COLUMN IF NOT EXISTS permite_comunicacao BOOLEAN DEFAULT TRUE;

UPDATE filiados
SET permite_comunicacao = TRUE
WHERE permite_comunicacao IS NULL;
