# Schema Oficial FENAPRF (UUID Nativo)

Este documento descreve o schema oficial do sistema FENAPRF.
O padrão de identificação é **UUID** para PKs e FKs.
Backend gera **UUIDv7** para persistência; banco usa `gen_random_uuid()` como fallback.

---

## users

Tabela central de membros. Mantém compatibilidade com campos administrativos legados.

### Campos
- `id` (UUID, PK)
- `cpf` (VARCHAR(11), Unique, Not Null)
- `name` (VARCHAR(255), Not Null)
- `email` (VARCHAR(255))
- `password_hash` (VARCHAR(255))
- `perfil_acesso` (VARCHAR(20)): ADMIN, DIRETORIA, COLABORADOR, CONSELHEIRO.
- `situacao` (VARCHAR(20)): Default 'ATIVO'.
- `bloqueado` (BOOLEAN): Default FALSE.
- `uf` (VARCHAR(2)): UF do cargo principal.
- `uf2` (VARCHAR(2)): UF do cargo secundário.
- `uf_endereco` (VARCHAR(2)): UF residencial (BuscaCEP).
- `logradouro` (TEXT)
- `bairro` (VARCHAR(100))
- `numero` (VARCHAR(20))
- `complemento` (TEXT)
- `cidade` (VARCHAR(100))
- `cep` (VARCHAR(8))
- `cargo` (VARCHAR(100))
- `avatar_url` (TEXT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `arquivado_por` (UUID, FK → users, ON DELETE SET NULL)
- `desarquivado_por` (UUID, FK → users, ON DELETE SET NULL)
- **Legado/Compatibilidade**: `perfil_acesso2`, `cargo2`, `cargo_mandato_inicio`, `cargo_mandato_fim`.

---

## user_vinculos

Normalização de cargos e mandatos (substituirá gradualmente os campos legados de users).

### Campos
- `id` (UUID, PK)
- `user_id` (UUID, FK → users, Not Null, ON DELETE CASCADE)
- `scope` (VARCHAR(20)): FENAPRF, UF, NACIONAL.
- `uf` (VARCHAR(2))
- `branch` (VARCHAR(20)): DIRETORIA, DELEGACAO.
- `role` (VARCHAR(50)): Nome do cargo.
- `mandato_inicio` (DATE)
- `mandato_fim` (DATE)
- `status` (VARCHAR(20)): ATIVO, INATIVO.
- `is_substitute` (BOOLEAN)

---

## assembleias

Gestão de eventos deliberativos.

### Campos
- `id` (UUID, PK)
- `tipo` (VARCHAR(10)): AGE, AGO, etc.
- `titulo` (VARCHAR(255), Not Null)
- `pauta` (TEXT)
- `estado` (VARCHAR(20)): CRIADO, EM_CREDENCIAMENTO, INICIADO, SUSPENSA, ENCERRADO.
- `criado_por` (UUID, FK → users, ON DELETE SET NULL)

---

## assembleia_quoruns

Responsável por controlar QR Codes de presença e quórum.

### Campos
- `id` (UUID, PK)
- `assembleia_id` (UUID, FK → assembleias, Not Null, ON DELETE CASCADE)
- `is_global` (BOOLEAN): TRUE para credenciamento geral.
- `token` (CHAR(10), Unique, Not Null): Alfanumérico gerado.
- `valido_ate` (TIMESTAMP | NULL)

### Regras
- **QR Global**: `valido_ate` deve ser NULL.
- **Quórum de Votação**: `valido_ate` é obrigatório.
- Índices parciais garantem apenas 1 global e 1 de votação ativos por vez.

---

## assembleia_checkins

Registro de presença.

### Campos
- `id` (UUID, PK)
- `assembleia_quorum_id` (UUID, FK → assembleia_quoruns, Not Null, ON DELETE CASCADE)
- `user_id` (UUID, FK → users, Not Null, ON DELETE CASCADE)
- `origem` (VARCHAR(50))

---

## assembleia_checkins_pendentes

Suporte a substituição hierárquica (lock durante votação).

### Campos
- `id` (UUID, PK)
- `assembleia_id` (UUID, FK → assembleias, Not Null, ON DELETE CASCADE)
- `quorum_id` (UUID, FK → assembleia_quoruns, Not Null, ON DELETE CASCADE)
- `user_id_superior` (UUID, FK → users, Not Null, ON DELETE CASCADE)
- `user_id_subordinado` (UUID, FK → users, Not Null, ON DELETE CASCADE)
- `branch` (VARCHAR(20))
- `criado_em` (TIMESTAMP)

---

## push_campaigns

Registro de envios de notificações.

### Campos
- `id` (UUID, PK)
- `title` (TEXT)
- `body` (TEXT, Not Null)
- `target_type` (VARCHAR(50))
- `target_value` (JSONB)
- `data` (JSONB)
- `created_by` (UUID, FK → users)
- `status` (VARCHAR(20))
- `sent_at` (TIMESTAMP)
- `result` (JSONB)
- `created_at` (TIMESTAMP)

---

## push_tickets

Persistência de tickets do Expo para processamento de receipts.

### Campos
- `id` (UUID, PK)
- `campaign_id` (UUID, FK → push_campaigns, ON DELETE CASCADE)
- `ticket_id` (TEXT, Unique)
- `expo_push_token` (TEXT)
- `status` (VARCHAR(20))
- `processed` (BOOLEAN)
- `created_at` (TIMESTAMP)

---

## assembleia_votacoes

Itens em votação.

### Campos
- `id` (UUID, PK)
- `assembleia_id` (UUID, FK → assembleias, Not Null, ON DELETE CASCADE)
- `quorum_snapshot_id` (UUID, FK → assembleia_quoruns, ON DELETE SET NULL)
- `titulo` (VARCHAR(255), Not Null)
- `status` (VARCHAR(20))

---

## logistica_eventos

Gestão de logística.

### Campos
- `id` (UUID, PK)
- `titulo` (TEXT, Not Null)
- `status` (VARCHAR(20)): ativo, encerrado, cancelado.
- `cancelado_por` (UUID, FK → users, ON DELETE SET NULL)
- `encerrado_por` (UUID, FK → users, ON DELETE SET NULL)
