
---

## 🧱 Regra fundamental do monorepo

> **O backend (raiz do projeto) e o mobile (`/mobile`) são projetos independentes que apenas compartilham o mesmo repositório.**

### Backend (raiz do projeto)

- É a **fonte única da verdade** (regras de negócio, permissões, validações).
- É o **único projeto buildado e executado no Render**.
- **NÃO pode conter dependências de UI ou mobile**.

### Mobile (`/mobile`)

- Vive exclusivamente na pasta `/mobile`.
- Possui seu **próprio `package.json`**.
- É buildado localmente ou via **EAS Build**.
- Consome a API do backend, **sem lógica de negócio própria**.

---

## 🚫 Proibição explícita (regra crítica)

É **estritamente proibido** adicionar ao `package.json` da **raiz (backend)** qualquer dependência relacionada a UI/mobile, incluindo (mas não limitado a):

- `react`, `react-dom`, `react-native`, `expo`
- `@react-navigation/*`
- `@react-native-*`
- `react-query` / `@tanstack/react-query`
- qualquer biblioteca de UI, navegação ou hooks visuais

📌 **Todas essas dependências devem existir somente em `/mobile/package.json`.**

---

## 🛡️ Guardrail automático (proteção contra regressão)

Para evitar regressões, o projeto possui um **guardrail automático**:

- Arquivo: `scripts/check-root-deps.js`
- Executado em `preinstall`
- **Bloqueia o build** se dependências de mobile/UI forem adicionadas ao backend

Se o build falhar por esse script, **o erro é intencional** e indica violação da separação de responsabilidades.

---

## 🏛️ Arquitetura de 3 Camadas

O sistema é estruturado em três camadas bem definidas:

### 1️⃣ Backend (API)

- **Fonte Única da Verdade**
- Centraliza:
  - regras de negócio
  - permissões
  - validações
- Tecnologia: Node.js + Express
- Responsável por:
  - banco de dados
  - autenticação
  - integração com serviços externos

### 2️⃣ Frontend Web

- Interface para navegadores
- Tecnologia: HTML, CSS e JavaScript (vanilla)
- Consome exclusivamente a API do backend

### 3️⃣ Mobile App

- Aplicativo nativo Android / iOS
- Tecnologia: React Native + Expo
- Espelha funcionalidades do site
- Consome a mesma API do backend

> ⚠️ **Importante:**  
> Web e Mobile **não implementam regras de negócio próprias**.  
> O backend é a autoridade final.

---

## 🎭 Regras de Perfil

### 👤 Perfil FILIADO

- Visualização limitada:
  - nome
  - lotação
  - situação funcional
- Pode editar apenas:
  - seus próprios contatos
  - endereço
  - dependentes
  - avatar

### 🧑‍💼 Perfis de GESTÃO (ADMIN, DIRETORIA, FUNCIONÁRIO)

- Acesso total aos dados dos filiados
- Pode:
  - criar
  - editar (inclusive nome, CPF e situação funcional)
  - arquivar/desarquivar cadastros
- A edição é iniciada **exclusivamente pela listagem**, expandindo o item desejado
- A tela **Diagnóstico** é visível **apenas para ADMIN**

---

## 🚀 Deploy no Render (Backend)

- **Build Command**: `npm ci`
- **Start Command**: `npm start`
- **Node Version**: definida em `.node-version` (20.11.1)
- **Root Directory**: `/`  
  (⚠️ **Nunca** usar `/mobile`)

O Render **não deve instalar nem considerar dependências do diretório `/mobile`**.

---

## 📌 Observação final

Este repositório foi estruturado como **monorepo híbrido por conveniência organizacional**, porém:

- Backend e Mobile são **projetos independentes**
- Possuem **dependências, build e deploy separados**
- Qualquer mistura dessas responsabilidades é considerada **erro crítico**

Essas regras existem para garantir:
- estabilidade do deploy
- previsibilidade no Render
- coerência entre site, app e backend
