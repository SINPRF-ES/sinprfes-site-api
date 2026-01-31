# Clone Manual: SINPRF-ES to FENAPRF

This document describes the functional architecture and business logic of the SINPRF-ES repository, intended to guide the reimplementation of its features in the FENAPRF project.

## 1. Visão Geral do Projeto

### Finalidade
O sistema consiste em uma plataforma integrada (Site e App) para a gestão e comunicação de um sindicato de policiais rodoviários federais. Ele serve como o canal oficial para acesso a informações restritas, participação em assembleias digitais, votações e serviços administrativos.

### Público-alvo
- **Filiados:** Membros do sindicato (ativos, aposentados e pensionistas) que consomem conteúdo e participam de decisões.
- **Gestores (Diretoria/Funcionários):** Responsáveis pela administração de dados, publicações e condução de processos deliberativos.

### Diferença de Papel entre Site e App
- **Site (Área Interna):** Focado em gestão administrativa pesada, visualização de relatórios detalhados, auditoria e configuração de votações complexas.
- **App Mobile:** Focado na experiência do filiado, oferecendo conveniência através de notificações push, acesso biométrico, consulta rápida ao diretório e participação em tempo real em assembleias.

### Fluxo Geral de Uso
1. **Autenticação:** O usuário acessa via CPF e senha. Se configurado, o 2FA (TOTP) é exigido.
2. **Consumo de Informação:** A Home apresenta as últimas notícias e publicações.
3. **Participação:** O usuário recebe notificações sobre novas votações ou assembleias e participa diretamente pelo app ou site.
4. **Gestão de Perfil:** O usuário mantém seus dados e dependentes atualizados para fins de cadastro sindical.

## 2. Arquitetura em Alto Nível

### Backend (API)
- **Tecnologia:** Node.js com framework Express.
- **Banco de Dados:** PostgreSQL para persistência de dados estruturados (usuários, votos, tokens, logs).
- **Armazenamento:** Integração profunda com Google Drive para servir arquivos (PDFs, imagens de notícias, editais).
- **Tempo Real:** Socket.io para atualização sincronizada de estados de assembleia e votações.
- **Segurança:** Rate limiting, sanitização de inputs e auditoria de ações críticas.

### Frontend Web
- **Tecnologia:** JavaScript (Vanilla), HTML5 e CSS3.
- **Papel:** Interface administrativa e portal do filiado para desktops. Suporta modo "embed" para exibição simplificada dentro do app.

### App Mobile
- **Tecnologia:** React Native via Expo.
- **Papel:** Interface principal de consumo para o filiado. Implementa funcionalidades nativas como Biometria e Push Notifications.

### Comunicação
A comunicação é feita via requisições REST (JSON) e WebSockets para eventos de baixa latência.

### Autenticação e Persistência
- **Conceito:** Baseada em JSON Web Tokens (JWT).
- **Sessão:** O token é armazenado localmente (localStorage no web, SecureStore no mobile) e enviado no header `Authorization`.

## 3. Modelo de Usuários e Perfis

O sistema utiliza Controle de Acesso Baseado em Funções (RBAC). Os perfis e permissões são:

- **ADMIN:** Acesso irrestrito a todas as funcionalidades e configurações do sistema.
- **DIRETORIA:** Gestão de filiados, visualização de dados gerais, gerenciamento de votações, push e conteúdo.
- **FUNCIONARIO:** Focado na operação administrativa: gestão de filiados e envio de push.
- **ORGANIZADOR:** Perfil específico para gestão de eventos e jogos, com acesso a inscrições e listagem de filiados.
- **FILIADO:** Perfil padrão. Acesso ao diretório (limitado), visualização e edição dos próprios dados e participação em votações.
- **COMUNICADOR:** Focado em conteúdo. Permissão para editar blocos de texto e visualizar dados próprios.

