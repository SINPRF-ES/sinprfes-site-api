# SINPRF/ES App

Aplicativo móvel para filiados do Sindicato dos Policiais Rodoviários Federais no Estado do Espírito Santo (SINPRF/ES).

Este aplicativo serve como um cliente para a API do [sinprfes-site-api](https://github.com/SINPRF-ES/sinprfes-site-api) e espelha as funcionalidades do site.

## 1. Como Rodar o Projeto

### Pré-requisitos
- Node.js (versão LTS recomendada)
- Git
- Celular com o app Expo Go instalado (para testes em dispositivo físico)

### Passos
1. **Clone o repositório:**
   ```bash
   git clone https://github.com/SINPRF-ES/sinprfes-app.git
   cd sinprfes-app
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente:**
   - Crie um arquivo `.env` na raiz do projeto (use `.env.example` como modelo).
   - Preencha a `API_BASE_URL` conforme explicado na seção "Configuração para Desenvolvimento Local".

4. **Inicie o ambiente de desenvolvimento:**
   ```bash
   npm start
   ```
   - Escaneie o QR code com o app Expo Go no seu celular.

## 2. Configuração para Desenvolvimento Local

Para conectar o aplicativo a um servidor de API rodando na sua máquina, é crucial usar o endereço de IP correto.

### 2.1. Por que `localhost` não funciona?
Quando o app roda no seu celular, `localhost` se refere ao próprio celular, não ao seu computador. Para que o app possa se comunicar com a API na sua máquina, você deve usar o endereço de IP do seu computador na rede Wi-Fi.

### 2.2. Encontrando seu Endereço de IP Local
- **No Windows:**
  - Abra o PowerShell ou CMD e digite `ipconfig`.
  - Procure pelo "Endereço IPv4" do seu adaptador de rede Wi-Fi.

- **No macOS ou Linux:**
  - Abra o terminal e digite `ifconfig | grep inet`.
  - Procure pelo endereço que se parece com `192.18.x.x`.

### 2.3. Configurando o Arquivo `.env`
No seu arquivo `.env`, a variável `API_BASE_URL` deve ser configurada da seguinte forma (substitua `SEU_IP_AQUI` pelo IP encontrado):

```
# Exemplo para teste em dispositivo físico
API_BASE_URL=http://192.168.1.5:3000
```
**Importante:** Seu computador e seu celular devem estar conectados à mesma rede Wi-Fi.

## 3. Arquitetura e Fluxos

### 3.1. Autenticação no Mobile
O fluxo de autenticação é projetado para ser robusto e centralizado, seguindo as melhores práticas de gerenciamento de tokens JWT.

1.  **Login e Armazenamento:** Após o login bem-sucedido, a API retorna um token JWT, que é salvo de forma segura no `AsyncStorage` do dispositivo.
2.  **Injeção Automática de Token:** O cliente `axios` (`apiService.ts`) possui um **interceptor de requisição**. Antes de cada chamada à API, este interceptor lê o token do storage e o injeta automaticamente no header `Authorization: Bearer <token>`. Isso centraliza a lógica e garante que nenhuma chamada a endpoints protegidos seja feita sem autenticação.
3.  **Validação da Sessão:** Ao iniciar o app, o `useAuth` hook carrega o token do storage e dispara uma chamada para `/api/filiados/me`. Isso valida a sessão com o backend e garante que os dados do usuário estejam sempre atualizados. Nenhuma chamada à API é feita se o token não for encontrado localmente.
4.  **Observação Importante:** O token **não deve** ser passado manualmente nas chamadas normais da API. O interceptor é a única fonte da verdade para a injeção de tokens.

### 3.2. Tratamento de Erros de Autenticação (401)
O tratamento de erros 401 (Não Autorizado) é gerenciado para evitar loops e garantir uma experiência de usuário consistente.

-   **Logout Centralizado:** Um **interceptor de resposta** no `axios` detecta respostas com status 401. Quando isso ocorre, ele automaticamente limpa os dados da sessão (token e usuário) do storage, efetivamente deslogando o usuário.
-   **Prevenção de Loops:** O sistema de logging possui um mecanismo de "debouncing" que impede que o mesmo erro seja registrado várias vezes em um curto intervalo. Isso evita o spam de logs que ocorria anteriormente quando uma falha de autenticação acontecia.

### 3.3. Gerenciamento de Biometria
O aplicativo oferece a conveniência e segurança do login biométrico (digital ou facial).

-   **Ativação Opcional:** No primeiro login bem-sucedido, o aplicativo pergunta se o usuário deseja ativar a biometria.
-   **Tela de Segurança:** A qualquer momento, o usuário pode ativar ou desativar o login biométrico através da tela **"Segurança"**, acessível pelo menu lateral.
-   **Fluxo de Login:**
    -   Se a biometria estiver ativa, um botão "Entrar com Biometria" aparecerá na tela de login.
    -   Ao desativar a biometria na tela de Segurança, este botão é removido.

## 4. Troubleshooting e Diagnóstico

### 4.1. Erro de "Worklets Mismatch"
- **Sintoma:** O aplicativo exibe uma tela vermelha com o erro `[Worklets] Mismatch between JavaScript part and native part...`.
- **Causa:** Ocorre quando a versão de uma biblioteca nativa (como `react-native-reanimated`) instalada no `node_modules` não corresponde exatamente à versão nativa pré-compilada no aplicativo Expo Go. Isso geralmente é causado por `npm install` que pode instalar uma versão de patch diferente devido a especificadores de versão flexíveis (ex: `~4.1.1`).
- **Solução:** As versões das dependências nativas foram fixadas no `package.json` para garantir que apenas as versões compatíveis sejam instaladas. Se o erro persistir, execute os comandos de limpeza abaixo.

### 3.2. Procedimento de Reset Total (Limpeza de Cache e Dependências)
Se o aplicativo apresentar comportamento inesperado, como erros de dependência nativa ou falhas de cache, siga este procedimento para garantir um ambiente completamente limpo.

**1. Pare o servidor Metro Bundler.**

**2. Limpe o cache do Expo:**
```bash
npx expo start -c
```

**3. Remova `node_modules` e `package-lock.json`:**
   - **Windows (PowerShell):**
     ```powershell
     Remove-Item -Recurse -Force node_modules, package-lock.json
     ```
   - **Windows (CMD):**
     ```cmd
     rmdir /s /q node_modules
     del package-lock.json
     ```
   - **macOS / Linux:**
     ```bash
     rm -rf node_modules package-lock.json
     ```

**4. Reinstale as dependências:**
   ```bash
   npm install
   ```

**5. (Opcional) Reinstale dependências nativas críticas:**
   Se suspeitar de problemas com bibliotecas como Reanimated ou Gesture Handler, force a reinstalação da versão correta:
   ```bash
   npx expo install react-native-reanimated react-native-gesture-handler
   ```

### 3.3. Sistema de Logs e Diagnóstico
O aplicativo agora possui um sistema de logging robusto para facilitar a depuração.

- **Captura de Erros:** Todos os erros de JavaScript (incluindo renderização e promises não tratadas) e chamadas de API são automaticamente registrados.
- **Acessando os Logs:**
  1. No menu lateral (Drawer), navegue até a tela **"Diagnóstico"**.
     - **Observação:** Esta tela é visível **apenas para usuários com perfil `ADMIN`**.
  2. Nesta tela, você pode visualizar, copiar para a área de transferência ou limpar os logs armazenados no dispositivo.
- **Quando Usar:** Se você encontrar um bug, use o botão **"Copiar Logs"** e envie o texto para a equipe de desenvolvimento. Isso fornecerá o contexto necessário para identificar e resolver o problema.

## 4. Matriz de Paridade com o Site

| Recurso                 | Status    | Observações                                                                        |
|-------------------------|-----------|------------------------------------------------------------------------------------|
| Autenticação (JWT)      | `OK`      | Fluxo de login, 2FA e armazenamento de sessão implementados.                       |
| Meus Dados (GET/PUT)    | `OK`      | Tela implementada para visualização e edição dos próprios dados.                   |
| Listagem de Filiados    | `OK`      | Busca local com cache offline e diferenciação de dados por perfil.                  |
| Gestão de Filiados      | `OK`      | Telas de criação, edição, arquivamento e desarquivamento implementadas.        |
| Dependentes (até 5)     | `OK`      | Campos adicionados nos formulários com labels corrigidos.                            |
| Avatar Upload           | `Pendente`| Lógica de upload de imagem (`multipart/form-data`) precisa ser implementada.         |
| Fluxo de Primeiro Acesso| `Pendente`| Requer análise do fluxo exato no backend/site.                                     |

## 5. Controles de Formulário e UX

### Máscara e Limite de CPF no Login
- O campo de CPF na tela de login agora aplica automaticamente a máscara `000.000.000-00` à medida que o usuário digita.
- A entrada é limitada a 11 dígitos (14 caracteres com a máscara).
- Apenas os números são armazenados e enviados para a API, garantindo a integridade dos dados.

### Exibição de Telefone Vazio
- Foi corrigido um bug visual onde um parêntese `(` era exibido para campos de telefone vazios.
- Agora, se um filiado não tiver um número de telefone cadastrado, o campo correspondente na UI será exibido completamente em branco.

### Formulário de Dependentes
- **Placeholders Específicos**: Os campos do formulário de dependentes agora exibem placeholders claros: "Nome completo", "apenas números" (CPF) e "DD/MM/AAAA" (Data de Nascimento).
- **Validação de CPF**: O campo CPF para dependentes agora está limitado a 11 dígitos, e apenas valores numéricos são aceitos.
- **Seleção de Parentesco**: O campo "Parentesco" foi transformado em um seletor com opções pré-definidas. Ao escolher "Outro", um campo de texto adicional é exibido para entrada manual, garantindo que o parentesco seja sempre registrado de forma estruturada ou personalizada quando necessário.

## 6. Gestão (perfis admin/funcionário/diretoria)

O aplicativo móvel implementa as funcionalidades de gestão de filiados, restritas aos perfis `ADMIN`, `DIRETORIA` e `FUNCIONARIO`. Essas funcionalidades incluem:

-   **Criação de Novos Filiados**: Acesso através de um botão "Novo" no cabeçalho da lista de filiados.
-   **Edição de Filiados Existentes**: Para editar um filiado, o usuário de gestão deve:
    1. Tocar no card do filiado na lista para expandi-lo.
    2. Dentro do card expandido, tocar no botão "Editar".
    - *Esta abordagem espelha o comportamento do site e evita a necessidade de um item de menu "Editar" separado.*
-   **Arquivamento e Desarquivamento**: As opções para arquivar e desarquivar estão disponíveis dentro da tela de edição.

### Offline: gestão é online-only

As ações de gestão que modificam dados (criar, editar, arquivar, desarquivar) estão disponíveis **apenas em modo online**. Se o dispositivo estiver offline, os botões correspondentes são desabilitados e uma mensagem informa o usuário sobre a restrição.

## 7. Informações sobre Campos e Normalização

### Situação Funcional vs Status do Cadastro

No sistema, existem dois conceitos distintos que não devem ser confundidos:

1.  **Situação Funcional:** Refere-se ao vínculo de trabalho do policial.
    - Valores canônicos (salvos no banco): `ATIVO`, `VETERANO`, `PENSIONISTA`.
    - O aplicativo realiza uma **normalização** (trim, uppercase, tratamento de plurais como "VETERANOS") para garantir a consistência na exibição de badges, filtros e formulários.
2.  **Status do Cadastro:** Refere-se à situação do registro no sistema.
    - `ATIVO`: Cadastro regular.
    - `ARQUIVADO`: Cadastro inativo no sistema (baseado no campo `arquivado_em`).

### Localização e Edição de Dados Sensíveis

Por regra de negócio, a edição de campos como `nome`, `cpf`, `lotacao` e `situacao_funcional` em filiados existentes é restrita. No entanto, para **Novos Filiados**, todos estes campos são editáveis durante a criação. A `data_nascimento` do titular é editável por usuários com perfil `ADMIN`.

## 8. Checklist de Testes Manuais

### Testes Gerais de UI/UX
- [ ] **Login:** O campo CPF aceita no máximo 11 dígitos e exibe a máscara `000.000.000-00`.
- [ ] **Telefone Vazio:** Em qualquer tela (lista, detalhes), um filiado sem telefone exibe um campo vazio (sem `(`).
- [ ] **Menu Lateral (Drawer):**
    - [ ] Não há itens duplicados como "Novo Filiado".
    - [ ] O item "Editar Filiado" não existe.
    - [ ] O item "Diagnóstico" só aparece para o perfil `ADMIN`.
- [ ] **Biometria:**
    - [ ] É possível acessar a tela "Segurança" pelo menu.
    - [ ] Ativar a biometria faz o botão aparecer na tela de Login.
    - [ ] Desativar a biometria remove o botão da tela de Login.
    - [ ] O login com biometria funciona corretamente.

### Login como FILIADO
- [ ] Vê a lista de filiados com dados reduzidos (nome, telefone, lotação, situação).
- [ ] Não vê o item de menu "Gestão" no Drawer.
- [ ] Tentar acessar a rota `/Logs` (Diagnóstico) diretamente resulta em um erro de "Acesso Negado".
- [ ] Em "Meus Dados", os labels dos campos de dependentes ("Nome", "CPF", etc.) aparecem corretamente.

### Login como ADMIN / GESTÃO
- [ ] Vê o item de menu "Gestão" no Drawer.
- [ ] **Fluxo de Edição:**
    - [ ] Ao tocar em um filiado na lista, o card expande.
    - [ ] O botão "Editar" aparece dentro do card expandido.
    - [ ] Clicar em "Editar" navega corretamente para a tela de edição.
- [ ] Consegue criar um novo filiado com sucesso.
- [ ] Consegue editar um filiado existente com sucesso.
- [ ] Consegue arquivar e desarquivar um filiado com sucesso.
- [ ] Em modo offline, o botão "Editar" no card expandido está desabilitado.

### Verificação de Vazamento de Cache
- [ ] Logar como ADMIN e sincronizar a lista de filiados.
- [ ] Fazer logout.
- [ ] Logar como FILIADO.
- [ ] Colocar o dispositivo em modo avião (offline).
- [ ] Acessar a lista de filiados e confirmar que os dados exibidos são os reduzidos (não os dados completos do cache do ADMIN).

---

## Módulo compartilhado agnóstico (Web + Mobile): shared/format

### Objetivo

Para evitar divergências de máscaras e formatação entre o frontend Web e o App Mobile, o projeto utiliza um módulo compartilhado com funções puras e agnósticas (sem dependências de UI). A fonte da verdade para formatação é este módulo.

### Localização

O código-fonte do módulo compartilhado reside em: `sinprfes-site-api/shared/format/index.js`.

### Funções Disponíveis

O módulo exporta um conjunto de funções puras para normalização e formatação, incluindo:
- `onlyDigits`
- `formatCpf`
- `formatTelefone`
- `formatCep`
- `normalizeCpf`
- `normalizeTelefone`
- `normalizeCep`

### Restrições Críticas

- **Sem DOM/UI:** O módulo não pode conter nenhuma referência a `window`, `document` ou qualquer API de UI.
- **Sem Dependências na Raiz:** Nenhuma dependência para este módulo pode ser adicionada ao `package.json` da raiz do projeto.

### Consumo no App Mobile

O app mobile consome este módulo como um pacote local para garantir que o Metro bundler o resolva corretamente em ambientes de monorepo, especialmente no Windows.

1.  **Dependência Local:** A dependência é declarada em `mobile/package.json`:
    ```json
    "dependencies": {
      "@sinprfes/shared-format": "file:../shared/format"
    }
    ```

2.  **Wrapper TypeScript:** Para manter a consistência e a clareza, o app utiliza um wrapper que reexporta as funções do módulo CommonJS em: `mobile/src/shared/formatters.ts`.

### Nota sobre Windows e Monorepo (Metro Bundler)

Para garantir que o Metro consiga resolver o pacote local (que é um symlink), uma configuração específica é necessária em `mobile/metro.config.js`. Este arquivo habilita o suporte a symlinks e adiciona a pasta do módulo compartilhado aos `watchFolders`.

### Comandos de Instalação e Execução

Para garantir que as dependências locais sejam corretamente instaladas e que o cache do Metro seja limpo, utilize os seguintes comandos a partir da raiz do repositório:

```bash
# 1. Navegue até a pasta do mobile e instale as dependências
cd mobile
npm install

# 2. Inicie o app limpando o cache do Metro
npx expo start -c
```

---

## Atualização de Filiados (PUT /api/filiados/:id)

Para garantir a integridade dos dados e a compatibilidade com o backend, o payload enviado para a atualização de filiados passa por um processo de normalização e filtragem.

### Regras de Normalização do Payload

-   **Campos Numéricos:** Campos como `telefone1`, `telefone2`, e `cep` têm todos os caracteres não numéricos removidos. Apenas os dígitos são enviados.
-   **CPF de Dependentes:** O CPF de cada dependente (`depX_cpf`) também é normalizado para conter apenas dígitos.
-   **Datas:** As datas devem ser enviadas no formato `YYYY-MM-DD`. O app garante que datas inválidas não sejam enviadas.

### Campos Não Editáveis

O payload **não inclui** campos que são controlados pelo sistema ou que não devem ser alterados pelo usuário, tais como:
- `id`, `cpf`, `nome`
- `lotacao`, `situacao_funcional`
- `perfil_acesso`
- Campos de endereço preenchidos automaticamente (`logradouro`, `cidade`, etc.)

## Publicações

O acesso à seção de Publicações foi alinhado com o padrão do site, utilizando endpoints autenticados para garantir a segurança dos documentos.

### Fluxo de Acesso

1.  **Listagem:** A lista de arquivos e pastas é obtida através do endpoint `GET /api/publicacoes`. O app suporta a navegação entre pastas.
2.  **Download Seguro:** Ao abrir um arquivo, o app utiliza o endpoint `GET /api/publicacoes/arquivo/:id`, enviando o token de autenticação do usuário. Isso elimina a dependência de links públicos (`webViewLink`).
3.  **Armazenamento Temporário:** O arquivo é baixado para um diretório de cache temporário no dispositivo usando o `expo-file-system`.
4.  **Abertura:** Após o download, o arquivo é aberto utilizando a funcionalidade nativa de compartilhamento do sistema operacional (`expo-sharing`).

## Debug

Para facilitar o diagnóstico de problemas durante o desenvolvimento:
- **Payload de Atualização:** O payload final, normalizado e filtrado, que é enviado para a API de atualização de filiados, é impresso no console apenas em modo de desenvolvimento (`__DEV__`).
- **Erros de API:** Em modo de desenvolvimento, a resposta completa de erros da API (incluindo o `status` e o `data`) é impressa no console para fornecer um contexto detalhado do problema.

---

## Correções de Regressão e Melhoras

### Utilitários de Data

O `mobile/src/utils/date.ts` provê helpers robustos para conversão de datas entre os formatos ISO (`YYYY-MM-DD`) e brasileiro (`DD/MM/YYYY`). A função `toBrazilianDate` trata strings de data completas (com timestamp) e retorna uma string vazia para entradas inválidas, evitando crashes.

### Comportamento de Publicações

O fluxo da tela de Publicações foi ajustado para melhorar a experiência do usuário e a compatibilidade:
-   **Visualização Padrão:** Clicar em um arquivo agora tenta abri-lo para visualização direta usando o `webViewLink`.
-   **Download Opcional:** O download é uma ação secundária, acionada por um ícone de "download" dedicado.

### Compatibilidade com Expo SDK 54

Para resolver um erro de método depreciado no Expo SDK 54, o serviço que realiza o download de arquivos foi atualizado para importar o `expo-file-system` a partir do endpoint legado:
`import * as FileSystem from 'expo-file-system/legacy';`

---

## Correções de Regressão e Melhoras (v2)

### Tela "Meus Dados"
-   **Data de Nascimento:** A data de nascimento do titular agora é exibida no card de informações do cabeçalho.
-   **Campos de Endereço Read-Only:** Os campos `Logradouro`, `Cidade` e `UF` agora são apenas leitura (`editable=false`), pois são preenchidos exclusivamente pela funcionalidade de busca de CEP.
-   **Estilo do Picker de Lotação:** O fundo do seletor de lotação foi corrigido para branco quando está em modo de edição, indicando claramente que é um campo interativo.

### Tela "Editar Filiado" (Gestão)
-   **Data de Nascimento:** O campo de data de nascimento do filiado agora é exibido (apenas leitura) no formulário de edição.
-   **Situação Funcional:** Foi corrigido um bug onde o seletor de "Situação Funcional" sempre voltava para "Ativo". O componente agora é controlado e reflete corretamente o estado atual do filiado (ex: "Veterano").

### Publicações
-   **Visualização Segura:** O fluxo de publicações foi alinhado com o do site. Clicar em um arquivo agora inicia um download seguro e autenticado via `GET /api/publicacoes/arquivo/:id`, que é aberto em seguida, em vez de usar um link público (`webViewLink`).
-   **Compatibilidade com Expo SDK 54:** O serviço de download foi atualizado para usar `expo-file-system/legacy`, resolvendo um erro de depreciação.
