# Schema Oficial FENAPRF (PostgreSQL + Backend como Fonte da Verdade)

Este documento descreve o schema do sistema FENAPRF, organizado por módulos funcionais.
- Identificação: **UUID** em PKs e FKs.
- Geração atual no banco: `gen_random_uuid()`.

> Regra: o schema documentado deve refletir o que o backend utiliza. Quando o banco divergir do backend, a correção deve ser proposta via scripts/migrations em `FENAPRF/backend/scripts`.

---

## 1. Módulo: Gestão de Membros

### users
Tabela central de membros.
Campos relevantes (conforme banco atual):
- `id` (uuid, PK, default `gen_random_uuid()`)
- `cpf` (varchar, NOT NULL)
- `name` (varchar, NOT NULL)
- `email` (varchar, nullable)
- `password_hash` (varchar, nullable)
- `perfil_acesso` (varchar, nullable)
- `situacao` (varchar, default `'ATIVO'`)
- `bloqueado` (boolean, default `false`)
- `telefone1`, `telefone2` (varchar)
- Endereço: `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf_endereco`
- Vínculos/cargos:
  - `cargo`, `uf` (vínculo principal)
  - `perfil_acesso2`, `cargo2`, `uf2` (segundo vínculo / cargos acumulados)
  - `cargo_mandato_inicio`, `cargo_mandato_fim`
- Avatar: `avatar_url`, `avatar_public_id`
- Auditoria/estado:
  - `created_at`, `updated_at`, `ultimo_acesso`
  - arquivamento: `arquivado_em`, `arquivado_motivo`, `arquivado_por` (FK users)
  - desarquivamento: `desarquivado_em`, `desarquivado_motivo`, `desarquivado_por` (FK users)
- Tokens temporários:
  - `token_acesso_temp`, `token_expiracao`

> Observação institucional: campos duplicados (`perfil_acesso2`, `cargo2`, `uf2`) são intencionais para suportar 2 cargos/vínculos acumulados e múltiplas UFs (endereço residencial + vínculos).

### user_vinculos
Normalização para vínculos múltiplos (em evolução):
- `id` (uuid, PK)
- `user_id` (uuid, FK users)
- `scope` (varchar)
- `uf` (varchar)
- `branch` (varchar)
- `role` (varchar)
- `mandato_inicio`, `mandato_fim` (date)
- `status` (varchar, default `'ATIVO'`)
- `is_substitute` (boolean, default `false`)
- `created_at`, `updated_at`

### user_movimentacoes
- `id` (uuid, PK)
- `user_id` (uuid, FK users)
- `acao` (varchar)
- `por_id` (uuid, FK users)
- `motivo` (text)
- `criado_em` (timestamptz, default now())

---

## 2. Módulo: Assembleia (AGE/AGO)

### assembleias
- `id` (uuid, PK)
- `tipo` (varchar, NOT NULL)
- `titulo` (varchar, NOT NULL)
- `pauta` (text, nullable)
- `estado` (varchar, default `'CRIADO'`)
- `criado_por` (uuid, FK users)
- `aberta_em`, `encerrada_em` (timestamptz)
- `criado_em` (timestamptz, default now())
- Agenda/horários:
  - `data_hora_inicio` (timestamptz)
  - `data_evento` (date)
  - `hora_primeira_chamada`, `hora_segunda_chamada` (time)
- Edital (biblioteca digital):
  - `edital_url`, `edital_public_id`, `edital_resource_type`, `edital_type`, `edital_format`
  - `edital_drive_file_id`
- Suspensão:
  - `suspensao_motivo` (text)
  - `data_hora_retorno` (timestamptz)

### assembleia_mesa
- `id` (uuid, PK)
- `assembleia_id` (uuid, FK assembleias)
- `presidente_user_id` (uuid, FK users)
- `vice_presidente_user_id` (uuid, FK users)
- `secretario_user_id` (uuid, FK users)
- `secretario_2_user_id` (uuid, FK users)
- `definida_por_user_id` (uuid, FK users)
- `definida_em` (timestamptz, default now())
- `estabelecida_em` (timestamptz, nullable)

### assembleia_mesa_rejeicoes
- `id` (uuid, PK)
- `assembleia_id` (uuid, FK assembleias)
- `user_id` (uuid, FK users)
- `cargo` (varchar, NOT NULL)
- `criado_em` (timestamptz, default now())

