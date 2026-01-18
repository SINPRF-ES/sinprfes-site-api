# Sistema SINPRF/ES — Monorepo Híbrido (Backend + Web + Mobile)

Este documento consolida **regras críticas de arquitetura** e **regras explícitas de negócio** (perfis, permissões, estados cadastrais e padronização de formatação) que **devem ser seguidas rigorosamente** por todos os clientes (Site e App Mobile).

---

## 🏛️ Princípio fundamental

> **O backend é a fonte única da verdade.**

- Todas as regras de negócio, permissões, validações e normalizações finais **residem no backend**.
- O frontend web e o app mobile **consomem a mesma API** e devem exibir/operar com **os mesmos conceitos e resultados**.
- Web e Mobile podem aplicar máscaras apenas por **experiência do usuário (UX)**, mas a validação final e a persistência sanitizada são do backend.

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

Todas essas dependências devem existir somente em `/mobile/package.json`.

---

## 🛡️ Guardrail automatico (protecao contra regressao)

Para evitar regressões, o projeto possui um **guardrail automático**:

- Arquivo: `scripts/check-root-deps.js`
- Executado em `preinstall`
- **Bloqueia o build** se dependências de mobile/UI forem adicionadas ao backend

Se o build falhar por esse script, **o erro é intencional** e indica violação da separação de responsabilidades.

---

## 🏛️ Arquitetura de 3 camadas

O sistema é estruturado em três camadas bem definidas:

### 1) Backend (API)

- **Fonte Única da Verdade**
- Centraliza:
  - regras de negócio
  - permissões
  - validações e sanitização
  - integrações
- Tecnologia: Node.js + Express
- Responsável por:
  - banco de dados
  - autenticação
  - integrações com serviços externos

### 2) Frontend Web

- Interface para navegadores
- Tecnologia: HTML, CSS e JavaScript (vanilla)
- Consome exclusivamente a API do backend

### 3) Mobile App

- Aplicativo nativo Android / iOS
- Tecnologia: React Native + Expo
- Espelha funcionalidades do site
- Consome a mesma API do backend

---

## 🎭 Regras de perfil e permissões

O sistema possui quatro perfis funcionais, organizados em dois grupos.

### Perfil FILIADO

**Visualizacao:**
- Pode visualizar **todos os seus próprios dados**.
- Pode visualizar **outros usuários**, porém apenas os campos:
  - Nome
  - Telefone 1
  - Lotacao
  - Situacao funcional

**Edicao (restrita):**
- Nao pode alterar:
  - Nome
  - CPF
- Pode alterar:
  - Contatos (com regras abaixo)
  - Endereco (somente o CEP)
  - Dependentes
  - Avatar

**Regras obrigatorias (FILIADO):**
- Telefone 1 **nao pode ficar em branco**.
- E-mail 1 **nao pode ficar em branco**.
- Endereco:
  - O filiado informa **apenas o CEP**.
  - Logradouro, Cidade e UF sao preenchidos automaticamente via `buscaCEP`.

### Perfis de GESTAO (ADMIN, DIRETORIA, FUNCIONARIO)

Esses três perfis possuem **as mesmas capacidades operacionais**, com uma excecao critica.

**Permissoes comuns (ADMIN, DIRETORIA e FUNCIONARIO):**
- Visualizar **todos os dados de todos os usuarios** (sem restricao de campos).
- Criar novos usuarios.
- Arquivar e desarquivar cadastros.
- Editar dados de qualquer usuario.

**Regra de edicao importante (GESTAO):**
- Perfis de gestao podem alterar **tudo de todos**, **exceto** os campos de endereco preenchidos por `buscaCEP`:
  - Logradouro
  - Cidade
  - UF

Esses campos permanecem exclusivos do fluxo `buscaCEP`, inclusive para gestores.

**Regra exclusiva do ADMIN:**
- Apenas ADMIN pode conceder/remover o perfil ADMIN de outro usuario.
- DIRETORIA e FUNCIONARIO podem conceder perfis **entre si** e para **FILIADO**, mas **nunca ADMIN**.

---

## 📋 Estados e situacoes do usuario (sem ambiguidade)

Cada usuario possui **dois eixos distintos**, que nao devem ser confundidos.

### 1) Estado do cadastro (administrativo)

Define se o registro esta operacionalmente ativo no sistema.

- `CADASTRO_ATIVO`
- `ARQUIVADO`

Caracteristicas:
- Controlado pela gestao.
- Arquivamento:
  - nao apaga dados
  - preserva historico/auditoria
  - e reversivel (desarquivar)

### 2) Situacao funcional

Define a condicao funcional do filiado perante a entidade.

Valores permitidos:
- `ATIVO`
- `VETERANO`
- `PENSIONISTA`

**Importante:**
- Estado do cadastro responde: "Este registro esta ativo no sistema?" (`CADASTRO_ATIVO` / `ARQUIVADO`).
- Situacao funcional responde: "Qual a condicao funcional do filiado?" (`ATIVO` / `VETERANO` / `PENSIONISTA`).

