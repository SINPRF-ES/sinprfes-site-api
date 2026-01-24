# Assembleia Backend Contract

Este documento descreve o contrato da API e os eventos Socket.IO para o módulo de Assembleias e Votações.

## 1. Endpoints de API

Base URL: `/api/assembleias`

### Assembleias

| Método | Rota | Descrição | Permissão |
| :--- | :--- | :--- | :--- |
| `POST` | `/` | Criar nova assembleia | `VOTACAO_GERENCIAR` |
| `GET` | `/` | Listar assembleias | Autenticado |
| `GET` | `/:id` | Detalhes de uma assembleia | Autenticado |
| `GET` | `/:id/estado` | Estado completo (hidratação) | Autenticado |
| `POST` | `/:id/abrir` | Transição para `ABERTA` (Fase 2) | `VOTACAO_GERENCIAR` |
| `POST` | `/:id/iniciar-execucao` | Transição para `EM_CURSO` (Fase 3) | `VOTACAO_GERENCIAR` |
| `POST` | `/:id/encerrar` | Transição para `ENCERRADA` (Fase 4) | `VOTACAO_GERENCIAR` |
| `POST` | `/:id/relatorio` | Solicitar relatório (Stub) | `VOTACAO_GERENCIAR` |

### Quórum e Presença

| Método | Rota | Payload | Descrição |
| :--- | :--- | :--- | :--- |
| `POST` | `/:id/token` | `{ tipo_chamada, observacao }` | Gera token / Recontagem |
| `POST` | `/:id/checkin` | `{ token }` | Realiza check-in do usuário |

### Mesa

| Método | Rota | Payload | Descrição |
| :--- | :--- | :--- | :--- |
| `POST` | `/:id/mesa` | `{ presidente_user_id, secretario_user_id }` | Define os membros da mesa |

### Votações (Itens de Pauta)

| Método | Rota | Payload | Descrição |
| :--- | :--- | :--- | :--- |
| `POST` | `/:id/votacoes` | `{ titulo, descricao, duracao_segundos }` | Inicia item de votação |
| `POST` | `/:id/votacoes/:vid/voto` | `{ voto: 'SIM'\|'NAO'\|'ABSTENCAO' }` | Registra/Altera voto |
| `POST` | `/:id/votacoes/:vid/encerrar` | - | Encerra votação antecipadamente |

---

## 2. Eventos Socket.IO

Os clientes devem entrar na sala `assembleia_{id}`.

| Evento | Payload | Descrição |
| :--- | :--- | :--- |
| `assembleia:status_changed` | `{ estado }` | Mudança de estado da assembleia |
| `assembleia:token_gerado` | `{ id, token, tipo_chamada }` | Novo token de check-in |
| `assembleia:recontagem` | `{ id, token, tipo_chamada: 'RECONTAGEM' }` | Recontagem iniciada |
| `assembleia:checkin_updated` | `{ total }` | Atualização do total de presentes |
| `assembleia:mesa_definida` | `{ presidente_nome, secretario_nome, ... }` | Mesa composta |
| `votacao:iniciada` | `{ id, titulo, duracao_segundos, aberta_em, ... }` | Novo item em votação |
| `voto:updated` | `{ contagem: { SIM, NAO, ABSTENCAO, total }, votos: [...] }` | Voto registrado em tempo real |
| `votacao:encerrada` | `{ id, contagem, votos, ... }` | Votação concluída |
| `assembleia:encerrada` | `{}` | Assembleia finalizada |

---

## 3. Estados e Regras

### Máquina de Estados
- `CRIADA` -> `ABERTA` -> `EM_CURSO` -> `ENCERRADA`
- `ABERTA` -> `ENCERRADA` (Cancelamento/Encerramento precoce)

### Quórum e Snapshot
- **Quórum Vigente:** Definido pelo último token gerado que não foi encerrado por recontagem.
- **Snapshot de Elegibilidade:** Ao iniciar uma votação, o sistema congela a lista de presentes no quórum vigente. Apenas estes podem votar no item.
- **Abstenção Automática:** No encerramento da votação, usuários elegíveis que não votaram recebem automaticamente o voto `ABSTENCAO`.

### Perfis
- `DIRETORIA`, `FILIADO`, `ORGANIZADOR`: Contam para quórum e votam.
- `ADMIN`, `COMUNICADOR`: **Não** contam para quórum, **não** votam e **não** podem realizar check-in.

---

## 4. Códigos de Erro Comuns

- `403 Forbidden`: Perfil sem permissão ou perfil excluído tentando check-in/voto.
- `409 Conflict`: Transição de estado inválida.
- `422 Unprocessable Entity`: Regra de negócio violada (ex: Mesa ausente ao iniciar execução).
