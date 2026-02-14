# Regras de Negócio - Módulo Assembleia

Este documento descreve as regras de negócio e fluxos do módulo Assembleia no ecossistema FENAPRF, com base no backend como fonte primária da verdade.

## 1. Ciclo de Vida da Assembleia (Estados)

Os estados são armazenados em `assembleias.estado` e refletem o fluxo do rito deliberativo formal.

1. **CRIADO**: Registro inicial. Deve conter referência ao Edital (PDF) via Biblioteca Digital/Google Drive.  
2. **EM_CREDENCIAMENTO**: Credenciamento global aberto; token/QR global disponível.  
3. **INICIADO**: Mesa Diretora definida e pauta em execução. Permite propostas e votações.  
4. **SUSPENSA**: Pausa temporária com motivo justificado e previsão de retorno.  
5. **ENCERRADO**: Finalização definitiva. Bloqueia novas interações deliberativas e libera geração de relatórios.

> Observação: os nomes exatos e transições válidas devem refletir o backend (fonte de verdade). O portal/mobile exibem labels a partir desse estado.

---

## 2. Check-in, Credenciamento e Quórum

### 2.1 Credenciamento Global (Presença no evento)
- **Finalidade**: registrar presença do membro no evento (única por assembleia).
- **Token**: 10 caracteres alfanuméricos (e QR Code).
- **Geração (1ª vez)**: Presidente FENAPRF, Vice-presidente FENAPRF, Diretor de Secretaria, Diretor de Secretaria Substituto.
- **Idempotência**:
  - o token global é único e persistente enquanto a assembleia não estiver encerrada;
  - tentativas de regeneração devem retornar o token existente (não criar novo).
- **Uso**: qualquer perfil de gestão pode resgatar/visualizar o token/QR para credenciar conselheiros.
- **Regras de duplicidade**: se o membro já credenciou, nova tentativa retorna mensagem:  
  **"Você já efetuou seu credenciamento para este evento."**

> Nota técnica: no schema atual, `assembleia_checkins` está vinculado a `assembleia_quoruns`. Se o credenciamento global for implementado como um “quorum global” (`assembleia_quoruns.is_global = true`), isso deve estar explícito no backend. Caso o backend use estratégia diferente (ex.: tabela/registro próprio), este documento deve refletir a implementação real.

### 2.2 Quórum Dinâmico (Snapshots)
- **Finalidade**: definir o conjunto elegível para votar em um item.
- **Token**: 6 dígitos numéricos (e QR Code), para permitir digitação no portal web.
- **Geração**: restrita aos membros da Mesa Diretora (4 cargos).
- **Reset**:
  - ao gerar novo token de quórum, encerra-se o snapshot anterior e inicia-se novo ciclo;
  - o quórum passa a exigir novo check-in de todos (inclusive membros da mesa), mantendo apenas o gerador como “presente” se aplicável (conforme regra do backend).
- **Auto check-in do emissor**: se elegível, o emissor do token pode ter check-in automático (regra do backend).

### 2.3 Registro de Check-in (Implementação)
- Check-ins são registrados em `assembleia_checkins`, sempre vinculados a um `assembleia_quorum_id` (FK para `assembleia_quoruns`).
- Cada votação pode armazenar snapshot via `assembleia_votacoes.quorum_snapshot_id`.

---

## 3. Hierarquia e Substituição (UF × Branch)

Objetivo: garantir que cada “ramo” (ex.: Presidente/Vice, Delegado/Suplente) tenha apenas um representante ativo.

### 3.1 Regras de Hierarquia
- **Branch Conselheiros**: Presidente > Vice-presidente.
- **Branch Delegação**: Delegado Representante > Suplente.

### 3.2 Regra operacional
- Se um **Superior** entrar no quórum e houver um **Subordinado** ativo, ocorre substituição:
  - **Imediata**, removendo o subordinado e informando o motivo (padrão recomendado).
- Se um **Subordinado** tentar entrar com o superior já presente, o acesso é **bloqueado** com mensagem clara.

> Importante: não existe tabela de “pendências” no schema atual. Qualquer bloqueio/substituição deve ser aplicado pelo backend de forma determinística e auditável.

---

## 4. Mesa Diretora

- **Composição**: 4 membros (`assembleia_mesa`):
  - Presidente, Vice, 1º Secretário, 2º Secretário.
- **Autoridade funcional**: durante o evento, a gestão deliberativa (quórum/votação) pertence à Mesa Diretora definida.
- **Autoridade para definir mesa**: conforme regra institucional vigente e implementação do backend.  
  Recomendação canônica: **apenas Presidente/Vice da FENAPRF** (sem ADMIN no rito institucional).
- **Requisito**: indicados devem estar elegíveis conforme regras do backend.
- **Rejeições**: rejeições de cargos são registradas em `assembleia_mesa_rejeicoes`.

---

## 5. Deliberação e Votação

### 5.1 Propostas
- Propostas são registradas em `assembleia_propostas`.
- Regras como “autor ausente” e “confirmação por titular” devem refletir a implementação do backend (se existirem hoje).

### 5.2 Itens de Votação
- Votações são registradas em `assembleia_votacoes`.
- **Duração padrão**: deve refletir o backend (`duracao_segundos` tem default no banco; regra institucional pode definir o padrão).
- **Auto-encerramento**: se 100% dos elegíveis votarem antes do tempo, pode encerrar (se implementado).
- **Omissão**: voto computado como **ABSTENCAO** para ausentes/no-vote (se implementado).

---

## 6. Scanner QR
- Payload esperado (recomendado): JSON
  `{ "type": "GLOBAL" | "QUORUM", "assembleiaId": "UUID", "token": "..." }`
- Integração no app via câmera (ex.: `expo-camera`) com fallback manual de token.

---

## 7. Auditoria (Append-Only)
- Ações críticas são registradas em `assembleia_auditoria`:
  - mudança de estado
  - geração/resgate de tokens
  - check-ins
  - definição de mesa
  - abertura/fechamento de votações
  - votos
