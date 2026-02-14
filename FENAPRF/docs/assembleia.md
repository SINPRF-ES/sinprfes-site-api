# Regras de Negócio - Módulo Assembleia

Este documento descreve as regras de negócio obrigatórias para o funcionamento das assembleias no ecossistema FENAPRF.

## 1. Check-in, Credenciamento e Quórum

### 1.1. Credenciamento (Check-in Global de Presença)
O credenciamento é o registro inicial e obrigatório de presença para o evento como um todo.
- **Finalidade:** Validar a presença do conselheiro no evento (assembleia) e habilitar sua participação nas sessões.
- **Token e QR Code:** O token de credenciamento é **único por assembleia** (evento). Ele deve ser gerado uma única vez e persistido. O app mobile permite a leitura deste QR Code para check-in automático.
- **Geração:** Somente os seguintes 4 perfis (cargos específicos) estão autorizados a realizar a primeira geração do token:
    - Presidente da FENAPRF
    - Vice-Presidente da FENAPRF
    - Diretor de Secretaria
    - Diretor de Secretaria Substituto
- **Visualização:** Após a geração, qualquer perfil de gestão (ADMIN, DIRETORIA, COLABORADOR) pode resgatar e visualizar o token/QR Code para auxiliar no credenciamento dos conselheiros.
- **Persistência:** O registro de credenciamento do conselheiro é **único por evento**. Se o usuário já se credenciou, qualquer nova tentativa (mesmo em dias diferentes de um evento multi-dia) deve retornar a mensagem: *"Você já efetuou seu credenciamento para este evento."*
- **Perfis Permitidos para Credenciamento por UF (4 papéis):**
    - Presidente do Sindicato
    - Vice-Presidente do Sindicato
    - Delegado Representante
    - Suplente do Delegado

### 1.2. Check-in de Quórum (Dinâmico)
O quórum é a verificação de presença ativa para momentos específicos de votação durante a assembleia.
- **Finalidade:** Definir o snapshot de membros aptos a votar em um determinado item de pauta ou proposta.
- **Token e QR Code:** O token de quórum deve ser composto por **apenas 6 números**. O app mobile permite a leitura rápida via scanner QR.
- **Geração:** Apenas os **4 componentes da mesa diretora** (Presidente, Vice-Presidente, 1º Secretário e 2º Secretário) podem gerar o token de quórum.
- **Rotatividade e Reset:** O token de quórum pode ser gerado quantas vezes forem necessárias. Ao gerar um **novo token**, o sistema deve:
    - Resetar todo o quórum vigente (remover a presença de todos os participantes).
    - Manter apenas a presença de quem gerou o token.
    - Inclusive os demais membros da mesa precisam realizar um novo check-in para este quórum.
- **Filtragem Hierárquica por UF (Substituição Automática):**
    - Se o **Presidente da UF** realizar o check-in, o **Vice-Presidente da UF** não pode permanecer no quórum (é removido automaticamente se já estiver).
    - Se o Vice realizar o check-in primeiro e posteriormente o Presidente entrar, o Vice é removido e recebe uma mensagem explicativa.
    - A mesma regra se aplica para a relação entre **Delegado Representante** vs **Suplente do Delegado**.

### 1.3. Diferenças entre Credenciamento e Quórum
| Característica | Credenciamento (Global) | Quórum (Dinâmico) |
| :--- | :--- | :--- |
| **Objetivo** | Presença geral no evento | Aptidão para votação imediata |
| **Persistência** | Permanente para o evento | Temporário (até novo snapshot) |
| **Reset** | Não reseta | Reseta a cada nova geração de token |
| **Tamanho Token** | 10 caracteres (Alfanumérico) | 6 dígitos (Numérico) |
| **Permissão Geração** | 4 cargos FENAPRF específicos | 4 membros da mesa diretora |
| **Frequência** | Gerado 1 única vez | Gerado múltiplas vezes |


## 2. Direitos de Voto e Hierarquia
- **Votos por UF:** Cada Unidade Federativa (UF) possui o direito a 2 votos deliberativos.
- **Distribuição por Branch:** Os 2 votos são divididos entre os dois branches (Conselheiros e Delegação), sendo 1 voto para cada branch.
- **Hierarquia de Substituição:** Dentro de cada branch, existe uma hierarquia (Ex: Presidente > Vice-Presidente no branch Conselheiros).
    - Se o titular estiver presente, ele detém o voto.
    - Se o titular estiver ausente, o substituto imediato assume o direito de voto.
    - Caso o titular entre na sessão após o substituto ter realizado uma ação (como uma proposta), o titular deve confirmar ou cancelar tal ação (Lógica de Branch Confirmation).

## 3. Dinâmica das Sessões
- **Abertura e Mesa Diretora:** A sessão inicia com a indicação da Mesa Diretora composta por 4 membros (Presidente, Vice-Presidente, 1º Secretário e 2º Secretário).
    - Membros rejeitados em uma votação para um cargo específico podem ser indicados para outros cargos e votados novamente.
- **Pedir Palavra:** Sistema de fila para oradores, controlado pela Mesa Diretora.
- **Encaminhamento de Propostas:** Membros podem encaminhar propostas para votação (SIM ou NÃO).
- **Justificativa de Ausência:** Membros ausentes devem ter a possibilidade de justificar sua ausência no sistema.

## 4. Votação de Itens
- **Duração:** Cada item de pauta lançado para votação tem uma duração padrão de 2 minutos.
- **Alteração de Voto:** Enquanto a votação estiver aberta, o membro pode alterar seu voto.
- **Encerramento Antecipado:** Se todos os membros aptos (conforme o quórum) realizarem o voto antes do tempo expirar, a votação é encerrada automaticamente.
- **Regra de Omissão (Não Votar = SIM):** Caso um membro presente no quórum não registre seu voto manualmente até o encerramento da votação, o sistema deve computar seu voto automaticamente como **SIM**.

## 5. Relatórios
- **Disponibilidade:** O relatório consolidado (PDF) só fica disponível para solicitação após o estado da assembleia ser alterado para **ENCERRADO**.
- **Restrição:** Tentativas de gerar relatórios em outros estados (EM_CREDENCIAMENTO, INICIADO, SUSPENSA) serão bloqueadas pelo backend (403 Forbidden).

## 6. Scanner QR
- **Uso:** Conselheiros e Diretores podem utilizar o scanner integrado no app mobile para realizar o check-in de credenciamento ou quórum.
- **Payload:** O QR Code deve conter um JSON com `type` (GLOBAL ou QUORUM), `assembleiaId` e `token`.
- **Restrição de Perfil:** Perfis ADMIN e COLABORADOR não possuem acesso à funcionalidade de check-in via token/QR.

## 7. Auditoria
- Todas as ações (check-ins, votos, mudanças de estado, composições de mesa) devem ser registradas em logs imutáveis de auditoria.
