# FENAPRF MASTER - Regras de Negócio e Arquitetura

Este documento define diretrizes institucionais, decisões arquiteturais e panorama geral do sistema FENAPRF.
Fonte primária: Backend (`FENAPRF/backend`). App e Portal devem refletir o backend.

## 1. Arquitetura Geral

O ecossistema FENAPRF é composto por:
- **Backend**: API Node.js (Express) com banco de dados PostgreSQL.
- **Mobile**: Aplicativo multiplataforma em React Native (Expo).
- **Portal**: Interface web administrativa integrada ao backend.

### 1.1 Identificação e Persistência
- Padrão absoluto de identificação via **UUID** (PKs e FKs).
- Geração atual no banco via `gen_random_uuid()`.
- Auditoria **Append-Only** em módulos críticos (Assembleia, Logística) onde aplicável.

## 2. Estratégia de Autenticação

- **Mecanismo**: JWT com estratégia de dois tokens (Access / Refresh).
- **Sessões**: Gerenciadas em `auth_sessions`, com vínculo opcional a `device_id`.
- **Segurança**:
  - refresh token armazenado de forma persistente;
  - revogação de sessão via `revoked_at`;
  - rastreio de atividade via `last_seen_at`.

> Os tempos (15m/30d) e a rotação de refresh devem refletir o backend. Se houver divergência entre doc e implementação, prevalece o backend.

## 3. Estrutura de Membros (Users)

A tabela `users` centraliza participantes.
- **Cargos acumulados / Dual role**: o sistema suporta dois vínculos simultâneos através de `perfil_acesso2`, `cargo2` e `uf2`.
- **UFs distintas**: `uf_endereco` (residencial) e `uf/uf2` (vínculos).
- **Normalização**: `user_vinculos` existe para evolução futura (múltiplos vínculos), mantendo compatibilidade com o mobile atual.

## 4. Convivência de Módulos Deliberativos

O sistema possui três módulos distintos:

1. **Assembleia (`assembleias` e `assembleia_*`)**
   - **Status**: Módulo deliberativo formal (AGE/AGO).
   - **Características**: Mesa Diretora, quórum versionado (`assembleia_quoruns`), votos nominais, auditoria.

2. **Eventos (`eventos` e `evento_*`)**
   - **Status**: Módulo paralelo para eventos gerais.
   - **Características**: controle de presença e votações associadas ao evento (conforme backend).

3. **Votações Avulsas (`votacoes` e `votacao_*`)**
   - **Status**: Módulo ad-hoc para consultas rápidas não vinculadas a evento/assembleia.

**Decisão arquitetural**: os módulos coexistem para atender diferentes níveis de formalidade. O módulo Assembleia não substitui Eventos; é um rito formal dedicado.

## 5. Fluxos de Dados Críticos

- **Editais**: Integração com Google Drive (Biblioteca Digital) para armazenamento de PDFs oficiais.
- **Relatórios**: Geração assíncrona via `report_jobs`, restrita a assembleias encerradas (estado `ENCERRADO`).

> Atualizações em tempo real (ex.: Socket.io) devem refletir o backend atual; documentar apenas se implementado.

## 6. Cânone Oficial de Roles e Autoridades

Regras de acesso e autoridade são definidas pelo backend (e documentação canônica associada).

### 6.1 Grupos de acesso e Deliberação
- **Gestão (Geral)**: `ADMIN`, `DIRETORIA`, `COLABORADOR`.
- **Membro do Conselho de Representantes**: É o perfil deliberativo. Composto por todos os `CONSELHEIRO` ativos e pelo Presidente e Vice-Presidente da `DIRETORIA` da FENAPRF.
- **Participantes**: `CONSELHEIRO` e `DIRETORIA` participam do credenciamento global. Apenas Membros do Conselho participam de Quórum, Votação e Propostas.

### 6.2 Autoridade institucional
Operações críticas dependem estritamente do cargo institucional (Soberania do Canon):

| Operação | Autoridade Permitida |
| :--- | :--- |
| Geração do QR/token global (credenciamento) | Presidente/Vice FENAPRF, Diretor de Secretaria (Titular/Subst.) |
| Composição de Mesa | Exclusiva do Presidente/Vice FENAPRF |
| Geração de token de quórum (Snapshot) | Exclusiva da Mesa Diretora (4 componentes) |
| Check-in de Quórum / Voto / Proposta | Exclusiva para Membros do Conselho de Representantes |
| Relatório | Apenas com assembleia em `ENCERRADO` |

### 6.3 Princípio da Soberania da Mesa
Uma vez definida a Mesa Diretora:
- decisões operacionais do rito (quórum e votações) ficam sob autoridade da Mesa, conforme regras do backend;
- o ADMIN atua como suporte técnico e auditoria, sem interferir no rito institucional (salvo regra explícita do backend).

## 7. Auditoria e Escopo

✅ Restrição de diretório: nenhum arquivo fora de `FENAPRF/` deve ser alterado em entregas deste projeto de documentação.  
✅ Aderência: backend é a fonte primária; divergências do banco devem ser resolvidas via scripts/migrations em `FENAPRF/backend/scripts`.
