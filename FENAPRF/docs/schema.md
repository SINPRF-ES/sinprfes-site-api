# Schema Oficial FENAPRF (UUID Nativo)

Este documento descreve o schema oficial do sistema FENAPRF, organizado por módulos funcionais.
O padrão de identificação é **UUID** para PKs e FKs.
O Backend gera **UUIDv7** para persistência; o banco utiliza `gen_random_uuid()` como fallback.

---

## 1. Módulo: Gestão de Membros

### users
Tabela central de membros. Mantém compatibilidade com campos administrativos e dual-role.
- `id` (UUID, PK)
- `cpf` (VARCHAR(11), Unique, Not Null)
- `name` (VARCHAR(255), Not Null)
- `email` (VARCHAR(255))
- `password_hash` (VARCHAR(255))
- `perfil_acesso` (VARCHAR(20)): ADMIN, DIRETORIA, COLABORADOR, CONSELHEIRO.
- `situacao` (VARCHAR(20)): Default 'ATIVO'.
- `bloqueado` (BOOLEAN): Default FALSE.
- `uf` (VARCHAR(2)): UF do cargo principal.
- `uf2` (VARCHAR(2)): UF do cargo secundário (Dual Role).
- `uf_endereco` (VARCHAR(2)): UF residencial (BuscaCEP).
- `logradouro` (TEXT)
- `bairro` (VARCHAR(100))
- `numero` (VARCHAR(20))
- `complemento` (TEXT)
- `cidade` (VARCHAR(100))
- `cep` (VARCHAR(8))
- `cargo` (VARCHAR(100)): Cargo principal.
- `cargo2` (VARCHAR(100)): Cargo secundário (Dual Role).
- `perfil_acesso2` (VARCHAR(20)): Perfil do segundo vínculo.
- `cargo_mandato_inicio` (DATE)
- `cargo_mandato_fim` (DATE)
- `avatar_url` (TEXT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `arquivado_em` (TIMESTAMP)
- `arquivado_por` (UUID, FK → users)

### user_vinculos
Normalização de cargos e mandatos (em transição).
- `id` (UUID, PK)
- `user_id` (UUID, FK → users)
- `scope` (VARCHAR(20)): FENAPRF, UF, NACIONAL.
- `uf` (VARCHAR(2))
- `role` (VARCHAR(50)): Nome do cargo.
- `mandato_inicio` (DATE)
- `mandato_fim` (DATE)
- `status` (VARCHAR(20)): ATIVO, INATIVO.

### user_movimentacoes
Log de histórico de arquivamento/reativação.
- `id` (UUID, PK)
- `user_id` (UUID, FK → users)
- `acao` (VARCHAR(50)): ARQUIVADO, DESARQUIVADO.
- `por_id` (UUID, FK → users)
- `motivo` (TEXT)

---

## 2. Módulo: Assembleia (AGE/AGO)

### assembleias
Gestão de eventos deliberativos formais.
- `id` (UUID, PK)
- `tipo` (VARCHAR(10)): AGE, AGO, etc.
- `titulo` (VARCHAR(255))
- `estado` (VARCHAR(20)): CRIADO, EM_CREDENCIAMENTO, INICIADO, SUSPENSA, ENCERRADO.
- `edital_drive_file_id` (TEXT): ID do PDF na Biblioteca Digital.

### assembleia_quoruns
Snapshots de presença e tokens de acesso.
- `id` (UUID, PK)
- `is_global` (BOOLEAN): TRUE para credenciamento inicial do evento.
- `token` (CHAR(10) ou VARCHAR(6)): Alfanumérico para Global, Numérico para Quórum.
- `tipo_chamada` (VARCHAR(20)): PRIMEIRA, SEGUNDA, RECONTAGEM, GLOBAL.

### assembleia_checkins
Registro de presença em um snapshot de quórum.
- `id` (UUID, PK)
- `assembleia_quorum_id` (UUID, FK → assembleia_quoruns)
- `user_id` (UUID, FK → users)

### assembleia_checkins_pendentes
Fila de substituição hierárquica bloqueada durante votação ativa.
- `id` (UUID, PK)
- `assembleia_id` (UUID, FK → assembleias)
- `user_id_superior` (UUID)
- `user_id_subordinado` (UUID)

### assembleia_mesa
Composição da Mesa Diretora da Assembleia.
- `id` (UUID, PK)
- `presidente_user_id` (UUID)
- `vice_presidente_user_id` (UUID)
- `secretario_user_id` (UUID)
- `secretario_2_user_id` (UUID)

### assembleia_votacoes
Itens de pauta em deliberação.
- `id` (UUID, PK)
- `quorum_snapshot_id` (UUID, FK → assembleia_quoruns)
- `status` (VARCHAR(20)): ATIVA, ENCERRADA.

### assembleia_votos
Registro nominal de votos.
- `votacao_id` (UUID, FK → assembleia_votacoes)
- `user_id` (UUID, FK → users)
- `voto` (VARCHAR(15)): SIM, NAO, ABSTENCAO.

### assembleia_propostas
Propostas enviadas por membros durante a sessão.
- `id` (UUID, PK)
- `autor_id` (UUID)
- `status` (VARCHAR(20)): ATIVA, EM_VOTACAO, RETIRADA, CANCELADA_BRANCH.

---

## 3. Módulo: Eventos (Gerais)
*Módulo independente para eventos não-deliberativos.*

- `eventos`: Cadastro geral.
- `evento_presencas`: Registro de entrada/saída simples.
- `evento_votacoes` / `evento_votacao_votos`: Sistema de votação simplificado por evento.

---

## 4. Módulo: Votações (Avulsas)
*Módulo para enquetes e votações independentes de eventos.*

- `votacoes`: Definição da enquete.
- `votacao_opcoes`: Opções de resposta.
- `votacao_votos`: Registro de participação.

---

## 5. Módulo: Logística

- `logistica_eventos`: Viagens, hospedagens e agendas.
- `logistica_inscricoes`: Participação de membros em eventos de logística.

---

## 6. Módulo: Comunicação e Push

- `push_tokens`: Tokens de dispositivos móveis.
- `push_campaigns`: Campanhas de disparo.
- `push_tickets`: Recibos de entrega do Expo Push Service.

---

## 7. Sistema e Autenticação

- `auth_sessions`: Gerenciamento de sessões persistentes e Refresh Tokens.
- `job_runs`: Controle de execução de tarefas agendadas (Cron).
- `report_jobs`: Fila de geração de relatórios PDF.

---

## 8. Legado (Não utilizados)

- 🔴 `content_blocks`: Antigo sistema de blocos de conteúdo dinâmico.
- 🔴 `pre_inscricoes_jogos`: Dados de pré-inscrição para evento esportivo passado.
