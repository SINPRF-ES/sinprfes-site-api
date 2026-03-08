# Módulo Consulta Processual (Canon)

## Objetivo do módulo
A Consulta Processual permite consultar automaticamente processos públicos vinculados ao **CPF do usuário autenticado**, usando inicialmente o provider público do **TRF1**, sem digitação manual de CPF no frontend. O módulo nasce sob arquitetura multi-provider e contrato único para Site + App.

## Regras de negócio consolidadas
1. O backend usa exclusivamente o CPF do usuário logado.
2. Não existe entrada manual de CPF nesta fase.
3. Acesso inicial restrito a perfis **ADMIN** e **DIRETORIA** (com foco funcional em DIRETORIA).
4. O backend consulta o provider externo.
5. O backend entrega payload **já normalizado**.
6. Site e App apenas renderizam dados; não reimplementam regra de negócio nem normalização.

## Fluxo funcional canônico
1. Usuário autenticado abre o módulo de Consulta Processual.
2. Cliente (Site/App) chama `GET /api/consulta-processual/me`.
3. Backend valida autenticação e permissão de acesso ao módulo.
4. Backend recupera CPF do usuário logado na base `filiados`.
5. Service executa providers habilitados (inicialmente TRF1).
6. Service consolida itens em contrato canônico único.
7. Cliente renderiza estados e dados sem parsing alternativo.

## Contrato da API (canônico)
Endpoint: `GET /api/consulta-processual/me`.

Payload consolidado:

```json
{
  "ok": true,
  "queriedAt": "2026-03-08T00:00:00.000Z",
  "cpfMasked": "***.123.***-45",
  "totalItems": 2,
  "items": [],
  "sources": [],
  "errors": []
}
```

Campos obrigatórios do contrato consolidado:
- `ok`
- `queriedAt`
- `cpfMasked`
- `totalItems`
- `items`
- `sources`
- `errors`

## Estrutura do item canônico (`items[]`)
Cada item normalizado deve preservar os campos abaixo:
- `source`
- `sourceLabel`
- `processNumber`
- `processClass`
- `processTitle`
- `parties`
- `listLastMovementText`
- `listLastMovementAt`
- `lastMovement`
- `lastMovementAt`
- `rawLastMovementText`
- `detailsUrl`
- `providerMeta`

## Provider TRF1 (estado atual)
- URL consultada: `https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam`
- Estratégia: automação backend com Playwright e parser dedicado.
- Extração da listagem: leitura dos blocos/tabela da consulta pública para número CNJ, classe, partes, movimentação visível em lista e link de detalhe.
- Extração de movimentação mais recente via detalhe: abertura de `detailsUrl` quando necessário para coletar texto bruto e data/hora de movimentação mais confiável.
- Limitações conhecidas:
  - Mudanças de HTML/selectors da origem podem exigir ajuste de parser/provider.
  - O provider depende de disponibilidade do portal externo.
  - Cache atual em memória por processo Node (não distribuído).

## Regras de paridade (Site ↔ App)
Paridade obrigatória para o módulo:
1. Site e App devem consumir o **mesmo endpoint** (`/api/consulta-processual/me`).
2. Site e App devem renderizar os **mesmos campos funcionais**:
   - Origem
   - Número do processo
   - Classe
   - Partes
   - Última movimentação
   - Data/Hora
   - Ação para abrir origem (quando `detailsUrl` existir)
3. Mesma ordem lógica das informações.
4. Mesma restrição de acesso (apenas ADMIN/DIRETORIA).
5. Mesma semântica de estados: inicial, loading, sucesso com resultados, sucesso sem resultados e erro.

## Segurança e privacidade
- CPF nunca é informado manualmente pelo cliente.
- CPF é sanitizado/validado no backend.
- Logs e resposta pública usam CPF mascarado (`cpfMasked`).
- Cliente não deve inferir ou reconstruir CPF real.

## Preparação para expansão futura
A arquitetura é multi-provider. Novos tribunais devem entrar por provider dedicado, **sem quebrar o contrato canônico** de `items/sources/errors` consumido por Site e App.

Estrutura backend do módulo:
- `backend/src/modules/consulta-processual/controller`
- `backend/src/modules/consulta-processual/service`
- `backend/src/modules/consulta-processual/providers`
- `backend/src/modules/consulta-processual/parsers`
- `backend/src/modules/consulta-processual/dto`
- `backend/src/modules/consulta-processual/validators`
- `backend/src/modules/consulta-processual/utils`
