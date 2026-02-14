# Regras de Negócio - Módulo Assembleia

Este documento descreve as regras de negócio e fluxos implementados para o funcionamento das assembleias no ecossistema FENAPRF.

## 1. Ciclo de Vida da Assembleia (Estados)

1.  **CRIADO**: Registro inicial. Exige anexo de Edital em PDF (via Biblioteca Digital/Google Drive).
2.  **EM_CREDENCIAMENTO**: Sala aberta para entrada de membros. Ocorre após a geração do **QR Code Global**.
3.  **INICIADO**: Mesa Diretora definida e pauta em execução. Permite criação de propostas e início de votações.
4.  **SUSPENSA**: Pausa temporária com motivo justificado e previsão de retorno.
5.  **ENCERRADO**: Finalização definitiva. Encerra automaticamente qualquer votação ativa (computando abstenção para quem não votou) e libera a geração de relatórios PDF.

## 2. Check-in, Credenciamento e Quórum

### 2.1. Credenciamento (Check-in Global)
- **Finalidade**: Registrar a presença do membro no evento como um todo.
- **Token**: 10 caracteres alfanuméricos.
- **Geração**: A primeira geração deve ser feita por: Presidente da FENAPRF, Vice-Presidente da FENAPRF, Diretor de Secretaria ou Diretor de Secretaria Substituto.
- **Idempotência**: Uma vez gerado, qualquer perfil de gestão pode visualizar o token para auxiliar os membros.
- **Persistência**: O check-in global é permanente para o evento. Tentativas duplicadas são bloqueadas.

### 2.2. Quórum Dinâmico (Snapshots)
- **Finalidade**: Definir o conjunto de membros aptos a votar em um item específico.
- **Token**: 6 dígitos numéricos.
- **Geração**: Restrita aos membros da Mesa Diretora (Presidente, Vice, Secretários).
- **Reset**: A geração de um novo token de quórum encerra o snapshot anterior e exige novo check-in de todos os participantes (incluindo a mesa).
- **Auto Check-in**: O emissor do token tem seu check-in realizado automaticamente se for elegível (CONSELHEIRO ou DIRETORIA).

## 3. Hierarquia e Substituição (UF × Branch)

O sistema garante que cada branch de uma UF tenha apenas um voto ativo por vez.

### 3.1. Regras de Hierarquia
- **Branch Conselheiros**: Presidente > Vice-Presidente.
- **Branch Delegação**: Delegado Representante > Suplente.

### 3.2. Fluxo de Substituição
- Se um **Superior** entrar no quórum enquanto um **Subordinado** está presente:
    - Se houver **votação ativa**, a substituição fica **PENDENTE** (tabela `assembleia_checkins_pendentes`) e é aplicada automaticamente ao encerrar o item.
    - Se NÃO houver votação ativa, a substituição é **IMEDIATA** (subordinado é removido).
- Se um **Subordinado** tentar entrar enquanto um **Superior** está presente, o acesso é **BLOQUEADO**.

## 4. Mesa Diretora

- **Composição**: 4 membros (Presidente, Vice, 1º Secretário e 2º Secretário).
- **Autoridade Funcional**: Durante a realização do evento, a autoridade deliberativa e de gestão pertence exclusivamente à Mesa Diretora, independentemente do perfil de acesso regular do usuário no sistema.
- **Autoridade para Definição**: Apenas Presidente da FENAPRF, Vice-Presidente da FENAPRF ou ADMIN.
- **Requisito**: Todos os indicados devem ter realizado o **Check-in Global**.
- **Rejeições**: Membros rejeitados para um cargo específico em votação de mesa não podem ser indicados novamente para o mesmo cargo no mesmo evento.

## 5. Deliberação e Votação

### 5.1. Propostas
- Membros presentes no quórum podem enviar propostas.
- **Regra de Autor Ausente**: Se a votação de uma proposta for iniciada e o autor não estiver presente no quórum atual, a proposta é retirada de pauta automaticamente.
- **Branch Confirmation**: Se um titular (rank 1) entrar e encontrar uma proposta ativa enviada por seu subordinado enquanto o titular estava ausente, ele deve confirmar (MANTER) ou CANCELAR a proposta.

### 5.2. Itens de Votação
- **Duração Padrão**: 2 minutos (120 segundos).
- **Auto-Encerramento**: Se 100% dos membros presentes no quórum votarem antes do tempo, a votação encerra imediatamente.
- **Omissão**: Membros que não votarem até o encerramento têm seu voto computado automaticamente como **ABSTENCAO**.

## 6. Scanner QR
- Formato de payload esperado: JSON `{ "type": "GLOBAL" | "QUORUM", "assembleiaId": "UUID", "token": "..." }`.
- Integrado via `expo-camera`.

## 7. Auditoria
- Todas as ações críticas (mudança de estado, geração de token, check-in, voto, definição de mesa) são registradas na tabela `assembleia_auditoria` (Append-Only).