### Regras de Permissão
- **Visualização:** Filiados veem apenas dados públicos de outros membros (nome, lotação, telefone, avatar). Gestores veem dados completos incluindo CPF e dependentes.
- **Ação:** Apenas gestores podem criar votações ou arquivar membros. O sistema retorna `403 Forbidden` caso um perfil tente acessar um endpoint não autorizado por sua role.

## 4. Módulos Funcionais

### 4.1 — Autenticação e Segurança
- **Descrição:** Gerencia o acesso ao sistema e a integridade da sessão.
- **Acesso:** Público (Login/Esqueci Senha), Autenticado (2FA/Troca de Senha).
- **Onde aparece:** Site e App.
- **Fluxo do Usuário:**
  1. Digita CPF e Senha.
  2. Se o 2FA estiver ativo, solicita o código de 6 dígitos do app autenticador.
  3. Recebe um JWT para as próximas requisições.
- **Regras de Negócio:**
  - Bloqueio de acesso se o cadastro estiver "Arquivado".
  - Rate limit em tentativas de login (proteção contra brute-force).
  - Senhas armazenadas com Bcrypt.
- **Estados Possíveis:** Logado, Deslogado, Aguardando 2FA.
- **Dependências:** Banco de dados PostgreSQL.

### 4.2 — Gestão de Filiados (Módulo Core)
- **Descrição:** Cadastro central de membros do sindicato e seus dependentes.
- **Acesso:** Gestores (CRUD completo), Filiado (Leitura do diretório e edição dos próprios dados).
- **Onde aparece:** Site (Gestão) e App (Diretório e Meus Dados).
- **Fluxo do Usuário:**
  - **Gestor:** Cria novo filiado informando dados pessoais, lotação e situação (Ativo/Aposentado/etc).
  - **Filiado:** Acessa "Meus Dados" para atualizar telefone, e-mail, endereço ou gerenciar até 5 dependentes.
- **Regras de Negócio:**
  - **Compactação de Dependentes:** Se o usuário deletar o dependente 2 mas manter o 3, o sistema move automaticamente o 3 para a posição 2 ao salvar.
  - **Privacidade:** Filiados não veem CPFs de outros filiados no diretório.
  - **Campos Editáveis:** O filiado pode editar sua própria "Lotação" (regra específica), mas não seu "Perfil de Acesso" ou "CPF".
  - **Auditoria:** Mudanças críticas (Arquivar/Desarquivar) geram logs na tabela de eventos.
- **Estados Possíveis (Cadastro):** Ativo, Arquivado (Inativo).
- **Dependências:** Essencial para todos os outros módulos que dependem de `user_id`.

### 4.3 — Notícias e Publicações (Google Drive CMS)
- **Descrição:** Sistema de conteúdo dinâmico baseado em pastas do Google Drive.
- **Acesso:** Leitura para todos; Escrita via Google Drive (fora do sistema).
- **Onde aparece:** Site e App.
- **Fluxo do Usuário:**
  1. O usuário abre a aba Notícias ou Publicações.
  2. O backend lista pastas no Drive.
  3. Para Notícias, busca `post.json` (corpo Markdown), `cover.jpg` e a pasta `gallery/`.
- **Regras de Negócio:**
  - **Cache:** A listagem deve ser eficiente para não estourar a cota da API do Drive.
  - **Filtro Técnico:** Pastas com nomes técnicos (ex: "App", "Noticias") são filtradas na visualização de "Publicações".
- **Estados Possíveis:** Publicado (pasta existe e tem post.json).
- **Dependências:** `drive.service.js`, credenciais do Google Cloud.

### 4.4 — Notificações Push
- **Descrição:** Disparo de mensagens diretas para os dispositivos móveis dos filiados.
- **Acesso:** Gestores (ADMIN, DIRETORIA, FUNCIONARIO).
- **Onde aparece:** Site (Envio) e App (Recebimento).
- **Fluxo do Usuário:**
  1. Gestor escolhe o destino (ex: "Todos", "Lotação: Serra", "Filiado Específico").
  2. Escreve título e corpo.
  3. Sistema resolve os tokens e envia via Expo.
