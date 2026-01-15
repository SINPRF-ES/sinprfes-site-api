SINPRF-ES – Sistema de Filiação + Área Restrita + API

Backend oficial do Sindicato dos Policiais Rodoviários Federais do Espírito Santo, incluindo:

Site público (HTML + CSS + JS)

API em Node.js (Express)

Banco PostgreSQL (Railway)

Envio de e-mails + PDF automático

Autenticação com JWT

Fluxo de primeiro acesso

Preparado para integração futura com Login do gov.br

🚀 Tecnologias utilizadas

Node.js + Express

PostgreSQL (Railway)

PDFKit (geração de PDF)

Nodemailer (SMTP)

Bcrypt + JWT

Arquitetura MVC + Services

Hospedagem no Render

Site estático via /public

---

## 🏛️ Arquitetura de 3 Camadas

O sistema é estruturado em três camadas distintas, cada uma com sua responsabilidade:

1.  **Backend (API)**:
    -   **Fonte Única da Verdade**: Todas as regras de negócio, permissões de acesso e validações de dados estão centralizadas aqui.
    -   **Tecnologia**: Node.js com Express.
    -   **Responsabilidade**: Gerenciar o banco de dados, autenticar usuários e servir dados de forma segura para os frontends.

2.  **Frontend Web**:
    -   **Interface**: Aplicação web para desktops e navegadores.
    -   **Tecnologia**: HTML, CSS e JavaScript (vanilla).
    -   **Responsabilidade**: Consumir a API do backend e oferecer a experiência completa para o usuário via navegador.

3.  **Mobile App**:
    -   **Interface**: Aplicativo nativo para Android e iOS.
    -   **Tecnologia**: React Native com Expo.
    -   **Responsabilidade**: Espelhar as funcionalidades do frontend web, consumindo a mesma API e adaptando a experiência para dispositivos móveis.

> **Observação Importante**: O backend é a autoridade final sobre as regras de negócio. Os frontends (Web e Mobile) são apenas consumidores da API e não devem implementar lógicas de negócio próprias.

---

## 🎭 Regras de Perfil (FILIADO vs. GESTÃO)

O acesso às funcionalidades do sistema é rigorosamente controlado por perfis de usuário, garantindo que cada um veja e edite apenas o que é permitido.

### 👤 Perfil `FILIADO` (Padrão)

-   **Visualização Limitada**: Pode ver uma lista simplificada de outros filiados (nome, lotação, situação).
-   **Autoedição**: Pode editar apenas seus próprios dados (contato, endereço, dependentes, avatar).
-   **Restrições**: Não pode ver dados sensíveis de terceiros (CPF, e-mail, etc.) nem realizar ações administrativas.

### 🧑‍💼 Perfis de `GESTÃO` (ADMIN, DIRETORIA, FUNCIONARIO)

-   **Visão Completa**: Acesso total aos dados de todos os filiados.
-   **Edição Completa**: Permissão para criar, arquivar e gerenciar qualquer cadastro no sistema. A edição é iniciada exclusivamente a partir da lista de filiados, expandindo o item desejado.
-   **Ações Administrativas**: Capacidade de alterar perfis de acesso e outras configurações críticas.
-   **Acesso Restrito**: Funcionalidades sensíveis, como a tela de **Diagnóstico**, são visíveis apenas para o perfil `ADMIN`.

---

## 📱 Comportamento Offline do App Mobile

O aplicativo mobile foi projetado para ser funcional mesmo sem conexão com a internet, utilizando um sistema de cache local.

-   **Cache de Dados**: Ao carregar a lista de filiados, os dados são salvos localmente no dispositivo.
-   **Acesso Offline**: Se o usuário estiver sem internet, o app exibe os dados salvos no cache, acompanhados de um aviso "Dados offline".
-   **Sincronização Inteligente**: Ao detectar que a conexão foi restabelecida, o app pergunta ao usuário se ele deseja sincronizar os dados para obter a versão mais recente do servidor.

---

### 🛡️ Segurança de Cache por Perfil

