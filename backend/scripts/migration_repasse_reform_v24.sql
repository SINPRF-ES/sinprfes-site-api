-- v24: Reformulação do módulo Repasse (apoio operacional + eventos)

CREATE TABLE IF NOT EXISTS repasse_config (
  ano_ref INT PRIMARY KEY,
  per_capita_global_anual NUMERIC(12,2) NOT NULL CHECK (per_capita_global_anual > 0),
  per_capita_apoio_operacional_anual NUMERIC(12,2) NOT NULL CHECK (
    per_capita_apoio_operacional_anual >= 0
    AND per_capita_apoio_operacional_anual <= per_capita_global_anual
  ),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repasse_eventos (
  id SERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  responsavel_filiado_id INT REFERENCES filiados(id),
  data_evento DATE NOT NULL,
  data_limite_alocacao DATE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('RASCUNHO', 'ABERTO', 'ENCERRADO')),
  created_by_user_id INT REFERENCES filiados(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CHECK (data_limite_alocacao <= data_evento)
);

CREATE TABLE IF NOT EXISTS repasse_evento_alocacoes (
  id SERIAL PRIMARY KEY,
  ano_ref INT NOT NULL,
  evento_id INT NOT NULL REFERENCES repasse_eventos(id) ON DELETE CASCADE,
  filiado_id INT NOT NULL REFERENCES filiados(id),
  valor_alocado NUMERIC(12,2) NOT NULL CHECK (valor_alocado >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'ATIVA' CHECK (status IN ('ATIVA', 'REVOGADA')),
  revogado_em TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_repasse_alocacao_ativa_ano
  ON repasse_evento_alocacoes (ano_ref, filiado_id)
  WHERE status = 'ATIVA';

CREATE TABLE IF NOT EXISTS repasse_movimentos (
  id SERIAL PRIMARY KEY,
  ano_ref INT NOT NULL,
  lotacao_id TEXT,
  tipo VARCHAR(40) NOT NULL CHECK (tipo IN ('APOIO_OPERACIONAL_DEBITO')),
  valor NUMERIC(12,2) NOT NULL CHECK (valor >= 0),
  descricao TEXT,
  created_by_user_id INT REFERENCES filiados(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
