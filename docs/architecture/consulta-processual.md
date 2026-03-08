# Módulo Consulta Processual (Canon)

## Objetivo do módulo
A Consulta Processual permite consultar automaticamente processos públicos vinculados ao **CPF do usuário autenticado** ou ao **CNPJ institucional do sindicato**, integrando múltiplos tribunais (**TRF1, TRF3, TRF5, TRF6**) que utilizam o sistema PJe. O módulo opera sob arquitetura multi-provider e contrato único para Site + App.

## Regras de negócio consolidadas
1. O backend utiliza o CPF do usuário logado (**PERSONAL**) ou o CNPJ fixo do sindicato (**INSTITUTIONAL**).
2. Não existe entrada manual de documento (CPF/CNPJ) no frontend.
3. Acesso à consulta pessoal: perfis **ADMIN** e **DIRETORIA** (foco funcional).
4. Acesso à consulta institucional: restrito a **ADMIN** e **DIRETORIA**.
5. O backend consulta múltiplos providers externos em paralelo.
6. O backend realiza a **deduplicação de processos** pelo número CNJ.
7. O backend entrega payload **já normalizado**.
8. Site e App apenas renderizam dados; não reimplementam regra de negócio nem normalização.

## Fluxo funcional canônico
1. Usuário autenticado abre o módulo de Consulta Processual.
2. Cliente (Site/App) permite selecionar o modo (Pessoal ou Institucional, se permitido).
3. Cliente chama `GET /api/consulta-processual/me?mode=[personal|institutional]`.
4. Backend valida autenticação e permissão de acesso ao módulo/modo.
5. Backend recupera o documento necessário (CPF do usuário ou CNPJ do sindicato `39.387.378/0001-25`).
6. Service executa todos os providers habilitados (**TRF1, TRF3, TRF5, TRF6**) em paralelo.
7. Service consolida e deduplica itens em contrato canônico único.
8. Cliente renderiza estados e dados, identificando processos do sindicato com badge específico.

## Contrato da API (canônico)
Endpoint: `GET /api/consulta-processual/me`.
Parâmetro: `mode` (opcional, default `personal`).

Payload consolidado:

```json
{
  "ok": true,
  "queriedAt": "2026-03-08T00:00:00.000Z",
  "documentMasked": "***.123.***-45",
  "mode": "personal",
  "totalItems": 2,
  "items": [],
  "sources": [],
  "errors": []
}
```

Campos obrigatórios do contrato consolidado:
- `ok`
- `queriedAt`
- `documentMasked` (substitui o antigo `cpfMasked` para generalização)
- `mode`
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
- `institutional` (booleano indicando se é um processo do sindicato)

## Arquitetura de Providers (PJe Base)
O módulo utiliza uma classe base `PjeConsultaPublicaBaseProvider` que centraliza a lógica de automação para tribunais que utilizam o sistema PJe (RichFaces/JSF).
- **Providers Ativos**: TRF1, TRF3, TRF5, TRF6.
- **Estratégia**: Automação backend com Playwright e parser genérico (`pjeProcessParser`).
- **Extração**: Leitura de listagem pública e abertura opcional de `detailsUrl` para captura da movimentação mais recente.
- **Deduplicação**: Realizada no `consultaProcessual.service` após a coleta de todas as fontes, garantindo que o mesmo número CNJ não apareça duplicado no payload final.

## Regras de paridade (Site ↔ App)
Paridade obrigatória para o módulo:
1. Site e App devem consumir o **mesmo endpoint** (`/api/consulta-processual/me`).
2. Site e App devem oferecer a troca de modo (Pessoal vs Institucional) para usuários permitidos.
3. Site e App devem renderizar os **mesmos campos funcionais** e destacar processos institucionais com a label **SINDICATO**.
4. Mesma restrição de acesso.
5. Mesma semântica de estados e tratamento de erros.

## Segurança e privacidade
- Documentos nunca são informados manualmente pelo cliente.
- Documentos são mascarados em logs e respostas:
  - CPF: `***893157**` (6 dígitos centrais visíveis)
  - CNPJ: `***3780001**` (8 dígitos finais antes do dígito verificador)
- Acesso à consulta institucional é rigorosamente auditado no backend.

## Estrutura backend do módulo:
- `backend/src/modules/consulta-processual/controller`
- `backend/src/modules/consulta-processual/service`
- `backend/src/modules/consulta-processual/providers` (incluindo `PjeConsultaPublicaBaseProvider`)
- `backend/src/modules/consulta-processual/parsers` (incluindo `pjeProcessParser`)
- `backend/src/modules/consulta-processual/dto`
- `backend/src/modules/consulta-processual/validators`
- `backend/src/modules/consulta-processual/utils` (segurança e config)