- **Regras de Negócio:**
  - **Targeting:** Suporta filtros por situação (ATIVOS, VETERANOS), lotação ou individual.
  - **Sanitização:** Limite de 60 caracteres no título e 240 no corpo.
  - **Histórico:** Cada disparo é registrado no banco com o status de entrega.
- **Estados Possíveis:** ENVIADO, FALHOU.
- **Dependências:** `expo-server-sdk`, tokens registrados pelos usuários no App.

### 4.5 — Votações Gerais
- **Descrição:** Votações assíncronas sobre temas gerais do sindicato.
- **Acesso:** Gestores (Criar/Gerenciar), Filiados (Votar).
- **Onde aparece:** Site e App.
- **Fluxo do Usuário:**
  1. O filiado recebe notificação de nova votação.
  2. Escolhe uma opção.
  3. Recebe um comprovante (UUID) e o voto é registrado.
- **Regras de Negócio:**
  - **Janela de Tempo:** O voto só é permitido se `NOW()` estiver entre `abre_em` e `encerra_em`.
  - **Unicidade:** Bloqueio via banco de dados para garantir apenas 1 voto por usuário por votação.
  - **Sigilo:** O sistema armazena quem votou e o resultado, mas o link nominal entre usuário e opção pode ser protegido conforme a configuração.
- **Estados Possíveis:** AGENDADA, ABERTA, ENCERRADA.
- **Dependências:** `filiados` (para autenticação).

### 4.6 — Assembleias Virtuais (Módulo Complexo)
- **Descrição:** Sistema de deliberação em tempo real com quórum dinâmico.
- **Acesso:** Gestores (Presidente/Secretário), Filiados (Participantes).
- **Onde aparece:** App (Principal interface de participação) e Site (Painel da Mesa).
- **Fluxo do Usuário:**
  1. **Edital:** A assembleia é criada com um PDF obrigatório.
  2. **Check-in (Quórum):** O gestor gera um token de 6 dígitos. O filiado deve digitar o token no App para marcar presença.
  3. **Mesa:** O gestor define quem é o Presidente e o Secretário (devem estar presentes).
  4. **Propostas:** Participantes podem enviar propostas em texto.
  5. **Votação por Item:** O Presidente abre uma votação de um item ou proposta. Apenas quem fez check-in *naquele* snapshot de quórum pode votar.
  6. **Fila de Fala:** Usuários "pedem a palavra" e entram em uma fila gerenciada pela mesa.
- **Regras de Negócio:**
  - **Snapshots de Quórum:** Cada votação é vinculada a um quórum específico. Se um usuário chegar atrasado e houver uma nova "recontagem", ele passa a ser elegível para os próximos itens.
  - **Abstenção Automática:** Se o usuário fez check-in mas não votou em um item antes do tempo acabar, o sistema registra "ABSTENÇÃO".
  - **Auditoria Append-Only:** Toda ação (abrir votação, conceder palavra) é registrada em log imutável.
- **Estados Possíveis:** CRIADA, ABERTA, EM_CURSO, ENCERRADA.
- **Dependências:** `Socket.io` (Real-time), `filiados` (Elegibilidade).

### 4.7 — Requerimento de Ressarcimento
- **Descrição:** Formalização de pedidos de reembolso para despesas sindicais.
- **Acesso:** Filiados (Criar), Sindicato (Receber via e-mail).
- **Onde aparece:** App e Site.
- **Fluxo do Usuário:**
  1. Preenche dados de viagem/despesa e valores (diárias, KM, outros).
  2. Anexa comprovantes (fotos/PDF).
  3. O sistema gera um PDF consolidado e envia por e-mail para o sindicato.
