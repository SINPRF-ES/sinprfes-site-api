# Matriz de Paridade Mobile vs Site (Produção 2.0)

Este documento mapeia o estado atual do aplicativo mobile em relação às verdades canônicas do Backend e a referência funcional do Site.

## 1. Verdades Canônicas (Backend & Site)

### 1.1 Perfis de Acesso
- **FILIADO:** Acesso restrito aos próprios dados. Na listagem geral, não deve ver arquivados nem CPF/Data de Nascimento de outros.
- **GESTÃO (ADMIN, DIRETORIA, FUNCIONARIO):** Acesso total. Pode listar ativos/arquivados, editar terceiros e gerenciar dependentes.

### 1.2 Situação Funcional
- Valores: `ATIVO`, `VETERANO`, `PENSIONISTA`.
- UI: Badges coloridos sem prefixos como "[OK] " ou "OK ".

### 1.3 Parentesco (Dependentes)
- Valores: `FILHO_ENTEADO`, `CONJUGE_COMPANHEIRO`, `PAI_MAE`, `IRMAO`, `OUTRO`.
- UI: Selector deve iniciar com "Selecione...". "Outro" abre campo de texto manual.

### 1.4 Compactação de Dependentes
- O Backend sempre compacta os slots `dep1..dep5` da esquerda para a direita. O Mobile deve enviar os 5 slots preenchidos conforme a UI.

## 2. Gaps Identificados e Prioridades

| Módulo | Funcionalidade | Estado | Prioridade |
| :--- | :--- | :--- | :--- |
| **Auth/API** | Tratamento de 502/HTML (Proxy) | Pendente | Alta |
| **Filiados** | Filtro Role-based (FILIADO vs Gestão) | Parcial | Alta |
| **Filiados** | Busca Normalizada (Acentos) | Pendente | Média |
| **Filiados** | Idade Detalhada em tempo real | Parcial | Média |
| **Filiados** | Excluir Dependentes (Gestão) | Pendente | Alta |
| **Filiados** | Detalhes de Arquivamento (Motivo/Quem) | Pendente | Média |
| **Publicações** | Salvar/Compartilhar PDF | Pendente | Média |
| **Ressarcimento** | Implementação Completa (Paridade Site) | Ausente | Alta |
| **Jogos 2026** | Inscrição + Planilha Gestão | Ausente | Média |

## 3. Regras de Interface (Visual Parity)
- **Meus Dados / Edição:**
    - Títulos centralizados com emojis (👤, 📞, 🏠, 👶).
    - Alternância de fundos (#ffffff e #f7f9fc) entre seções.
    - Botões de ação ("Salvar", "Arquivar") fixos no topo (Sticky Header).
    - Grid de endereço em 3 linhas (CEP+Logr, Num+Comp, Cid+UF).
