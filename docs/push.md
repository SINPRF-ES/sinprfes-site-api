# Módulo de Notificações Push

Este módulo permite que administradores enviem notificações push diretamente para todos os filiados que possuem o aplicativo instalado e estão logados.

## Requisitos de Acesso
Apenas usuários com os seguintes perfis podem acessar o módulo (site e mobile):
- ADMIN
- DIRETORIA
- FUNCIONÁRIO

## Funcionalidades
- **Enviar Notificação:** Formulário para disparo imediato.
  - Título (opcional, máx 60 caracteres).
  - Mensagem (obrigatório, máx 240 caracteres).
- **Confirmação:** Todo envio exige confirmação positiva em janela de diálogo.
- **Histórico:** Lista dos últimos 20 disparos com detalhes de quem enviou, conteúdo e contagem de sucesso/erro.
- **Rate Limit:** Máximo de 2 disparos por minuto por usuário.

## Endpoints (Backend)
- `POST /api/push/campaigns/send`: Envia uma nova notificação.
- `GET /api/push/campaigns`: Lista o histórico das últimas 20 campanhas.

## Como Testar

### Backend
1. Execute os testes unitários:
   ```bash
   npx jest src/controllers/push.controller.test.js src/controllers/pushCampaign.controller.test.js
   ```

### Frontend (Site)
1. Acesse a **Área do Filiado** com um perfil autorizado (ex: DIRETORIA).
2. Clique no menu **📢 Notificações** na barra lateral.
3. Preencha o formulário e clique em **Enviar Agora**.
4. Confirme o envio.
5. Verifique se o registro apareceu na tabela de **Histórico de Envios**.

### Mobile (Envio)
1. Acesse o menu lateral do App com um perfil autorizado.
2. Toque em **Enviar Notificação**.
3. Realize o envio seguindo os mesmos passos do site.
4. Verifique se o histórico no App também foi atualizado.

### Mobile (Recebimento)
1. Abra o app em um dispositivo físico e logue-se (para registrar o token).
2. Envie uma notificação via site ou mobile.
3. Verifique o recebimento da notificação no dispositivo.

## Segurança
- Tokens de push são mascarados nos logs (ex: `ExponentPu...xxxx`).
- Logs padronizados incluem `requestId`, `userId` e `perfil` para rastreabilidade.
- O endpoint de envio é protegido por permissão `PUSH_GERENCIAR` e possui rate limit de 2 disparos/min por usuário.
- O tamanho da mensagem é limitado: Título (60) e Mensagem (240).

## Detalhes de Implementação (Estatuto Mobile)
Para garantir a remoção determinística de elementos indesejados no WebView do Estatuto (especialmente em Androids antigos), os seguintes seletores são removidos via `MutationObserver`:
`#site-header`, `#site-footer`, `.estatuto-nav`, `.estatuto-nav-title`, `.barra-azul`, `header`, `nav`, `.navbar`, `.site-header`, `#header`, `#nav`.
