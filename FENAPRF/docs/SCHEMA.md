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
- `uf` (VARCHAR(2)): UF de vínculo funcional.
- `cargo` (VARCHAR(100))
- `avatar_url` (TEXT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `arquivado_por` (UUID, FK → users, ON DELETE SET NULL)
- `desarquivado_por` (UUID, FK → users, ON DELETE SET NULL)
- **Legado/Compatibilidade**: `perfil_acesso2`, `cargo2`, `uf2`, `cargo_mandato_inicio`, `cargo_mandato_fim`.

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
