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
- **Back vs Docs**: O código backend reflete fielmente as regras documentadas em `assembleia.md` e `schema.md`.
- **Divergências Sanadas**: A divergência documental sobre o voto por omissão (anteriormente citado como SIM) foi corrigida para **ABSTENCAO**, alinhando a documentação com a realidade já implementada no código backend.
- **Campos Legados**: Identificados `content_blocks` e `pre_inscricoes_jogos` como tabelas sem referência no código atual.

### 6.2. Pendências Identificadas
- **Mobile Sync**: Os módulos `Eventos` e `Votacoes Avulsas` possuem backend completo, mas as telas correspondentes no mobile não estão integradas ao fluxo principal de navegação.
- **Normalização**: A migração definitiva para `user_vinculos` ainda aguarda atualização das queries de relatório e filtragem no mobile.

---

## 7. Confirmação de Auditoria e Escopo

✅ **Auditoria Concluída**: Todos os artefatos foram analisados conforme a hierarquia de fonte da verdade (Backend > App > Site > CSV).
✅ **Restrição de Diretório**: Nenhum arquivo fora da pasta `FENAPRF/` foi alterado ou criado nesta entrega.
