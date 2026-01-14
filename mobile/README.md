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
  - Procure pelo endereço que se parece com `192.168.x.x`.

### 2.3. Configurando o Arquivo `.env`
No seu arquivo `.env`, a variável `API_BASE_URL` deve ser configurada da seguinte forma (substitua `SEU_IP_AQUI` pelo IP encontrado):

```
# Exemplo para teste em dispositivo físico
API_BASE_URL=http://192.168.1.5:3000
```
**Importante:** Seu computador e seu celular devem estar conectados à mesma rede Wi-Fi.

## 3. Troubleshooting e Diagnóstico

### 3.1. Erro de "Worklets Mismatch"
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
  2. Nesta tela, você pode visualizar, copiar para a área de transferência ou limpar os logs armazenados no dispositivo.
- **Quando Usar:** Se você encontrar um bug, use o botão **"Copiar Logs"** e envie o texto para a equipe de desenvolvimento. Isso fornecerá o contexto necessário para identificar e resolver o problema.

## 4. Matriz de Paridade com o Site

| Recurso                 | Status    | Observações                                                                        |
|-------------------------|-----------|------------------------------------------------------------------------------------|
| Autenticação (JWT)      | `OK`      | Fluxo de login, 2FA e armazenamento de sessão implementados.                       |
| Meus Dados (GET/PUT)    | `OK`      | Tela implementada para visualização e edição dos próprios dados.                   |
| Listagem de Filiados    | `OK`      | Busca em tempo real na API com diferenciação de dados por perfil.                  |
| Gestão de Filiados      | `Parcial` | Telas de criação/edição criadas; lógica de arquivar/desarquivar pendente.        |
| Dependentes (até 5)     | `OK`      | Campos adicionados nos formulários de criação e edição.                            |
| Avatar Upload           | `Pendente`| Lógica de upload de imagem (`multipart/form-data`) precisa ser implementada.         |
| Fluxo de Primeiro Acesso| `Pendente`| Requer análise do fluxo exato no backend/site.                                     |

## 5. Roadmap Técnico: Módulo de Votação
...

## 6. Checklist de Testes Manuais
...
