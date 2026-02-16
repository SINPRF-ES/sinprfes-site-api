-- Adiciona campos para data/hora de início e link para o edital
ALTER TABLE assembleias ADD COLUMN IF NOT EXISTS data_hora_inicio TIMESTAMP;
ALTER TABLE assembleias ADD COLUMN IF NOT EXISTS edital_url TEXT;

-- Comentários para documentação
COMMENT ON COLUMN assembleias.data_hora_inicio IS 'Data e hora agendada para o início da assembleia';
COMMENT ON COLUMN assembleias.edital_url IS 'URL do arquivo do edital de convocação (PDF ou Imagem)';
