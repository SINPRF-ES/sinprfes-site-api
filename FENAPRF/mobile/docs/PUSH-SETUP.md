# Configuração de Push Notifications (FCM V1 + Expo/EAS)

Este documento descreve como configurar as credenciais do Firebase Cloud Messaging (FCM) V1 para permitir o envio de notificações push via Expo.

## 1. Firebase Cloud Messaging (FCM) V1

O Expo agora utiliza o FCM V1 por padrão. Para configurá-lo:

### A) Gerar Chave de Conta de Serviço
1. Acesse o [Firebase Console](https://console.firebase.google.com/).
2. Selecione seu projeto.
3. Vá em **Configurações do Projeto** (ícone de engrenagem) > **Contas de Serviço**.
4. Clique em **Gerar nova chave privada** e salve o arquivo JSON.

### B) Cadastrar no Expo/EAS
1. Instale o EAS CLI se ainda não tiver: `pnpm install -g eas-cli`.
2. No diretório `mobile`, execute:
   ```bash
   eas credentials
   ```
3. Siga as instruções:
   - Selecione a plataforma `android`.
   - Selecione o perfil (ex: `production` ou `preview`).
   - Escolha **FCM V1 Service Account Key**.
   - Faça o upload do arquivo JSON gerado no passo anterior.

## 2. Validação

Para validar se a configuração está correta:

1. Acesse o painel administrativo (ou use o app como admin).
2. Vá em **Notificações**.
3. Envie uma mensagem de teste para "TODOS".
4. Verifique o resultado:
   - **Sucesso**: `sent > 0`.
   - **Erro de Credenciais**: Se o log no Render mostrar `InvalidCredentials` e a mensagem no site for *"FCM credentials missing/invalid in Expo project"*, revise o upload do JSON no EAS.

## 3. Quando é necessário um Rebuild?

- **Não exige rebuild**: Mudar apenas a Service Account Key no EAS Credentials. O backend do Expo usará a nova chave imediatamente.
- **Exige rebuild (Novo APK)**: Se você alterar o `google-services.json` no projeto mobile ou mudar o `applicationId` (package name) no `app.json`.

## 4. Diagnóstico Rápido

Use o endpoint `/api/push/health` (acesso restrito a gestão) para verificar se existem tokens ativos e ver orientações básicas.