- **Regras de Negócio:**
  - **Cálculo Automático:** O sistema deve somar diárias e KM com base em valores paramétricos.
  - **Consolidação:** Os anexos são mesclados em um único arquivo PDF para facilitar o arquivamento.
- **Estados Possíveis:** Solicitado.
- **Dependências:** `pdf-lib` / `pdfkit`, `nodemailer` / `resend`.

### 4.8 — Onboarding (Filie-se)
- **Descrição:** Fluxo de pré-filiação para novos membros.
- **Acesso:** Público.
- **Onde aparece:** Site.
- **Fluxo do Usuário:**
  1. Preenche ficha cadastral completa.
  2. Sistema gera PDF da ficha de filiação.
  3. Envia para o e-mail do interessado e do sindicato.
- **Regras de Negócio:**
  - **Sem Persistência:** Neste projeto, o dado não entra direto no banco (proteção contra spam), sendo enviado apenas via e-mail para validação manual.
- **Dependências:** `email.service.js`.

### 4.9 — Blocos de Conteúdo (CMS-Lite)
- **Descrição:** Gestão de pequenos trechos de texto na interface (Ex: banners, avisos).
- **Acesso:** Gestores e Comunicadores.
- **Onde aparece:** Site e App.
- **Regras de Negócio:**
  - Permite alterar textos institucionais sem necessidade de novo deploy de código.

## 5. Diferenças entre Site e App

### Exclusivo do App
- **Notificações Push:** Recebimento nativo e navegação profunda (Deep Linking) para notícias ou votações.
- **Biometria:** Bloqueio de segurança opcional usando FaceID/TouchID.
- **Verificador de Atualizações:** Diálogo mandatório se a versão do app (APK) estiver obsoleta em relação ao manifest no Drive.
- **Offline Parcial:** Cache de notícias e dados de perfil via React Query.

### Exclusivo do Site
- **Gestão de Votações:** Interface para criação e acompanhamento de resultados.
- **Auditoria:** Visualização de logs de sistema e eventos de assembleia.
- **Configuração de CMS:** Interface para edição dos blocos de conteúdo.
- **Relatórios:** Geração e download de relatórios em PDF (Assembleias, Filiados).

### Comum (UX Diferente)
- **Assembleia:** No app, a interface é focada em participação rápida (voto SIM/NAO, pedir palavra). No site, a interface permite ao Presidente gerenciar a mesa e a pauta simultaneamente.

## 6. Fluxos Críticos (end-to-end)

### 6.1 — Ciclo de Vida de uma Assembleia
1. **Preparação:** ADMIN cria a assembleia no site, faz o upload do edital (PDF) para o Drive e agenda a data.
2. **Convocação:** Sistema envia Push para todos os filiados.
3. **Início:** Na hora marcada, o Presidente "Abre" a assembleia.
4. **Presença:** Filiados abrem o App, entram na Assembleia e digitam o token de quórum fornecido pelo Presidente.
5. **Deliberação:** Presidente abre votação de um item. App dos filiados habilitados (com check-in) mostra botões de voto por 5 minutos.
6. **Encerramento:** Presidente encerra a assembleia. Sistema gera o relatório nominal de votos e presenças.

### 6.2 — Atualização de Dados e Dependente
1. **Ação:** Filiado entra em "Meus Dados" no App.
2. **Alteração:** Adiciona um novo dependente e altera seu endereço.
3. **Salva:** Sistema compacta a lista de dependentes e atualiza o timestamp `atualizado_em`.
4. **Visibilidade:** O novo endereço já reflete imediatamente em qualquer documento (ex: PDF de Ressarcimento) gerado a partir de então.

### 6.3 — Publicação de Notícia
1. **Ação:** Gestor cria uma pasta no Drive dentro de `/Noticias/`.
2. **Conteúdo:** Sobe `post.json`, `cover.jpg` e fotos na pasta `gallery`.
3. **Reflexo:** O backend detecta a nova pasta. O App mostra a notícia na Home. O gestor dispara um Push manual vinculando ao ID da notícia.

