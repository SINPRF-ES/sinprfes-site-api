CREATE TABLE IF NOT EXISTS report_efetivo_lotacao (
  lotacao_key TEXT PRIMARY KEY,
  prf_total INTEGER NOT NULL CHECK (prf_total >= 0),
  updated_by INTEGER REFERENCES filiados(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT report_efetivo_lotacao_lotacao_chk CHECK (
    lotacao_key IN (
      'SEDE',
      'DEL 01 - Viana',
      'DEL 02 - Serra',
      'DEL 03 - Guarapari',
      'DEL 04 - Linhares'
    )
  )
);
