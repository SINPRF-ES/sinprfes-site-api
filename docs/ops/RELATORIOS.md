# Módulo de Relatórios e Dossiês (SINPRF-ES)

Este módulo permite a geração de documentos estruturados em PDF com base nos dados do sistema, enviando-os automaticamente por e-mail.

## Endpoints da API

### 1. Gerar Relatório
`POST /api/reports/generate`

**Permissão:** `RELATORIOS_VER`

**Corpo da Requisição:**
```json
{
  "type": "INDIVIDUAL | LOTACAO | SITUACAO | GLOBAL",
  "params": {
    "filiadoId": 123, // Obrigatório se type for INDIVIDUAL. Contrato: { filiadoId }
    "value": "SEDE | ATIVO | ..." // Obrigatório se type for LOTACAO ou SITUACAO. Contrato: { value }
    // GLOBAL não exige parâmetros. Contrato: {}
  }
}
```

**Comportamento:**
- **Paginação Automática:** Tabelas longas (como a distribuição por lotação no relatório de Ativos ou Global) possuem suporte a paginação automática. Se uma tabela não couber em uma página, ela continuará na próxima, repetindo o cabeçalho para garantir a legibilidade.
- **Decisão de Layout Híbrido:**
    - **TABELAS:** Utilizadas exclusivamente para dados comparativos entre lotações (Lotação, Efetivo, Filiados, %, Base). Seguem larguras fixas (35%, 15%, 15%, 15%, 20%), texto centralizado em todas as células e sem quebras de linha automáticas.
    - **DOSSIÊ:** Utilizado para dados descritivos, agregados e resumos (Sexo, Faixa Etária, Observações). Segue o padrão visual limpo do dossiê individual (linhas de texto com labels em negrito).
- **Truncamento Robusto:** Em tabelas, qualquer texto que extrapole a largura da célula é truncado com reticências (...) para preservar a integridade das colunas.
- **Seleção de E-mail:** O sistema busca o melhor e-mail para o envio na seguinte ordem de precedência:
    1. E-mail no perfil/sessão do usuário logado.
    2. E-mail 1 cadastrado no cadastro do filiado vinculado ao ID do solicitante.
    3. E-mail 2 cadastrado no cadastro do filiado vinculado ao ID do solicitante.
    *   Se nenhum e-mail for encontrado, o PDF é enviado **apenas** para o sindicato com o prefixo `[SOLICITANTE SEM EMAIL]` no assunto.
- **Formatação de Datas:** Todas as datas no PDF (nascimento do filiado e nascimento dos dependentes) são exibidas no formato brasileiro `dd/MM/yyyy` (ex: 04/07/1987). Caso a data não esteja informada no banco, o PDF exibirá explicitamente `Não informada`.
- **Labels de Dependentes:** Os tipos de parentesco (vínculo) dos dependentes não são exibidos como códigos do banco (ex: `FILHO_ENTEADO`), mas com seus nomes humanizados (ex: "Filha(o) / Enteada(o)"). Valores desconhecidos são convertidos de snake_case para Title Case.
- **Integração com Repasse:** O Repasse é a **fonte da verdade** para os índices de sindicalização e efetivo total.
    - **Relatório por Lotação:** Exibe um bloco de "Resumo da Lotação" (layout dossiê) com: Efetivo total, Filiados cadastrados, Índice de sindicalização e a Competência (mês/ano) base.
    - **Relatório por Situação (ATIVO):** Exibe um resumo global do efetivo (layout dossiê) e uma tabela comparativa detalhada por lotação.
    - **Relatório Global:** Incorpora a visão do Repasse na seção de Ativos.
- **Nomenclatura de Arquivos (Filename):**
    *   Dossiês: `dossie_<nome-do-filiado-slug>.pdf` (ex: `dossie_joao_da_silva.pdf`). O slug remove acentos, caracteres especiais e substitui espaços por sublinhados.
    *   Relatórios Agregados: `relatorio_<tipo>_<valor>.pdf`.
    *   Relatório Global: `relatorio_global_<data>.pdf`.
- **Auditoria:** Toda solicitação bem-sucedida é registrada na tabela `report_jobs` com o ID e nome do solicitante, tipo de relatório e parâmetros utilizados.
- **Cópia Sindicato:** Uma cópia oculta (BCC) é sempre enviada para o e-mail configurado em `REPORTS_COPY_EMAIL`.

### 2. Visualizar na Tela (Preview)
`POST /api/reports/preview`

**Permissão:** `RELATORIOS_VER`

**Corpo da Requisição:** Mesmo do endpoint `generate`.

**Comportamento:**
- **Sem Histórico:** Este endpoint é apenas para consulta imediata. Ele **NÃO** gera PDF, **NÃO** envia e-mail e **NÃO** grava registro na tabela `report_jobs`.
- **JSON Estruturado:** Retorna os dados em um formato JSON pronto para renderização na interface (cards, tabelas e seções), permitindo uma conferência rápida antes de gerar o documento formal.
- **Paridade UI:** A visualização na tela busca reutilizar os mesmos padrões visuais do módulo de **Repasse**, garantindo consistência na apresentação de dados estatísticos.

### 3. Histórico de Relatórios
`GET /api/reports/history`

**Permissão:** `RELATORIOS_VER`

**Resposta:**
Retorna uma lista dos relatórios gerados. Perfis `ADMIN` visualizam o histórico global; outros perfis visualizam apenas o seu próprio histórico.
- **Retenção:** Registros são apagados automaticamente após **30 dias** (job diário).

## Aplicativo Mobile

### Busca de Filiados
O mecanismo de busca para o Dossiê Individual é unificado com o módulo de Filiados:
- **Accent-insensitive:** "fav" encontra "Fávero".
- **Busca por CPF:** Aceita CPF com ou sem máscara.
- **Busca Local:** Para performance e UX, a lista é carregada integralmente e filtrada no dispositivo.

### UX de Histórico
Para evitar poluição visual, o histórico no aplicativo segue o padrão do módulo de Notificações:
- Exibe apenas as 5 solicitações mais recentes.
- Botão "Exibir anteriores" revela o restante do histórico disponível (dentro da janela de retenção de 30 dias).


## Dimensão sindical nos indicadores

Para análise administrativa, os relatórios e prévias consideram também a classificação `situacao_sindical` como eixo separado da situação funcional:

- `FILIADO_SINPRF_ES`
- `FILIADO_OUTRO_SINDICATO`
- `NAO_FILIADO`
- `DESCONHECIDO`

Diretrizes:
- O detalhamento estatístico pode incluir não filiados e filiados de outro sindicato para leitura gerencial.
- Regras de acesso (login, assembleias, push coletivo) continuam restritas ao filiado efetivo (`FILIADO_SINPRF_ES`).
- Quando houver recorte de base sindical local, usar as fórmulas canônicas do `PARITY_CANON.md`.

## Configuração (Environment Variables)

- `REPORTS_COPY_EMAIL`: Endereço de e-mail do sindicato que receberá a cópia de todos os relatórios gerados (Padrão: `sinprfes@sinprfes.org.br`).

## Regras de Domínio (Idade)

- A idade é calculada em tempo de execução com base no campo `data_nascimento`.
- **Idade Desconhecida:** Registros sem data de nascimento cadastrada são contabilizados separadamente e exibidos como "desconhecida" nos relatórios agregados.
- **Faixas Etárias:**
    - **Ativos:** 20-29, 30-39, 40-49, 50-59, 60+ anos.
    - **Veteranos:** 50-59, 60-69, 70-79, 80+ anos.
    - **Pensionistas:** Não exibido (apenas distribuição por sexo).
