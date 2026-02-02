# Módulo de Relatórios e Dossiês (SINPRF-ES)

Este módulo permite a geração de documentos estruturados em PDF com base nos dados do sistema, enviando-os automaticamente por e-mail.

## Endpoints da API

### 1. Gerar Relatório
`POST /api/reports/generate`

**Permissão:** `RELATORIOS_VER`

**Corpo da Requisição:**
```json
{
  "type": "INDIVIDUAL | LOTACAO | SITUACAO",
  "params": {
    "filiadoId": 123, // Obrigatório se type for INDIVIDUAL
    "value": "SEDE | ATIVO | ..." // Obrigatório se type for LOTACAO ou SITUACAO
  }
}
```

**Comportamento:**
- Valida os parâmetros conforme o tipo.
- Busca os dados no banco (agregações estatísticas ou dados do filiado).
- Gera o PDF usando o layout institucional.
- Registra o job na tabela `report_jobs`.
- Envia o PDF por e-mail para o usuário logado.
- Envia uma cópia oculta (BCC) para o e-mail configurado em `REPORTS_COPY_EMAIL`.

### 2. Histórico de Relatórios
`GET /api/reports/history`

**Permissão:** `RELATORIOS_VER`

**Resposta:**
Retorna uma lista dos últimos 50 relatórios gerados. Perfis `ADMIN` visualizam o histórico global; outros perfis visualizam apenas o seu próprio histórico.

## Configuração (Environment Variables)

- `REPORTS_COPY_EMAIL`: Endereço de e-mail do sindicato que receberá a cópia de todos os relatórios gerados (Padrão: `sinprfes@sinprfes.org.br`).

## Regras de Domínio (Idade)

- A idade é calculada em tempo de execução com base no campo `data_nascimento`.
- **Idade Desconhecida:** Registros sem data de nascimento cadastrada são contabilizados separadamente e exibidos como "desconhecida", garantindo que nenhum filiado seja excluído das estatísticas.
- **Faixas Etárias:**
  - 20-29 anos
  - 30-39 anos
  - 40-49 anos
  - 50-59 anos
  - 60+ anos
