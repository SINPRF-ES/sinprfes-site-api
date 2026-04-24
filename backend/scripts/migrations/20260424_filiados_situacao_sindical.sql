ALTER TABLE filiados
ADD COLUMN IF NOT EXISTS situacao_sindical VARCHAR(40);

UPDATE filiados
SET situacao_sindical = 'FILIADO_SINPRF_ES'
WHERE situacao_sindical IS NULL
   OR BTRIM(situacao_sindical) = '';

UPDATE filiados
SET situacao_sindical = 'DESCONHECIDO'
WHERE situacao_sindical NOT IN (
  'FILIADO_SINPRF_ES',
  'FILIADO_OUTRO_SINDICATO',
  'NAO_FILIADO',
  'DESCONHECIDO'
);

ALTER TABLE filiados
ALTER COLUMN situacao_sindical SET DEFAULT 'FILIADO_SINPRF_ES';

ALTER TABLE filiados
ALTER COLUMN situacao_sindical SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'filiados_situacao_sindical_chk'
  ) THEN
    ALTER TABLE filiados
    ADD CONSTRAINT filiados_situacao_sindical_chk
    CHECK (
      situacao_sindical IN (
        'FILIADO_SINPRF_ES',
        'FILIADO_OUTRO_SINDICATO',
        'NAO_FILIADO',
        'DESCONHECIDO'
      )
    );
  END IF;
END $$;

COMMENT ON COLUMN filiados.situacao_sindical IS
  'Classificação cadastral sindical para controle nominal e cálculo estatístico interno; não representa autorização de acesso.';
