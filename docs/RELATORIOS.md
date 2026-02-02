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
- **Seleção de E-mail:** O sistema busca o melhor e-mail para o envio na seguinte ordem de precedência:
    1. E-mail no perfil/sessão do usuário logado.
    2. E-mail 1 cadastrado no cadastro do filiado vinculado ao ID do solicitante.
    3. E-mail 2 cadastrado no cadastro do filiado vinculado ao ID do solicitante.
    *   Se nenhum e-mail for encontrado, o PDF é enviado **apenas** para o sindicato com o prefixo `[SOLICITANTE SEM EMAIL]` no assunto.
- **Formatação de Datas:** Todas as datas no PDF (nascimento do filiado e nascimento dos dependentes) são exibidas no formato brasileiro `dd/MM/yyyy` (ex: 04/07/1987). Caso a data não esteja informada no banco, o PDF exibirá explicitamente `Não informada`.
- **Labels de Dependentes:** Os tipos de parentesco (vínculo) dos dependentes não são exibidos como códigos do banco (ex: `FILHO_ENTEADO`), mas com seus nomes humanizados (ex: "Filha(o) / Enteada(o)"). Valores desconhecidos são convertidos de snake_case para Title Case.
- **Integração com Repasse (Lotação):** O relatório por lotação consome dados diretamente do módulo de Repasse.
    - O Repasse é a **fonte da verdade** para os índices de sindicalização.
    - O PDF exibe um bloco de "Resumo da Lotação" com: Efetivo total (Repasse), Filiados cadastrados, Índice de sindicalização e a Competência (mês/ano) base do dado de Repasse.
    - O sistema utiliza o dado mais recente disponível no Repasse para a lotação selecionada.
- **Nomenclatura de Arquivos (Filename):**
    *   Dossiês: `dossie_<nome-do-filiado-slug>.pdf` (ex: `dossie_joao_da_silva.pdf`). O slug remove acentos, caracteres especiais e substitui espaços por sublinhados.
    *   Relatórios Agregados: `relatorio_<tipo>_<valor>.pdf`.
- **Auditoria:** Toda solicitação bem-sucedida é registrada na tabela `report_jobs` com o ID e nome do solicitante, tipo de relatório e parâmetros utilizados.
- **Cópia Sindicato:** Uma cópia oculta (BCC) é sempre enviada para o e-mail configurado em `REPORTS_COPY_EMAIL`.

### 2. Histórico de Relatórios
`GET /api/reports/history`

**Permissão:** `RELATORIOS_VER`

**Resposta:**
Retorna uma lista dos últimos 50 relatórios gerados. Perfis `ADMIN` visualizam o histórico global; outros perfis visualizam apenas o seu próprio histórico.

## Configuração (Environment Variables)

- `REPORTS_COPY_EMAIL`: Endereço de e-mail do sindicato que receberá a cópia de todos os relatórios gerados (Padrão: `sinprfes@sinprfes.org.br`).

## Regras de Domínio (Idade)

- A idade é calculada em tempo de execução com base no campo `data_nascimento`.
- **Idade Desconhecida:** Registros sem data de nascimento cadastrada são contabilizados separadamente e exibidos como "desconhecida" nos relatórios agregados.
- **Faixas Etárias:** 20-29, 30-39, 40-49, 50-59, 60+ anos.
