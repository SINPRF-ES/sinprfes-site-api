# Matriz de Paridade App vs Site - Estrutura de Navegação Unificada

Esta documentação reflete a estrutura de menus e seções padronizada entre o site (Área do Filiado) e o aplicativo mobile (Drawer Navigator).

## 1. Estrutura de Seções e Módulos

As seções abaixo seguem a ordem de exibição e o agrupamento visual (com cores de fundo distintas) em ambas as plataformas.

### 🏠 Seção I: Área do Filiado
*Foco na gestão individual do membro e acesso rápido.*

| Módulo | Descrição | Visibilidade |
| :--- | :--- | :--- |
| **Página Inicial** | Dashboard com cards de ações rápidas | Todos |
| **Meus Dados** | Consulta e atualização cadastral própria | Todos |
| **Filiados** | Busca e listagem do quadro de membros | Membros (exceto Comunicador) |
| **Informes** | Mural de avisos e comunicados internos | Todos |
| **Publicações** | Biblioteca de documentos, atas e resoluções | Membros (exceto Comunicador) |
| **Convênios** | Lista de parceiros e benefícios | Todos |
| **Estatuto** | Consulta às normas do sindicato | Todos |
| **Segurança** | Configurações de 2FA e Biometria | Todos |
| **Atualizações** | Log de melhorias do sistema | Todos |

### 🧩 Seção II: Serviços e Participação
*Módulos interativos e serviços de apoio ao filiado.*

| Módulo | Descrição | Visibilidade |
| :--- | :--- | :--- |
| **Ressarcimento** | Solicitação de reembolsos e auxílios | Todos |
| **Assembleias** | Votações em tempo real e histórico | Membros (exceto Comunicador) |
| **Enquetes** | Consultas rápidas de opinião | Membros (exceto Comunicador) |
| **Jogos 2026** | Inscrições e informações do evento | Membros (exceto Comunicador) |
| **Repasse** | Apoio e alocações de recursos | Todos (Edição restrita à Gestão) |

### 🛠️ Seção III: Gestão
*Ferramentas administrativas de controle e auditoria.*

| Módulo | Descrição | Visibilidade |
| :--- | :--- | :--- |
| **Consulta Processual** | Monitoramento automático de tribunais (PJe) | Gestão e Membros |
| **Estatísticas** | Dashboard de acessos e métricas do site | Gestão (RELATORIOS_VER) |
| **Relatórios** | Geração de dossiês e listas em PDF | Gestão (RELATORIOS_VER) |
| **Notificações** | Disparo de campanhas Push e histórico | Gestão (PUSH_GERENCIAR) |
| **Novo Filiado** | Atalho para criação de novos registros | Gestão (CREATE_FILIADO) |
| **Site (CMS)** | Gestão de conteúdo público (Notícias/Convênios) | Gestão (EDIT_CONTENT) |
| **Diagnóstico** | Monitoramento técnico e logs do sistema | Diretoria / Admin |

## 2. Implementação Técnica de Paridade

- **Cores de Seção**:
  - `Principal`: Fundo neutro/smoky leve.
  - `Serviços`: Destaque em azul marinho translúcido (App: `rgba(0, 51, 102, 0.08)` / Site: `rgba(0, 51, 102, 0.2)`).
  - `Gestão`: Fundo escuro sutil (App: `rgba(0, 0, 0, 0.05)` / Site: `rgba(0, 0, 0, 0.15)`).

- **RBAC e Visibilidade**:
  - O módulo **Repasse** foi movido da seção de Gestão para Serviços, tornando-se visível para todos os filiados, embora as funções de edição permaneçam restritas via permissões de backend.
  - A visibilidade de itens no App agora é filtrada dinamicamente no `CustomDrawerContent.tsx` com base nas rotas realmente disponíveis no `DrawerNavigator`, mantendo coerência com o RBAC.
  - Os itens de gestão renderizados no Drawer (ex.: **Notificações**, **Novo Filiado**, **Diagnóstico**) exibem estado ativo corretamente.
