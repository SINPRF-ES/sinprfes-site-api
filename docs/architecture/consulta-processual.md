# Módulo Consulta Processual (Canon)

## Objetivo do módulo
A Consulta Processual permite consultar automaticamente processos públicos vinculados ao **CPF do usuário autenticado** ou ao **CNPJ do Sindicato**, usando providers públicos de tribunais que utilizam o sistema PJe. O módulo possui arquitetura multi-provider e contrato único para Site + App.

## Regras de negócio consolidadas
1. O backend usa o CPF do usuário logado (modo `personal`) ou o CNPJ do Sindicato (modo `institutional`).
2. Não existe entrada manual de documento no frontend.
3. Acesso restrito a perfis **ADMIN** e **DIRETORIA**. O modo `institutional` é exclusivo para estes perfis.
4. O backend consulta múltiplos providers em paralelo (TRF1, TRF3, TRF5, TRF6).
5. Os resultados são deduplicados globalmente pelo número do processo (CNJ).
6. O backend entrega payload **já normalizado**.
7. Site e App apenas renderizam dados e permitem a seleção do modo de consulta.

## Fluxo funcional canônico
1. Usuário autenticado abre o módulo de Consulta Processual.
2. Cliente (Site/App) chama `GET /api/consulta-processual/me?mode=personal|institutional`.
3. Backend valida autenticação e permissão de acesso ao modo solicitado.
4. Backend recupera o documento necessário (CPF do usuário ou CNPJ institucional).
5. Service executa providers habilitados em paralelo.
6. Service consolida e deduplica itens em contrato canônico único.
7. Cliente renderiza estados e dados.

## Contrato da API (canônico)
Endpoint: `GET /api/consulta-processual/me`.
Parâmetros: `mode` (opcional, default: `personal`).

Payload consolidado:

```json
{
  "ok": true,
  "mode": "personal",
  "queriedAt": "2026-03-08T00:00:00.000Z",
  "documentMasked": "***.123.***-45",
  "totalItems": 2,
  "items": [],
  "sources": [],
  "errors": []
}
```

## Arquitetura de Providers (PJe)
O módulo utiliza uma classe base `PjeConsultaPublicaBaseProvider` que centraliza a lógica de automação com Playwright para tribunais que utilizam a interface JSF/RichFaces do PJe.

Providers atuais:
- **TRF1**: `https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam`
- **TRF3**: `https://pje1g.trf3.jus.br/pje/ConsultaPublica/listView.seam`
- **TRF5**: `https://pje.trf5.jus.br/pje/ConsultaPublica/listView.seam`
- **TRF6**: `https://pje.trf6.jus.br/pje/ConsultaPublica/listView.seam`

## Regras de paridade (Site ↔ App)
Paridade obrigatória para o módulo:
1. Site e App devem consumir o **mesmo endpoint**.
2. Site e App devem permitir a alternância entre "Meus processos" e "Sindicato".
3. Itens institucionais devem exibir um badge indicativo "SINDICATO".
4. Mesma semântica de estados e renderização de campos.

## Segurança e privacidade
- Documentos reais nunca são trafegados para o frontend; apenas versões mascaradas (`documentMasked`).
- Logs internos também utilizam versões mascaradas.
- O modo `institutional` possui trava de segurança no controller.
