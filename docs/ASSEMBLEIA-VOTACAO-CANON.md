# Assembleias e Votações - CANON

Este documento define o padrão arquitetural, as regras de negócio e o fluxo normativo para o módulo de Assembleias e Votações. Ele é a fonte única de verdade (SSoT) para implementação no Backend, Mobile e Web.

## 1. Princípios e Regras Gerais

### 1.1. Hierarquia de Verdade
1.  **Backend (Regra Absoluta):** Fonte única para regras de elegibilidade, auditoria, persistência e controle de tempo.
2.  **App Mobile (Interface Primária):** Canal obrigatório para interação em tempo real (check-in, votação, pedidos de palavra).
3.  **Site (Consulta e Relatórios):** Espelhamento do estado e acesso a relatórios gerados.

### 1.2. Premissas Críticas
- **Voto Nominal e Aberto:** Todo voto é público, associado ao filiado e visível em tempo real.
- **Auditoria Imutável:** Todo evento relevante gera um log `append-only`.
- **Elegibilidade por Snapshot:** O Backend congela a lista de votantes no momento exato do início de cada votação.
- **Abstenção:** O filiado elegível que não manifestar voto até o fim do tempo é registrado como ABSTENÇÃO.

---

## 2. Fluxo Funcional em 4 Fases

### Fase 1 — Criação do Evento

Esta fase compreende o agendamento e parametrização da assembleia.

1.  **Perfis Autorizados:** Qualquer perfil de gestão possui permissão para criar eventos.
2.  **Nomenclatura Obrigatória:** Os tipos de assembleia devem ser exibidos por extenso nos seletores:
    - "Assembleia Geral Ordinária"
    - "Assembleia Geral Extraordinária"
    - *Vedado o uso de siglas (AGO/AGE) na interface.*
3.  **Campos Obrigatórios:**
    - Título da Assembleia.
    - Pauta detalhada.
    - Data do evento.
    - Horário da 1ª chamada.
    - Horário da 2ª chamada.
    - Anexo do edital (PDF ou Imagem).
4.  **Metadados:** O sistema deve registrar e permitir a visualização da data e hora de criação do registro.
5.  **Visibilidade:** Após a criação, o evento torna-se visível para consulta por qualquer perfil de usuário.
6.  **Alteração e Cancelamento:**
    - Restrito a perfis de gestão.
    - O cancelamento exige obrigatoriamente uma justificativa motivada, que será registrada em log.
7.  **Regra Estatutária de Quórum:**
    - **1ª chamada:** Metade dos filiados ativos + 1.
    - **2ª chamada:** Qualquer número de presentes.

### Fase 2 — Abertura e Credenciamento (Pré-Execução)

Esta fase destina-se exclusivamente à constituição da assembleia e verificação de quórum, sem deliberação de pauta.

1.  **Início:** Um Diretor deve acionar o comando de abertura da assembleia.
2.  **Token de Presença:**
    - O sistema libera a geração de um token de check-in (6 dígitos).
    - O diretor que gera o token tem seu check-in realizado automaticamente.
    - O token não expira por tempo; expira apenas quando um novo token é gerado ou a assembleia é encerrada.
3.  **Contagem de Quórum:**
    - Consideram-se apenas filiados com cadastro **ATIVO**.
    - **Perfis incluídos:** DIRETORIA, FILIADO, ORGANIZADOR.
    - **Perfis excluídos:** ADMIN, COMUNICADOR (não contam para quórum nem votam).
4.  **Exibição em Tempo Real:** O painel de gestão e a visualização dos usuários devem exibir:
    - Total de filiados considerados para o cálculo.
    - Quórum necessário (conforme regra da chamada vigente).
    - Número de presentes confirmados (check-in).
    - Status visual: "Quórum atingido" ou "Quórum não atingido".
5.  **Regra de Chamada Automática:** Após o horário estipulado para a 1ª chamada, o sistema deve aplicar automaticamente a regra de 2ª chamada.
6.  **Composição da Mesa:**
    - Antes de iniciar as deliberações, um Diretor deve selecionar, entre os presentes, o **Presidente da Mesa** e o **Secretário da Mesa**.
    - Autoindicação é permitida.
    - **Bloqueio:** A Fase 3 (Execução) não pode ser iniciada sem que a mesa esteja definida.

### Fase 3 — Execução da Assembleia (Debates e Votações)

Fase dedicada à discussão da pauta e deliberações.

1.  **Interações de Debate:**
    - Todos os presentes com check-in válido podem pedir a palavra e propor encaminhamentos/propostas.
    - A Pauta, a fila de oradores e os encaminhamentos devem estar permanentemente visíveis.
2.  **Recontagem de Presença (Atualizar Quórum):**
    - Comando exclusivo do **Presidente da Mesa**.
    - Ao acionar, todos os check-ins anteriores são invalidados.
    - Um novo token é gerado e todos os presentes devem realizar novo check-in.
    - O Presidente tem seu check-in renovado automaticamente.
    - A última recontagem define o quórum vigente para as votações subsequentes.
3.  **Processo de Votação:**
    - Apenas o **Presidente da Mesa** inicia votações.
    - **Duração:** Deve-se definir um tempo entre 1 e 5 minutos.
    - **Snapshot de Elegibilidade:** No exato momento do início, o backend captura a lista de filiados com check-in válido. Apenas estes são elegíveis para votar neste item.
    - **Votos:** Devem ser nominais e exibidos em tempo real (Nome + Voto).
    - **Alterabilidade:** O votante pode alterar seu voto enquanto o cronômetro estiver ativo.
    - **Novas Entradas:** Filiados que realizarem check-in após o snapshot de uma votação em curso não podem votar nela, mas estarão aptos para a próxima.

### Fase 4 — Encerramento e Relatório

Fase de finalização e consolidação documental.

1.  **Bloqueio de Interação:** Ao encerrar a assembleia, toda e qualquer interação (voto, palavra, proposta) é permanentemente bloqueada.
2.  **Modo de Consulta:** O evento passa ao estado `ENCERRADA` e permanece disponível apenas para consulta.
3.  **Relatório de Assembleia:**
    - Gerado sob demanda em formato PDF através do botão "Gerar Relatório".
    - O relatório não é armazenado no servidor; é enviado por e-mail ao solicitante.
    - **Conteúdo Obrigatório:**
        - Horários de abertura e encerramento.
        - Lista nominal de presentes (quórum final).
        - Itens votados com respectivos resultados detalhados.
4.  **Segurança e Rastreabilidade:**
    - Watermark com logo do sindicato.
    - Código de autenticação único ou QR Code para validação de integridade.
    - Identificação: "Relatório gerado por [Nome do Usuário]".

---

## 3. Estados da Sessão (Máquina de Estados)

- `CRIADA`: Agendada, aguardando início.
- `ABERTA`: Em fase de credenciamento (Fase 2).
- `EM_CURSO`: Fase de debates e votações (Fase 3).
- `ENCERRADA`: Finalizada, somente consulta (Fase 4).

---
> "Este documento é a especificação normativa. Qualquer divergência no código em relação a estas regras é considerada um erro de implementação."
