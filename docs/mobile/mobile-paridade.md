# Matriz de Paridade Mobile vs Site (Produção 2.0)

Este documento mapeia o estado atual do aplicativo mobile em relação às verdades canônicas do Backend e a referência funcional do Site.

## 1. Verdades Canônicas (Backend & Site)

### 1.1 Perfis de Acesso
- **FILIADO:** Acesso restrito aos próprios dados. Na listagem geral, não deve ver arquivados nem CPF/Data de Nascimento de outros.
- **GESTÃO (ADMIN, DIRETORIA, FUNCIONARIO):** Acesso total. Pode listar ativos/arquivados, editar terceiros e gerenciar dependentes.
- **ORGANIZADOR:** Perfil legado mantido por compatibilidade histórica/RBAC; não há módulo ativo de Jogos no app.

### 1.2 Situação Funcional
- Valores: `ATIVO`, `VETERANO`, `PENSIONISTA`.
- UI: Badges coloridos sem prefixos como "[OK] " ou "OK ".

### 1.3 Parentesco (Dependentes)
- Valores: `FILHO_ENTEADO`, `CONJUGE_COMPANHEIRO`, `PAI_MAE`, `IRMAO`, `OUTRO`.
- UI: Selector deve iniciar com "Selecione...". "Outro" abre campo de texto manual.

### 1.4 Compactação de Dependentes
- O Backend sempre compacta os slots `dep1..dep5` da esquerda para a direita. O Mobile deve enviar os 5 slots preenchidos conforme a UI.

## 2. Status de Implementação e Paridade

| Módulo | Funcionalidade | Estado | Observação |
| :--- | :--- | :--- | :--- |
| **Auth/API** | Tratamento de 502/HTML (Proxy) | ✅ Concluído | Mensagem amigável + Log de preview. |
| **Auth/API** | Biometria & Auto-lock (1 min) | ✅ Concluído | Segurança de dados sensíveis. |
| **Filiados** | Filtro Role-based | ✅ Concluído | FILIADO não vê CPF/Arquivados. |
| **Filiados** | Busca Normalizada (Acentos) | ✅ Concluído | `normalizeText` (João == Joao). |
| **Filiados** | Máscara de CPF "Live" | ✅ Concluído | Formatação em tempo real preservando cursor. |
| **Filiados** | Idade Detalhada | ✅ Concluído | Cálculo 'Y anos, M meses e D dias'. |
| **Filiados** | Excluir Dependentes (Gestão) | ✅ Concluído | Checkbox de confirmação + fluxo do site. |
| **Filiados** | Arquivamento | ✅ Concluído | Exibe Motivo, Data e Autor (Red block). |
| **Publicações** | UX Sem Datas + Sort Alfa | ✅ Concluído | Espelha comportamento do site. |
| **Publicações** | Share Native PDF | ✅ Concluído | Integrado com `react-native-pdf`. |
| **Ressarcimento** | Paridade Completa | ✅ Concluído | Suporte multi-anexo (PDF/IMG). |
| **🗨️ Enquetes** | Listagem + votação + resultados para filiados; criação para gestão | ✅ Concluído | Data limite por dia, opções dinâmicas (mín. 2), regra única para site/app. |

> **Nota (Maio/2026):** o módulo **Jogos 2026** foi descontinuado do app (rotas/telas/banners/serviços/offline).

## 3. Regras de Interface (Visual Parity)
- **Meus Dados / Edição:**
    - Títulos centralizados com emojis (👤, 📞, 🏠, 👶).
    - Alternância de fundos (#ffffff e #f7f9fc) entre seções.
    - Botões de ação ("Salvar", "Arquivar") fixos no topo (Sticky Header).
    - Grid de endereço em 3 linhas (CEP+Logr, Num+Comp, Cid+UF).
    - Cartões com borda lateral colorida baseada no status funcional.
