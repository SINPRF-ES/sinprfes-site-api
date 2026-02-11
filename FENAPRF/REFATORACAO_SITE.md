# Refatoração do Portal Web FENAPRF

Esta refatoração transformou o frontend web em um portal restrito (Área Restrita), espelhando as funcionalidades do aplicativo mobile e eliminando o conteúdo público legado.

## O que foi removido
- **Páginas Públicas Legadas:** `index.html`, `contato.html`, `diretoria.html`, `estatuto.html`, `jogos2026.html`, `modelo_pagina.html`, `users.html`, `votacoes-admin.html`.
- **Módulos Legados:** Funcionalidades de "Dependentes" e "Jogos" foram completamente removidas do backend (rotas e serviços) e do frontend.
- **Assets Legados:** Pastas de imagens de diretores, jogos e placeholders antigos foram deletadas.

## Mapa das Páginas Públicas Restantes
Apenas duas rotas/páginas são acessíveis sem autenticação:
1.  `/login.html` (ou via `/`): Tela de acesso com CPF e Senha.
2.  `/recuperar-senha.html`: Página única para solicitação de link de recuperação (via CPF) e para a redefinição da senha (quando acessada com o token na URL).

## Área Restrita (Portal do Membro)
O portal foi movido para a pasta `FENAPRF/backend/portal/` e é servido na rota `/portal/`.
- **Proteção:** O acesso a qualquer arquivo dentro de `/portal/` exige um token JWT válido (verificado via `authMiddleware`).
- **Paridade com o App:** O portal agora contém apenas os módulos ativos no aplicativo:
    - 👤 Meus Dados
    - 👥 Membros (Gestão)
    - 📚 Publicações
    - 🚚 Logística
    - 🗳️ Assembleias e Votações
    - 📢 Notificacoes (Gestão)
    - 📊 Relatórios (Gestão)
    - 🌐 Site (CMS - Gestão)

## Como Testar

### Login e Recuperação
1.  Acesse a raiz `/` e verifique o redirecionamento para `/login.html`.
2.  Tente acessar `/portal/` sem estar logado; o servidor deve retornar 401 ou erro de autenticação (bloqueado pelo middleware).
3.  Na tela de login, clique em "Recuperar Senha". Informe um CPF para testar o envio do link (o backend registrará a solicitação).
4.  Para testar a redefinição, acesse `/recuperar-senha.html?token=TOKEN_VALIDO`.

### Portal
1.  Realize o login com um CPF e Senha válidos.
2.  Você será redirecionado para `/portal/`.
3.  Verifique se os módulos de "Jogos" e "Dependentes" não aparecem mais no menu lateral ou nas telas de dados.
4.  Verifique se o logo e o estilo institucional permanecem íntegros.

## Paridade da API
As APIs consumidas pelo portal são exatamente as mesmas utilizadas pelo aplicativo mobile (`/api/auth`, `/api/users`, `/api/assembleias`, etc.), garantindo que qualquer melhoria ou regra de negócio seja aplicada simultaneamente a ambas as plataformas.
