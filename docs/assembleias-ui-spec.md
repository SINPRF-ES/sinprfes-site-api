# UI Spec - Módulo Assembleias

## Objetivo
Uniformizar a experiência do usuário entre o Site (Web) e o App (Mobile) no módulo de Assembleias.

## 1. Lista de Assembleias
- **Card de Assembleia:**
  - **Título:** Deve exibir o Emoji de status + Tipo (AGE/AGO) + Título.
  - **Badge de Status:** Exibir no topo do card (ou alinhado à direita no mobile) com cores padronizadas:
    - `EM_CURSO`: Amarelo (Atenção)
    - `ABERTA`: Verde (Sucesso)
    - `CRIADA`: Azul (Info)
    - `ENCERRADA`: Vermelho/Cinza (Inativo)
  - **Informações Principais:**
    - 📅 Data: `data_evento` formatada (DD/MM/AAAA).
    - 🕒 Horário: `hora_primeira_chamada`.
  - **Ação Principal:** Botão "Ver Detalhes e Participar".

## 2. Detalhes da Assembleia
- **Hierarquia Visual:**
  - Botão "Voltar".
  - Cabeçalho com Badge de Status, Título e Tipo.
  - Bloco de Pauta: "📌 Pauta da Assembleia" (white-space: pre-wrap).
  - Linha de Informações: Data do Evento e Horário das Chamadas (1ª e 2ª).
- **Seções (Cards/Box):**
  - **📄 Edital de Convocação:** Botão para visualizar ou baixar o edital.
  - **👥 Quórum Atual:** Exibir total de presentes e permitir visualizar lista nominal. No site, usa-se um `<details>`, no mobile uma seção dedicada.
- **Blocos Especiais:**
  - **🔑 Token de Presença Vigente:** Visível apenas para quem tem autoridade (Diretoria/Presidente) ou gerador do token. Estilo destacado (fundo amarelo, borda tracejada).
  - **⚡ Ações da Mesa:** Visível para Diretoria/Presidente. Contém botões para:
    - Abrir Assembleia (se CRIADA).
    - Compor/Substituir Mesa (se ABERTA/EM_CURSO).
    - Gerar Token / Recontagem.
    - Iniciar Execução.
    - Encerrar Assembleia.
    - **Relatório PDF:** Visível para todos os perfis EXCETO `COMUNICADOR`, somente quando a assembleia estiver `ENCERRADA`.

## 3. Padrões de Feedback
- **Loading:** Spinner centralizado com cor institucional `#003366`.
- **Sucesso:** Alertas claros ou transição imediata de estado.
- **Erro:** Mensagem descritiva e botão de "Tentar Novamente".

## 4. Regras de Visibilidade (Relatório PDF)
- **Permitidos:** `ADMIN`, `DIRETORIA`, `FUNCIONARIO`, `ORGANIZADOR`, `FILIADO`.
- **Bloqueado:** `COMUNICADOR`.
- **Condição:** Assembleia no estado `ENCERRADA`. (Durante `EM_CURSO`, apenas `DIRETORIA` pode gerar relatórios parciais, conforme regra de negócio existente).