Para evitar o vazamento de dados entre diferentes usuários no mesmo dispositivo, o sistema de cache do aplicativo móvel segue regras de segurança estritas:

-   **Cache por Usuário/Perfil**: A chave de armazenamento para a lista de filiados é dinâmica, incorporando o ID e o perfil do usuário (ex: `filiados_cache_123_ADMIN`). Isso garante que os dados cacheados por um administrador, que são completos, não possam ser acessados por um usuário `FILIADO` que venha a usar o app no mesmo aparelho.
-   **Limpeza no Logout**: Ao realizar o logout, o aplicativo remove ativamente todas as chaves de cache relacionadas a filiados, garantindo que nenhum dado sensível permaneça armazenado no dispositivo.
-   **Ações de Gestão Online-Only**: Enquanto a visualização de dados offline é permitida para todos os perfis (com os dados já sanitizados), as ações de edição e criação de filiados por parte dos perfis de `GESTÃO` são bloqueadas se o dispositivo estiver offline. Uma mensagem informa ao usuário que ele precisa estar conectado para realizar essas operações.

---


📁 Estrutura da aplicação

(Lembrete: esta estrutura é importante para organização e manutenção futura.)

server.js
app.js
public/
src/
  controllers/
  services/
  middleware/
  utils/
  routes/
scripts/

⚙️ Como rodar localmente
1. Instalar dependências
npm install

2. Criar arquivo .env
PORT=3000

DATABASE_URL=postgres://usuario:senha@host:porta/database

JWT_SECRET=algumasegurançaforte

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=sinprfes@sinprfes.org.br
SMTP_PASS=senha
MAIL_FROM=sinprfes@sinprfes.org.br
MAIL_TO_FILIACAO=sinprfes@sinprfes.org.br

3. Rodar servidor
node server.js

## 🚀 Deploy no Render

Para garantir um deploy consistente e seguro no Render, siga estas configurações:

-   **Build Command**: `npm ci`
    -   *Usa o `package-lock.json` para uma instalação determinística, evitando problemas de dependências transitivas que podem ocorrer com `npm install`.*
-   **Start Command**: `npm start`
    -   *Executa o servidor de produção.*
-   **Node Version**: Definida no arquivo `.node-version` (atualmente `20.11.1`). O Render respeitará esta versão.
-   **Root Directory**: O diretório raiz do projeto (`/`). Não configure para `/mobile`, pois este diretório contém um projeto separado que não deve interferir no build do backend.

📡 Endpoints principais
Endpoint	Método	Descrição
/api/primeiro-acesso/iniciar	POST	Inicia fluxo do primeiro acesso
/api/primeiro-acesso/confirmar	POST	Conclui criação de senha
/api/login	POST	Login + JWT
/api/me	GET	Dados do usuário autenticado
/api/filiese	POST	Solicitação de filiação + PDF + e-mail
📨 Envio de e-mail + PDF

Cada ficha enviada gera:

PDF automático (PDFKit)

E-mail enviado ao sindicato com anexo

Se SMTP não estiver configurado, o sistema registra aviso no console.

🔒 Segurança

Hash de senha com Bcrypt

JWT com expiração

2FA opcional (Google Authenticator)

Preparado para Login gov.br

📌 Scripts úteis
Limpeza
node scripts/cleanup.js

📞 Suporte

Em caso de dúvidas, fale com o desenvolvedor responsável (Marcelo Fávero Brandão).

FIM DO README

## Padrão de imports do backend
Este backend está em **CommonJS** (uso de `require()` / `module.exports`).

- Padrão adotado: **imports sem extensão** (ex.: `require("./routes/auth.routes")`).
- Por que: é compatível com o resolver do Node em CommonJS e reduz ruído em diffs.

### Alternativa (se migrar para ESM)
Se no futuro o projeto migrar para `"type": "module"`, recomenda-se:
- padronizar imports com **extensão explícita** (`.js`), pois o ESM é mais rígido.

### Recomendação prática
Não misturar estilos. Se decidir mudar para “sempre .js”, faça de forma global e com testes.