## 7. Pontos de Parametrização

Para o projeto FENAPRF, os seguintes pontos devem ser configuráveis (via `.env` ou tabela de configurações):
- **Nomenclatura de Perfis:** Embora o código use ADMIN/DIRETORIA, as etiquetas de exibição devem ser parametrizáveis.
- **IDs de Pastas do Drive:** As constantes de "Noticias", "Publicações" e "Editais" devem vir de variáveis de ambiente.
- **Opções de Lotação:** A lista de Delegacias/Lotações deve ser dinâmica ou facilmente editável em arquivo compartilhado.
- **Limites de Push:** Máximo de caracteres em títulos/corpos.
- **Prazos de Votação:** Tempo padrão para votações de assembleia (ex: 300 segundos).

## 8. O que NÃO deve ser clonado automaticamente

- **Cores e Identidade Visual:** O SINPRF-ES usa uma paleta específica; a FENAPRF terá a sua própria.
- **Links Institucionais:** Endereços de redes sociais e e-mails de contato específicos do ES.
- **Estrutura de Lotações Regional:** As delegacias citadas no código (ex: Serra, Linhares) são geográficas do ES e não fazem sentido para uma Federação Nacional.
- **IDs de Documentos Google:** Nunca reutilizar os IDs de arquivos ou pastas do sindicato local.

## 9. Estratégia de Implementação em Blocos

### Bloco 1: Fundação (Auth + Perfis)
- **Pré-requisitos:** Banco de dados PG, Estrutura de JWT.
- **Funcional ao final:** Login via CPF, troca de senha, validação de permissões por role.

### Bloco 2: Cadastro (Filiados)
- **Pré-requisitos:** Bloco 1.
- **Funcional ao final:** CRUD de filiados, gestão de dependentes, diretório de membros.

### Bloco 3: Conteúdo (Drive + Notícias)
- **Pré-requisitos:** Credenciais Google Cloud.
- **Funcional ao final:** Listagem de notícias e documentos direto do Drive no Site e App.

### Bloco 4: Comunicação (Push Notifications)
- **Pré-requisitos:** App configurado com Expo/FCM.
- **Funcional ao final:** Envio de alertas segmentados para os usuários.

### Bloco 5: Deliberação (Votações + Assembleias)
- **Pré-requisitos:** Bloco 1, Bloco 4 (para notificações), Socket.io.
- **Funcional ao final:** Realização de assembleias em tempo real e votações assíncronas.

### Bloco 6: Serviços (Ressarcimento + Onboarding)
- **Pré-requisitos:** Bloco 2, Bloco 3 (para templates/PDFs).
- **Funcional ao final:** Envio de fichas de filiação e pedidos de reembolso.

## 10. Observações Finais

### Armadilhas Comuns
- **Cota do Google Drive:** O sistema depende fortemente da listagem de arquivos. É vital implementar cache ou minimizar chamadas redundantes.
- **Inconsistência de Socket:** Em conexões instáveis de celular, o estado da assembleia pode "piscar". O uso de uma função de `buscarEstadoCompleto` (Diagnóstico) para resincronizar é fundamental.
- **Merge de PDF:** O processo de anexar fotos em um PDF de ressarcimento pode consumir muita memória se as fotos forem de alta resolução. Recomenda-se redimensionar no cliente ou no backend.

### Decisões de Design
- **Foco em Mobile:** A lógica de assembleia foi desenhada para que o filiado nunca precise sair do App, inclusive para ler o edital (PDF Viewer integrado).
- **Simplicidade do Web:** O frontend web não utiliza frameworks complexos (React/Vue), o que facilita a manutenção de páginas legadas e o tempo de carregamento.
- **Segurança Pragmática:** O sistema não tenta ser um ERP completo; ele foca em ser uma ferramenta de comunicação segura e deliberação jurídica válida para um sindicato.