Mesmo que a palavra "ATIVO" exista na situacao funcional, ela **nao se confunde** com `CADASTRO_ATIVO`.

---

## 🎯 Mascaras, sanitizacao e normalizacao

### Campos obrigatoriamente normalizados

- CPF
- Telefones
- CEP
- Datas

### Regra

- O backend deve **sanitizar/validar** e persistir **sempre no formato canonico** (ex.: apenas digitos para CPF/telefone/CEP).
- Web e Mobile podem aplicar **mascaras visuais** (UX), mas nunca devem depender do frontend web para regras.

---

## 🤝 Modulo compartilhado agnostico (reuso entre Web e Mobile)

Para evitar divergencia de mascara/formatacao entre Web e Mobile, o projeto adota um **modulo compartilhado agnostico** (sem DOM, sem React, sem React Native), com **funcoes puras**.

### Objetivo

- Garantir que o app mobile espelhe exatamente as mesmas mascaras e formatacoes do site.
- Evitar duplicacao e drift de regra ao longo do tempo.

### Regras do modulo compartilhado

- Deve ficar em uma pasta comum no repositorio, por exemplo:
  - `shared/format/` (ou equivalente)
- Deve conter somente funcoes puras, por exemplo:
  - `onlyDigits(value)`
  - `formatCpf(value)`
  - `formatTelefone(value)`
  - `formatCep(value)` (se aplicavel)
  - `parseDateToISO(value)` (se aplicavel)
- **Nao pode**:
  - acessar `window`, `document` ou DOM
  - registrar `addEventListener`
  - importar libs de UI
  - criar dependencia no `package.json` da raiz

### Como usar

- Web:
  - Mantem os `addEventListener` e manipulacao de input no `public/js/...`, mas delega a formatacao para funcoes puras do modulo compartilhado.
- Mobile:
  - Usa as mesmas funcoes puras para formatacao em componentes/inputs.

---

## 🚀 Deploy no Render (Backend)

- Build Command: `npm ci`
- Start Command: `npm start`
- Node Version: definida em `.node-version`
- Root Directory: `/` (nunca usar `/mobile`)

O Render nao deve instalar nem considerar dependencias do diretorio `/mobile`.

---

## 📌 Observacao final

Qualquer implementacao que:
- burle permissoes
- duplique regras criticas de forma inconsistente
- gere divergencia entre site e app

E considerada **erro de arquitetura** e deve ser corrigida.

---

## 📱 Funcionalidades Específicas do App Mobile

### Publicações (App) — Navegação e Visualização Segura

A seção "Publicações" no aplicativo móvel replica o comportamento do site, garantindo uma experiência consistente e segura.

- **Navegação por Pastas:** O app permite a navegação hierárquica por pastas, assim como no site. Cada clique em uma pasta recarrega a lista de arquivos e subpastas contidas nela.
- **Visualização Segura de Arquivos:** Para garantir a segurança dos documentos, o app utiliza um fluxo de download autenticado:
  1. Ao clicar em um arquivo, o app faz uma requisição ao endpoint seguro da API (`/api/publicacoes/arquivo/:id`), enviando o token de autenticação do usuário.
  2. O arquivo é baixado para o cache local do dispositivo de forma segura.
  3. Após o download, o app utiliza o sistema de compartilhamento nativo do Android/iOS para abrir o arquivo no visualizador padrão do sistema (leitor de PDF, galeria de imagens, etc.).
- **Fallback (WebView):** Em casos onde o download seguro não é possível ou para links públicos, o app pode utilizar o `WebViewLink` como um fallback para abrir o conteúdo em um navegador.

### Distinção: Situação Funcional vs. Status do Cadastro

Para evitar ambiguidades, o sistema diferencia claramente dois conceitos:

- **Status do Cadastro:** Refere-se ao estado administrativo do registro do usuário no sistema (ex: `CADASTRO ATIVO`, `ARQUIVADO`). Este status é controlado pela gestão.
- **Situação Funcional:** Descreve a condição profissional do filiado (ex: `ATIVO`, `VETERANO`, `PENSIONISTA`).

A listagem de filiados no app mobile agora inclui filtros para ambos os eixos, permitindo uma busca mais granular e precisa.

### Remoção de Defaults Indevidos (“ATIVO”) na UI

As interfaces do site e do app foram corrigidas para não mais assumir "ATIVO" como um valor padrão para a **Situação Funcional**.

- **Exibição:** Se o backend não fornecer um valor para a `situacao_funcional`, a UI exibirá "NÃO INFORMADO" (ou um estado visualmente neutro), em vez de incorretamente exibir "ATIVO".
- **Edição:** Nos formulários de edição, o campo de seleção para a `situacao_funcional` agora reflete corretamente o valor atual do filiado, sem forçar um valor padrão que poderia levar a salvamentos incorretos de dados.
