# FENAPRF MASTER - Regras de Negócio e Arquitetura

Este documento define as diretrizes institucionais, decisões arquiteturais e o panorama geral do sistema FENAPRF.

## 1. Arquitetura Geral

O ecossistema FENAPRF é composto por:
- **Backend**: API Node.js (Express) com banco de dados PostgreSQL.
- **Mobile**: Aplicativo multiplataforma em React Native (Expo).
- **Portal**: Interface web administrativa integrada ao backend.

### 1.1. Identificação e Persistência
- Padrão absoluto de identificação via **UUID** (PKs e FKs).
- Backend utiliza **UUIDv7** para garantir ordenação temporal e unicidade.
- Auditoria **Append-Only** em módulos críticos (Assembleia, Logística).

## 2. Estratégia de Autenticação

- **Mecanismo**: JWT com estratégia de dois tokens (Access 15m / Refresh 30d).
- **Sessões**: Gerenciadas na tabela `auth_sessions`, vinculadas ao `deviceId` para controle de localidade.
- **Segurança**: Rotação de Refresh Token em cada uso e revogação global em caso de troca de senha.

## 3. Estrutura de Membros (Users)

A tabela `users` centraliza todos os participantes.
- **Cargos Acumulados (Dual Role)**: O sistema suporta nativamente dois vínculos simultâneos por membro através dos campos `perfil_acesso2`, `cargo2` e `uf2`. Esta estrutura é intencional e necessária para a realidade institucional da FENAPRF.
- **Normalização**: A tabela `user_vinculos` foi introduzida para permitir múltiplos vínculos ilimitados no futuro, mas os campos diretos na tabela `users` permanecem como fonte primária para compatibilidade com o app mobile atual.

## 4. Convivência de Módulos Deliberativos

O sistema possui três módulos distintos para votação e presença:

1.  **Assembleia (`assembleias`)**:
    - **Status**: Módulo Principal (Flagship).
    - **Foco**: Eventos formais (AGE/AGO) com rito estrito.
    - **Características**: Mesa Diretora, Quórum em Snapshots, Idempotência de Token Global.

2.  **Eventos (`eventos`)**:
    - **Status**: Módulo Secundário/Suporte.
    - **Foco**: Reuniões gerais, seminários e eventos informativos.
    - **Características**: Controle de entrada/saída simples e votações múltiplas simplificadas.

3.  **Votações Avulsas (`votacoes`)**:
    - **Status**: Módulo Ad-hoc.
    - **Foco**: Enquetes de opinião e consultas rápidas não vinculadas a eventos.

**Decisão Arquitetural**: Os módulos coexistem para atender diferentes níveis de formalidade. O módulo `Assembleia` NÃO substituiu `Eventos`, mas sim especializou o rito deliberativo formal.

## 5. Fluxos de Dados Críticos

- **Sincronização**: Uso de **Socket.io** para atualizações em tempo real durante assembleias (mudança de estado, novos votos, pedidos de palavra).
- **Editais**: Integração com **Google Drive API** (Biblioteca Digital) para armazenamento de documentos oficiais em PDF, servidos via proxy autenticado no backend.
- **Relatórios**: Geração assíncrona de PDFs via `report_jobs` e envio por e-mail, restrita ao estado `ENCERRADO` para garantir integridade.

---

## 6. Relatório de Aderência (Auditoria Estrutural)

*Seção atualizada em: 2025-05-22*

### 6.1. Status da Implementação
- **Back vs Docs**: O código backend reflete a maior parte das regras, mas foram identificadas divergências pontuais com as regras canônicas institucionais.
- **Divergências Sanadas**: A divergência documental sobre o voto por omissão (anteriormente citado como SIM) foi corrigida para **ABSTENCAO**, alinhando a documentação com a realidade já implementada no código backend.
- **Divergências de Negócio Identificadas**:
    - **Duração de Votação**: O código utiliza 5 minutos (300s), enquanto a regra institucional determina 2 minutos (120s).
    - **Geração de Snapshot**: O código permite perfis ADMIN/DIRETORIA, enquanto a regra restringe exclusivamente à Mesa Diretora do evento.
- **Campos Legados**: Identificados `content_blocks` e `pre_inscricoes_jogos` como tabelas sem referência no código atual.

### 6.2. Pendências Identificadas
- **Mobile Sync**: Os módulos `Eventos` e `Votacoes Avulsas` possuem backend completo, mas as telas correspondentes no mobile não estão integradas ao fluxo principal de navegação.
- **Normalização**: A migração definitiva para `user_vinculos` ainda aguarda atualização das queries de relatório e filtragem no mobile.

---

## 7. Cânone Oficial de Roles e Autoridades

Este cânone define as regras de negócio absolutas para acesso e autoridade no ecossistema FENAPRF, centralizadas no arquivo `shared/canon.js`.

### 7.1. Grupos de Gestão
- **Gestão (Geral)**: Composto pelos perfis `ADMIN`, `DIRETORIA` e `COLABORADOR`.
- **Poder Administrativo**: Apenas o perfil `ADMIN` pode criar, editar ou gerenciar outros perfis `ADMIN`.

### 7.2. Autoridade Institucional (Cargos)
Certas operações críticas são restritas a cargos específicos, independentemente do perfil de acesso:

| Operação | Autoridade Permitida |
| :--- | :--- |
| **Geração de QR Global** | Presidente/Vice FENAPRF, Diretores de Secretaria (Titular/Subst.) |
| **Composição de Mesa** | Presidente/Vice FENAPRF ou ADMIN |
| **Gestão de Quórum** | Exclusiva da Mesa Diretora (após composta) ou ADMIN |
| **Registro em Eventos** | Restrito a DIRETORIA e CONSELHEIRO (ADMIN/COLABORADOR não se registram) |

### 7.3. O "Poder da Mesa" (Princípio da Soberania)
Durante uma Assembleia ativa, uma vez que a **Mesa Diretora** (4 membros) é definida e salva:
- A autoridade de gestão da sala (abrir/fechar quórum, iniciar/parar votação) **transfere-se integralmente** para os membros da Mesa.
- O perfil de acesso regular (ex: Conselheiro que virou Secretário da Mesa) é elevado para autoridade de gestão dentro do contexto daquele evento.
- O ADMIN retém autoridade de supervisão (Safety Net).

---

## 8. Confirmação de Auditoria e Escopo

✅ **Auditoria Concluída**: Todos os artefatos foram analisados conforme a hierarquia de fonte da verdade (Backend > App > Site > CSV).
✅ **Restrição de Diretório**: Nenhum arquivo fora da pasta `FENAPRF/` foi alterado ou criado nesta entrega.
