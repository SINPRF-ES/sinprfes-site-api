# Módulo 🗨️ Enquetes

## Objetivo

O módulo **🗨️ Enquetes** permite que a diretoria do SINPRF-ES crie consultas internas com voto transparente, incluindo suporte a resposta única, múltipla escolha e opção **Outro** com texto livre.

## Estrutura de banco

### `polls`
- `id`
- `title`
- `type` (`YES_NO` ou `MULTIPLE_CHOICE`)
- `allow_multiple_answers`
- `allow_other_option`
- `deadline_at`
- `status` (`DRAFT`, `ACTIVE`, `CLOSED`)
- `created_by`
- `created_at`
- `updated_at`

### `poll_options`
- `id`
- `poll_id`
- `label`
- `is_other`
- `sort_order`

### `poll_votes`
- `id`
- `poll_id`
- `user_id`
- `option_id`
- `other_text`
- `created_at`
- `updated_at`

## Endpoints

- `POST /api/polls`
- `PUT /api/polls/:id`
- `POST /api/polls/:id/publish`
- `GET /api/polls`
- `GET /api/polls/:id`
- `POST /api/polls/:id/vote`
- `GET /api/polls/:id/results`

> Todos os endpoints exigem autenticação e permissão `ENQUETES_GERENCIAR`.

## Regras de negócio

- Backend é a fonte única da verdade para criação, publicação, votação e resultados.
- Apenas diretoria/admin podem criar, votar e visualizar enquetes nesta fase.
- Enquetes em `ACTIVE` são encerradas automaticamente quando `NOW() >= deadline_at`.
- Voto não é secreto: os resultados retornam nomes dos votantes por opção.
- A alteração de voto é permitida enquanto a enquete está ativa.
- A alteração substitui integralmente o voto anterior do usuário.
- Para opção **Outro**, `other_text` é obrigatório quando a opção marcada é `is_other = true`.

## Comportamento de votação

- `YES_NO` cria automaticamente as opções `Sim` e `Não` (mais `Outro` opcional).
- `MULTIPLE_CHOICE` requer pelo menos 2 opções.
- Quando `allow_multiple_answers = false`, apenas 1 opção pode ser enviada.
- Quando `allow_multiple_answers = true`, múltiplas opções podem ser enviadas.

## Transparência

A resposta de detalhe e resultados expõe, por opção:
- total de votos
- lista nominal dos votantes
- valor textual em `other_text` quando aplicável
