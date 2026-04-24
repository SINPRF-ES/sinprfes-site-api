ALTER TABLE filiados
ADD COLUMN IF NOT EXISTS uf_sindicato_externo VARCHAR(2);

UPDATE filiados
SET uf_sindicato_externo = NULL
WHERE situacao_sindical IS DISTINCT FROM 'FILIADO_OUTRO_SINDICATO';

UPDATE filiados
SET uf_sindicato_externo = UPPER(BTRIM(uf_sindicato_externo))
WHERE uf_sindicato_externo IS NOT NULL;

UPDATE filiados
SET uf_sindicato_externo = NULL
WHERE uf_sindicato_externo IS NOT NULL
  AND uf_sindicato_externo NOT IN (
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'filiados_uf_sindicato_externo_chk'
  ) THEN
    ALTER TABLE filiados
    ADD CONSTRAINT filiados_uf_sindicato_externo_chk
    CHECK (
      uf_sindicato_externo IS NULL
      OR uf_sindicato_externo IN (
        'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'filiados_uf_sindicato_externo_regra_chk'
  ) THEN
    ALTER TABLE filiados
    ADD CONSTRAINT filiados_uf_sindicato_externo_regra_chk
    CHECK (
      (situacao_sindical = 'FILIADO_OUTRO_SINDICATO' AND uf_sindicato_externo IS NULL)
      OR (situacao_sindical = 'FILIADO_OUTRO_SINDICATO' AND uf_sindicato_externo <> 'ES')
      OR (situacao_sindical <> 'FILIADO_OUTRO_SINDICATO' AND uf_sindicato_externo IS NULL)
    );
  END IF;
END $$;

COMMENT ON COLUMN filiados.uf_sindicato_externo IS
  'UF do sindicato quando situacao_sindical = FILIADO_OUTRO_SINDICATO; não armazena nome, rubrica ou valores.';
