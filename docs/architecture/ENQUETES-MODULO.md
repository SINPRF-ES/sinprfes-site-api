# Módulo 🗨️ Enquetes

## Objetivo

O módulo **🗨️ Enquetes** permite que a diretoria do SINPRF-ES crie consultas internas com voto transparente, com paridade entre **site** e **app**.

## Estrutura de banco

### `polls`
- `id`
- `title`
- `type` (`YES_NO` ou `MULTIPLE_CHOICE`)
- `allow_multiple_answers`
- `allow_other_option`
- `deadline_at` (persistido como timestamp interno, operando em semântica de **data limite**)
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

> Todos os endpoints exigem autenticação. Criação/edição/publicação exigem `ENQUETES_GERENCIAR`; listagem, detalhe, voto e resultados ficam disponíveis para filiados autenticados.

## Regras de negócio (backend-first)

- Backend é a fonte única da verdade para criação, publicação, votação e resultados.
- Apenas diretoria/admin podem criar, editar e publicar enquetes.
- Filiados autenticados podem listar, visualizar resultados e votar em enquetes publicadas.
- **Data limite é somente data** (timezone canônico: `America/Sao_Paulo`).
- A enquete permanece ativa durante todo o dia da data limite e encerra no dia seguinte.
- Voto não é secreto: os resultados retornam nomes dos votantes por opção.
- A alteração de voto é permitida enquanto a enquete está ativa e substitui integralmente o voto anterior.
- Para opção **Outro**, `other_text` é obrigatório quando a opção marcada é `is_other = true`.

## Comportamento por tipo

- `YES_NO` cria automaticamente as opções `Sim` e `Não`.
- `YES_NO` é sempre resposta única (`allow_multiple_answers = false`), mesmo com payload inválido no frontend.
- `MULTIPLE_CHOICE` requer pelo menos 2 opções reais (não vazias).
- `MULTIPLE_CHOICE` pode habilitar múltiplas respostas por usuário.
- **Outro** é disponibilizado apenas para `MULTIPLE_CHOICE` para manter coerência funcional.

## UX aplicada

- Campo da pergunta ampliado (textarea) no formulário de criação/edição.
- Em múltipla escolha, o formulário já inicia com `Opção 1` e `Opção 2`, com adição dinâmica de novas opções.
- Controle “Permitir mais de uma resposta por usuário” só aparece para múltipla escolha.
- Paridade funcional entre site e app para filtros, criação, votação, alteração de voto e resultados transparentes.

## Transparência

A resposta de detalhe e resultados expõe, por opção:
- total de votos
- lista nominal dos votantes
- valor textual em `other_text` quando aplicável
