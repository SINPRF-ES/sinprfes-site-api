# Schema Oficial FENAPRF (UUID Nativo)

Este documento descreve o schema oficial do sistema FENAPRF após o reset institucional.
O padrão de identificação é **UUIDv7** (gerado pelo backend) para PKs e FKs.

---

## users

Tabela central de membros.

### Campos
- `id` (UUID, PK, Default: `gen_random_uuid()`): Identificador único do membro.
- `cpf` (VARCHAR(11), Unique, Not Null): CPF apenas dígitos.
- `name` (VARCHAR(255), Not Null): Nome completo.
- `email` (VARCHAR(255)): E-mail principal.
- `password_hash` (VARCHAR(255)): Hash da senha (bcrypt).
- `perfil_acesso` (VARCHAR(20)): ADMIN, DIRETORIA, COLABORADOR, CONSELHEIRO.
- `situacao` (VARCHAR(20)): ATIVO, ARQUIVADO.
- `bloqueado` (BOOLEAN): Trava de acesso global.
- `uf` (VARCHAR(2)): UF de vínculo funcional.
- `cargo` (VARCHAR(100)): Cargo ocupado.
- `created_at` (TIMESTAMP): Data de criação.
- `updated_at` (TIMESTAMP): Data de atualização.
- `arquivado_por` (UUID, FK → users): Autor do arquivamento.
- `desarquivado_por` (UUID, FK → users): Autor da reativação.

### Regras
- Auto-referências (`arquivado_por`, `desarquivado_por`) usam `ON DELETE SET NULL`.

---

## user_movimentacoes

Trilha de auditoria para alterações críticas de estado do cadastro.

### Campos
- `id` (UUID, PK)
- `user_id` (UUID, FK → users, Not Null): Membro afetado.
- `acao` (VARCHAR(50), Not Null): ARQUIVADO, DESARQUIVADO.
- `por_id` (UUID, FK → users, Not Null): Ator que realizou a ação.
- `motivo` (TEXT): Justificativa obrigatória.
- `criado_em` (TIMESTAMP)

---

## assembleias

Gestão de Assembleias Gerais (AGO/AGE).

### Campos
- `id` (UUID, PK)
- `tipo` (VARCHAR(10)): AGE, AGO, REUNIAO_DELIBERATIVA, etc.
- `titulo` (VARCHAR(255), Not Null)
- `pauta` (TEXT)
- `estado` (VARCHAR(20)): CRIADO, EM_CREDENCIAMENTO, INICIADO, SUSPENSA, ENCERRADO.
- `criado_por` (UUID, FK → users)

### Regras
- CHECK constraint no `estado`.
- CHECK constraint no `tipo`.

---

## assembleia_quoruns

Controle de presenças e quórum via QR Code/Token.

### Campos
- `id` (UUID, PK)
- `assembleia_id` (UUID, FK → assembleias, Not Null)
- `token` (CHAR(10), Unique, Not Null): Token alfanumérico (ex.: F3A9B2C1D0).
- `is_global` (BOOLEAN): Se TRUE, é o QR principal de entrada na sala.
- `valido_ate` (TIMESTAMP | NULL): Expiração para tokens de votação (snapshots).

### Regras
- **QR Global**: `is_global = TRUE` exige `valido_ate IS NULL` (não expira).
- **Quórum de Votação**: `is_global = FALSE` exige `valido_ate IS NOT NULL`.
- **Exclusividade Global**: Apenas 1 QR Global ativo por assembleia (`encerrado_em IS NULL`).
- **Exclusividade Votação**: Apenas 1 QR de Quórum ativo por assembleia.

---

## assembleia_checkins

Registro de presença vinculado a um token/quorum.

### Campos
- `id` (UUID, PK)
- `assembleia_quorum_id` (UUID, FK → assembleia_quoruns, Not Null)
- `user_id` (UUID, FK → users, Not Null)
- `origem` (VARCHAR(50)): MANUAL, SCAN, AUTO.

### Regras
- Unicidade composta: `(assembleia_quorum_id, user_id)`.

---

## assembleia_votacoes

Itens de pauta levados a votação.

### Campos
- `id` (UUID, PK)
- `assembleia_id` (UUID, FK → assembleias, Not Null)
- `quorum_snapshot_id` (UUID, FK → assembleia_quoruns): Snapshot de quem pode votar.
- `titulo` (VARCHAR(255), Not Null)
- `status` (VARCHAR(20)): ATIVA, ENCERRADA.

---

## assembleia_votos

Computação dos votos individuais.

### Campos
- `id` (UUID, PK)
- `votacao_id` (UUID, FK → assembleia_votacoes, Not Null)
- `user_id` (UUID, FK → users, Not Null)
- `voto` (VARCHAR(15)): SIM, NAO, ABSTENCAO.

---

## logistica_eventos

Eventos de logística e deslocamento.

### Campos
- `id` (UUID, PK)
- `titulo` (TEXT, Not Null)
- `data_inicio` (TIMESTAMP, Not Null)
- `data_fim` (TIMESTAMP, Not Null)
- `status` (VARCHAR(20)): ativo, encerrado, cancelado.

---

## push_tokens

Tokens de notificação Expo.

### Campos
- `id` (UUID, PK)
- `user_id` (UUID, FK → users, Not Null)
- `expo_push_token` (TEXT, Unique, Not Null)
- `device_id` (TEXT)
- `platform` (VARCHAR(20)): ios, android.

---

## job_runs

Controle de execução de tarefas agendadas.

### Campos
- `job_name` (VARCHAR(50), PK)
- `last_run_date` (VARCHAR(10))
- `updated_at` (TIMESTAMP)
