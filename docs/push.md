# Módulo de Notificações Push

Este módulo permite que administradores enviem notificações push diretamente para todos os filiados que possuem o aplicativo instalado e estão logados.

## Requisitos de Acesso
Apenas usuários com os seguintes perfis podem acessar o módulo no site:
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

### Mobile (Verificação de logs)
1. Abra o app em um dispositivo físico.
2. Logue-se.
3. Verifique nos logs (`adb logcat` ou visualizador de logs interno se disponível) as mensagens com prefixo `Push info:`.
4. O registro de token deve ocorrer de forma silenciosa ("best-effort").

## Segurança
- Tokens de push são mascarados nos logs (ex: `ExponentPu...xxxx`).
- O endpoint de envio é protegido por permissão `PUSH_GERENCIAR`.
- O tamanho da mensagem é limitado tanto no frontend quanto no backend.
