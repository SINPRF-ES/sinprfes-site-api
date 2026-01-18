# Mobile - SINPRF-ES

Aplicativo mobile desenvolvido com Expo e React Native.

## Convenções de Dados

### Situação Funcional vs Status do Cadastro

No sistema, existem dois conceitos distintos:

1.  **Situação Funcional**: Refere-se à condição de trabalho do servidor.
    *   Valores canônicos: `ATIVO`, `VETERANO`, `PENSIONISTA`.
    *   **Normalização**: O aplicativo utiliza a função `normalizeSituacaoFuncional` para tratar variações (ex: "Veteranos", "veterano", "ATIVOS") garantindo que o dado seja sempre comparado e exibido de forma consistente em caixa alta e no singular.
2.  **Status do Cadastro**: Refere-se ao estado do registro no banco de dados.
    *   Valores: `ATIVO` (ou `CADASTRO_ATIVO`) e `ARQUIVADO`.

### Regras de Edição (Admin)

*   **Data de Nascimento**: Editável por administradores. O app faz a conversão de `DD/MM/AAAA` para `ISO (YYYY-MM-DD)` antes de enviar ao servidor.
*   **Lotação e Perfil**: Campos administrativos que só podem ser alterados por usuários com permissão elevada.

## Depuração e Logs

O aplicativo possui instrumentação de logs para facilitar a depuração em ambiente de desenvolvimento (`__DEV__`).

*   **Publicações**: Logs detalhados em `PublicacoesScreen.tsx` cobrindo:
    *   Carregamento da lista (metadados).
    *   Clique em itens (IDs e URLs).
    *   Fluxo de abertura de arquivos (PdfViewer vs Download).
    *   Erros de resposta da API (status e mensagens).

Para visualizar, utilize o console do Metro Bundler ou a tela de **Diagnóstico** (acessível apenas para perfil ADMIN).

## Convenções de Dados (Hotfix 2024)

### Situação Funcional vs Status do Cadastro

No sistema, existem dois conceitos distintos:

1.  **Situação Funcional**: Refere-se à condição de trabalho do servidor.
    *   Valores canônicos: `ATIVO`, `VETERANO`, `PENSIONISTA`.
    *   **Normalização**: O aplicativo utiliza a função `normalizeSituacaoFuncional` para tratar variações (ex: "Veteranos", "veterano", "ATIVOS") garantindo que o dado seja sempre comparado e exibido de forma consistente em caixa alta e no singular.
2.  **Status do Cadastro**: Refere-se ao estado do registro no banco de dados.
    *   Valores: `ATIVO` (ou `CADASTRO_ATIVO`) e `ARQUIVADO`.

### Regras de Edição (Admin)

*   **Data de Nascimento**: Editável por administradores. O app faz a conversão de `DD/MM/AAAA` para `ISO (YYYY-MM-DD)` antes de enviar ao servidor.
*   **Lotação e Perfil**: Campos administrativos que só podem ser alterados por usuários com permissão elevada.

## Depuração e Logs

O aplicativo possui instrumentação de logs para facilitar a depuração em ambiente de desenvolvimento (`__DEV__`).

*   **Publicações**: Logs detalhados em `PublicacoesScreen.tsx` cobrindo:
    *   Carregamento da lista (metadados).
    *   Clique em itens (IDs e URLs).
    *   Fluxo de abertura de arquivos (PdfViewer vs Download).
    *   Erros de resposta da API (status e mensagens).

Para visualizar, utilize o console do Metro Bundler ou a tela de **Diagnóstico** (acessível apenas para perfil ADMIN).
