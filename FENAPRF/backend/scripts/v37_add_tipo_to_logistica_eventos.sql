-- Migration: v37_add_tipo_to_logistica_eventos
-- Descrição: Adiciona a coluna 'tipo' na tabela 'logistica_eventos' para suportar categorização de eventos (AGE/AGO/OUTRO)
-- Aderente ao Canon e necessário para evitar erros 500 no insert.

ALTER TABLE logistica_eventos ADD COLUMN tipo VARCHAR(50);

COMMENT ON COLUMN logistica_eventos.tipo IS 'Tipo do evento logístico (ex: AGE, AGO, OUTRO)';
