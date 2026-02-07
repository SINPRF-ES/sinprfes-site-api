# Resumo da Implementação - Projeto FENAPRF

Este documento detalha as ações realizadas para criar a cópia isolada do sistema e os próximos passos necessários.

## O que foi feito

1. **Criação da Estrutura FENAPRF/**:
   - Centralização do sistema em um diretório único na raiz para total isolamento.
   - Divisão em `mobile/` e `backend/`.

2. **Isolamento do App Mobile**:
   - **Identidade**: Nome alterado para `fenaprf-app`, Slug para `fenaprf-app` e pacotes Android/iOS para `br.org.fenaprf.app`.
   - **Dependências**: O caminho da dependência `@fenaprf/shared-format` foi atualizado para apontar para `file:../backend/shared/format`, garantindo que o app use o código compartilhado de dentro da estrutura FENAPRF.
   - **Metro Config**: Ajustado o `watchFolders` para o novo caminho do `shared`.
   - **Limpeza**: Arquivos de lock (`package-lock.json`, `pnpm-lock.yaml`) foram removidos para garantir uma instalação limpa conforme solicitado.
   - **Placeholders**: Configurados placeholders para `projectId` e `updates.url` do Expo/EAS em `app.json`.

3. **Isolamento do Backend**:
   - **Identidade**: Nome no `package.json` alterado para `fenaprf-backend`.
   - **Configuração**: Criado `.env.example` com todas as variáveis necessárias, utilizando domínios de exemplo da FENAPRF.
   - **Personalização**: Mensagem de inicialização do servidor alterada para "FENAPRF rodando...".

## O que precisa ser feito (Próximos Passos)

1. **Geração de Lock Files**:
   - Executar `npm install` ou `pnpm install` dentro de `FENAPRF/mobile` e `FENAPRF/backend` para gerar os novos arquivos de bloqueio de dependências.

2. **Configuração de Ambiente (.env)**:
   - Criar os arquivos `.env` a partir dos `.env.example` e preencher com as credenciais reais (Banco de dados, Cloudinary, Resend, Google Drive, etc).

3. **Vínculo com EAS (Expo)**:
   - Rodar `eas project:init` na pasta `FENAPRF/mobile` para obter um novo `projectId` e atualizar o `app.json`.

4. **Vínculo com Firebase (Google Services)**:
   - O arquivo `google-services.json` atual é do FENAPRF. Será necessário gerar um novo no Firebase Console para o pacote `br.org.fenaprf.app` e substituí-lo.

5. **Banco de Dados**:
   - Rodar as migrations contidas em `FENAPRF/backend/scripts/` no novo banco de dados da FENAPRF.
