SINPRF-ES – Sistema de Filiação + Área Restrita + API

Backend oficial do Sindicato dos Policiais Rodoviários Federais do Espírito Santo, incluindo:

Site público (HTML + CSS + JS)

API em Node.js (Express)

Banco PostgreSQL (Railway)

Envio de e-mails + PDF automático

Autenticação com JWT

Fluxo de primeiro acesso

Preparado para integração futura com Login do gov.br

---

## 🚀 Tecnologias utilizadas

Node.js + Express

PostgreSQL (Railway)

PDFKit (geração de PDF)

Nodemailer (SMTP)

Bcrypt + JWT

Arquitetura MVC + Services

Hospedagem no Render

Site estático via /public

---

## 📦 Estrutura do Repositório (Monorepo Híbrido)

Este repositório é **híbrido (monorepo simples)**, contendo **backend e mobile no mesmo repositório**, porém com **responsabilidades totalmente separadas**.

### Estrutura geral

```
/
├─ server.js
├─ app.js
├─ package.json        # Backend (API)
├─ package-lock.json   # Backend (API)
├─ scripts/
├─ public/             # Site institucional
├─ src/                # Backend (controllers, services, routes etc.)
└─ mobile/             # Aplicativo Mobile (Expo / React Native)
   ├─ package.json
   ├─ app/
   ├─ assets/
   ├─ components/
   └─ ...
```

### Regra fundamental do monorepo

> **O backend (raiz do projeto) e o mobile (`/mobile`) são projetos independentes que apenas compartilham o mesmo repositório.**

* O **backend**:

  * é a **fonte única da verdade**;
  * é o **único projeto buildado no Render**;
  * **não pode conter dependências de UI/mobile** (React, Expo, React Native, navegação etc.).

* O **mobile**:

  * vive exclusivamente em `/mobile`;
  * possui seu **próprio `package.json`**;
  * é buildado localmente ou via **EAS Build**;
  * consome a API do backend, sem lógica de negócio própria.

### 🚫 Proibição explícita

É **estritamente proibido** adicionar ao `package.json` da raiz (backend):

* `react`, `react-dom`, `react-native`, `expo`
* `@react-navigation/*`
* `@react-native-*`
* `react-query` / `@tanstack/react-query`
* qualquer dependência de UI, navegação ou hooks visuais

Essas dependências **devem existir somente em `/mobile/package.json`**.

> Para evitar regressões, existe um **guardrail automático** (`scripts/check-root-deps.js`) que **bloqueia o build** caso dependências de mobile sejam adicionadas ao backend.

---

## 🏛️ Arquitetura de 3 Camadas

O sistema é estruturado em três camadas distintas, cada uma com sua responsabilidade:

1. **Backend (API)**

   * **Fonte Única da Verdade**: Todas as regras de negócio, permissões de acesso e validações de dados estão centralizadas aqui.
   * **Tecnologia**: Node.js com Express.
   * **Responsabilidade**: Gerenciar o banco de dados, autenticar usuários e servir dados de forma segura para os frontends.

2. **Frontend Web**

   * **Interface**: Aplicação web para desktops e navegadores.
   * **Tecnologia**: HTML, CSS e JavaScript (vanilla).
   * **Responsabilidade**: Consumir a API do backend e oferecer a experiência completa para o usuário via navegador.

3. **Mobile App**

   * **Interface**: Aplicativo nativo para Android e iOS.
   * **Tecnologia**: React Native com Expo.
   * **Responsabilidade**: Espelhar as funcionalidades do frontend web, consumindo a mesma API e adaptando a experiência para dispositivos móveis.

> **Observação Importante**: O backend é a autoridade final sobre as regras de negócio. Os frontends (Web e Mobile) são apenas consumidores da API e não devem implementar lógicas de negócio próprias.

---

## 🎭 Regras de Perfil (FILIADO vs. GESTÃO)

### 👤 Perfil FILIADO

* Visualização limitada (nome, lotação, situação funcional).
* Pode editar apenas seus próprios dados permitidos (contato, endereço, dependentes, avatar).

### 🧑‍💼 Perfis de GESTÃO (ADMIN, DIRETORIA, FUNCIONARIO)

* Acesso total aos dados de todos os filiados.
* Permissão para criar, editar, arquivar e gerenciar cadastros.
* A edição é iniciada exclusivamente a partir da lista de filiados, expandindo o item desejado.
* A tela **Diagnóstico** é visível **apenas para ADMIN**.

---

## 🚀 Deploy no Render (Backend)

* **Build Command**: `npm ci`
* **Start Command**: `npm start`
* **Node Version**: definida em `.node-version` (20.11.1)
* **Root Directory**: `/` (não usar `/mobile`)

O Render **não deve** instalar nem considerar dependências do diretório `/mobile`.

---

## 📌 Observação final

Este repositório foi estruturado como **monorepo híbrido por conveniência organizacional**, mas o backend e o mobile devem ser tratados como **projetos independentes em termos de dependências, build e deploy**.

Qualquer violação dessa separação é considerada erro crítico e deve ser bloqueada automaticamente pelo guardrail do projeto.
