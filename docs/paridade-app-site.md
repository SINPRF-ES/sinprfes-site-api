# Matriz de Paridade App vs Site - Gap Audit

## 1. Inventário de Telas e Módulos (App Mobile)

| Módulo | Tela (App) | Acesso (Drawer/Menu) | Permissão | API / Endpoints | Status no Site |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Geral** | Início (Home) | Início | Todos | `/api/auth/me`, `/api/noticias` | ✅ OK (Implementada sec-home) |
| **Perfil** | Meus Dados | Meus Dados | Todos | `/api/filiados/me` (GET/PUT) | ✅ OK |
| **Filiados** | Listagem / Busca | Filiados | Todos | `/api/filiados` | ✅ OK |
| **Filiados** | Detalhe | Clicar em Filiado | Todos | `/api/filiados/:id` | ✅ OK |
| **Filiados** | Editar Filiado | Botão Editar | Gestão | `/api/filiados/:id` (PUT) | ✅ OK |
| **Filiados** | Novo Filiado | Novo Filiado | Gestão | `/api/filiados` (POST) | ✅ OK (Item de menu dedicado) |
| **Notícias** | Lista / Detalhe | Notícias | Todos | `/api/noticias` | ✅ OK (Ativado para Membros) |
| **Notícias** | Gestão | Notícias | Comunicação | `/api/noticias` (POST/PUT) | ✅ OK |
| **Repasse** | Histórico / Edição | Repasse | Gestão | `/api/repasse` | ✅ OK (Unificação de ativos) |
| **Relatórios** | Geração / Preview | Relatórios | Gestão | `/api/reports` | ✅ OK (Labels e emojis) |
| **Notificações**| Envio (Push) | Notificações | Gestão | `/api/push/campaigns` | ✅ OK |
| **Notificações**| Centro de Notif. | (Novo) | Todos | `/api/push/history/me` | ✅ OK (Histórico implementado) |
| **Publicações**| Biblioteca | Publicações | Todos | `/api/publicacoes` | ✅ OK |
| **Jogos 2026** | Inscrição / Info | Jogos 2026 | Todos | `/api/jogos` | ✅ OK |
| **Assembleias** | Votação / Lista | Assembleias | Todos | `/api/assembleias` | ✅ OK |
| **Estatuto** | Leitura | Estatuto | Todos | (Página estática) | ✅ OK (Implementado sec-estatuto) |
| **Segurança** | Biometria/2FA | Segurança | Todos | `/api/auth/2fa` | ✅ OK (Aba dedicada) |

## 2. Gaps e Divergências Encontradas

### Gap A: Navegação (Home e Novo Filiado)
No App, a "Página Inicial" tem cards de ações rápidas. O Site abre direto na aba "Meus Dados".
Também, "Novo Filiado" é um item de menu separado no App, mas no Site está embutido na aba de Filiados.

### Gap B: Notícias para Membros
No Site, a aba "Notícias" no Area do Filiado só aparece para gestores. Membros comuns não têm acesso às notícias de forma integrada (usam o site público).

### Gap C: Centro de Notificações
O usuário solicitou explicitamente: "Notificações (lista, detalhe, leitura, preferências, badge)". Isso não existe de forma unificada para o filiado nem no App nem no Site atualmente (o App apenas recebe Push).

## 3. Plano de Implementação

- **Wave A**: Unificar Navegação (Home Cards e Sidebar).
- **Wave B**: Habilitar Notícias para todos os membros no Area do Filiado.
- **Wave C**: Implementar Backend e Frontend para o Centro de Notificações.
- **Wave D**: Auditoria fina de Repasse e Relatórios.