### assembleia_quoruns
- `id` (uuid, PK)
- `assembleia_id` (uuid, FK assembleias)
- `token` (character, NOT NULL)
- `gerado_por_user_id` (uuid, FK users)
- `tipo_chamada` (varchar, NOT NULL)
- métricas:
  - `quorum_total_ativos` (int, default 0)
  - `quorum_necessario` (int, default 0)
- flags/observações:
  - `is_global` (boolean, default false)
  - `observacao` (text)
- validade/encerramento:
  - `valido_ate`, `encerrado_em` (timestamptz)
- `criado_em` (timestamptz, default now())

> Nota: o tamanho semântico do token (10 alfanuméricos global / 6 numéricos quórum) é regra de negócio; o tipo atual é `character` no banco.

### assembleia_checkins
- `id` (uuid, PK)
- `assembleia_quorum_id` (uuid, FK assembleia_quoruns)
- `user_id` (uuid, FK users)
- `origem` (varchar)
- `registrado_em` (timestamptz, default now())

### assembleia_pedidos_palavra
- `id` (uuid, PK)
- `assembleia_id` (uuid, FK assembleias)
- `user_id` (uuid, FK users)
- `status` (varchar, default 'PENDENTE')
- `ordem` (int)
- `criado_em` (timestamptz, default now())

### assembleia_propostas
- `id` (uuid, PK)
- `assembleia_id` (uuid, FK assembleias)
- `autor_id` (uuid, FK users)
- `titulo` (varchar, NOT NULL)
- `descricao` (text)
- `status` (varchar, default 'ATIVA')
- `motivo_retirada` (text)
- `retirada_em` (timestamptz)
- `criado_em` (timestamptz, default now())

### assembleia_votacoes
- `id` (uuid, PK)
- `assembleia_id` (uuid, FK assembleias)
- `quorum_snapshot_id` (uuid, FK assembleia_quoruns)
- `titulo` (varchar, NOT NULL)
- `descricao` (text)
- `status` (varchar, default 'ATIVA')
- `duracao_segundos` (int, default 60)
- `iniciada_por_user_id` (uuid, FK users)
- `aberta_em`, `finalizada_em` (timestamptz)
- `criado_em` (timestamptz, default now())

### assembleia_votos
- `id` (uuid, PK)
- `votacao_id` (uuid, FK assembleia_votacoes)
- `user_id` (uuid, FK users)
- `voto` (varchar, NOT NULL)
- `registrado_em` (timestamptz, default now())

### assembleia_auditoria
- `id` (uuid, PK)
- `assembleia_id` (uuid, FK assembleias)
- `user_id` (uuid, FK users)
- `evento` (varchar, NOT NULL)
- `payload` (jsonb)
- `criado_em` (timestamptz, default now())

---

## 3. Módulo: Eventos (Gerais)
- `eventos`
- `evento_presencas`
- `evento_votacoes`
- `evento_votacao_opcoes`
- `evento_votacao_votos`
- `evento_votacao_elegiveis`

> Observação: módulo paralelo, deve refletir o backend quanto ao uso (ativo vs legado).

---

## 4. Módulo: Votações (Avulsas)
- `votacoes`
- `votacao_opcoes`
- `votacao_votos`

---

## 5. Módulo: Logística
- `logistica_eventos`
- `logistica_inscricoes`
- `logistica_auditoria`

---

## 6. Módulo: Comunicação e Push
- `push_tokens`
- `push_campaigns`
- `push_tickets`

---

## 7. Sistema e Autenticação

### auth_sessions
- `id` (uuid, PK)
- `user_id` (uuid, FK users)
- `token_hash` (text, NOT NULL)
- `device_id` (text)
- `created_at` (timestamptz, default now())
- `expires_at` (timestamptz, NOT NULL)
- `revoked_at` (timestamptz)
- `last_seen_at` (timestamptz, default now())

Outros:
- `job_runs`
- `report_jobs`
- `content_blocks` (ver legado abaixo)

---

## 8. Legado (Confirmar via Backend)
- `content_blocks` (sem referência direta no backend atual, validar)
- `pre_inscricoes_jogos` (se existir no banco atual; não apareceu no snapshot fornecido)
