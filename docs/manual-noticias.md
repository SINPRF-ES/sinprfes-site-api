# Manual do Módulo de Notícias - SINPRF-ES

Este documento descreve o funcionamento, a gestão e o consumo do módulo de Notícias, integrado entre o Aplicativo Móvel, o Painel Administrativo e o Site Institucional.

---

## 1. Visão Geral
O sistema de notícias foi desenvolvido para ser a fonte única de comunicação oficial do sindicato. Ele permite que a gestão publique conteúdos ricos (texto formatado, imagens e vídeos) que são replicados instantaneamente para todos os filiados.

### Arquitetura
- **Base de Dados:** PostgreSQL (Tabelas `noticias` e `noticia_midias`).
- **Armazenamento de Mídia:** Cloudinary (Otimização automática de imagens e vídeos).
- **Consumo:** API REST integrada ao App e Site.

---

## 2. Perfis e Permissões
O acesso às funcionalidades é controlado pelo perfil do usuário:

| Perfil | Visualização | Gestão (Criar/Editar/Excluir) |
| :--- | :--- | :--- |
| **Filiado** | Apenas notícias **PUBLICADAS** | Não |
| **Gestão (Admin, Diretoria, Funcionário)** | Todas (inclusive rascunhos) | Sim |
| **Comunicador** | Todas (inclusive rascunhos) | Sim |

---

## 3. Gestão de Notícias (Via Aplicativo)

A produção de conteúdo é feita exclusivamente pelo aplicativo móvel para facilitar a captura de fotos e vídeos em eventos.

### 3.1 Criar uma Nova Notícia
1. Acesse o App com um perfil de gestão.
2. No menu principal ou na tela de **Notícias**, clique no botão flutuante **"+"** (Nova Notícia).
3. Preencha os campos:
   - **Título:** Chamada principal da notícia.
   - **Conteúdo:** Texto da matéria. Suporta formatação **Markdown** (negrito, listas, links).
4. Clique em **Salvar Rascunho**.
   - *Nota: A notícia deve ser salva uma vez antes de permitir o upload de mídias.*

### 3.2 Upload de Mídias
Dentro do editor de uma notícia já salva:
- **Capa da Notícia:** Clique em "Selecionar Capa" para escolher a imagem principal que aparecerá na listagem.
- **Mídias Adicionais (Galeria):** Clique no ícone de "+" na seção de mídias para adicionar fotos ou vídeos à galeria interna da notícia.

#### Regras de Mídia:
- **Imagens:** Formatos JPG, PNG, WEBP. São otimizadas automaticamente para web.
- **Vídeos:**
  - Duração máxima: **30 segundos**.
  - Tamanho máximo: **50 MB**.
  - Formato: MP4 ou MOV.

### 3.3 Publicação
Uma notícia recém-criada entra em estado de **RASCUNHO** e fica visível apenas para a equipe de gestão.
Para torná-la pública:
1. Abra a notícia no Editor.
2. Verifique se todo o conteúdo e mídias estão corretos.
3. Clique em **Publicar Agora**.
   - Uma vez publicada, ela aparecerá no feed de todos os usuários e no site institucional.

---

## 4. Visualização no Aplicativo

### Feed de Notícias
- Localizado no menu lateral ou atalho na Home.
- Exibe cards com a capa, data de publicação, título e um breve resumo.
- Notícias em "Rascunho" aparecem com um selo amarelo para gestores.

### Detalhe da Notícia
- Exibe o conteúdo completo.
- Galeria de mídias ao final do texto.
- Vídeos exibem um preview e podem ser reproduzidos (dependendo da integração do player).

---

## 5. Visualização no Site Institucional

As notícias publicadas são espelhadas automaticamente na página `noticias.html` do site.

- **URL:** `https://portal.sinprfes.org.br/noticias.html`
- **Funcionamento:** O site carrega as notícias via API. Caso o usuário não esteja logado, ele verá apenas os títulos ou uma solicitação de login (dependendo da configuração de privacidade vigente).

---

## 6. Guia Técnico (Desenvolvedores)

### Endpoints da API (`/api/noticias`)
- `GET /`: Lista notícias (filtra por status=PUBLICADA para usuários comuns).
- `GET /:id`: Detalhes completos de uma notícia e suas mídias.
- `POST /`: Cria novo rascunho (Gestão).
- `PUT /:id`: Atualiza dados da notícia (Gestão).
- `POST /:id/publicar`: Altera status para PUBLICADA e define data de publicação (Gestão).
- `DELETE /:id`: Remove a notícia e todas as mídias vinculadas (Gestão).

### Cloudinary Signed Upload
O upload de mídias utiliza o fluxo **Signed Upload** para segurança:
1. O App solicita uma assinatura temporária ao backend (`POST /upload-signature`).
2. O App realiza o upload diretamente para o Cloudinary usando a assinatura.
3. O App informa ao backend a URL final da mídia para persistência no banco (`POST /:id/midias_external`).

---

## 7. Solução de Problemas (FAQ)

**Q: Por que não consigo adicionar fotos logo ao abrir a tela de "Nova Notícia"?**
R: É necessário salvar o título e conteúdo primeiro para gerar um ID de referência no banco de dados.

**Q: Meu vídeo foi rejeitado. O que fazer?**
R: Verifique se ele possui mais de 30 segundos ou se o arquivo ultrapassa 50MB. Tente comprimir o vídeo ou selecionar um trecho menor.

**Q: Publiquei por engano. Como reverter?**
R: Entre no editor da notícia e altere o status de volta para "RASCUNHO" (se disponível na interface) ou exclua a notícia e crie uma nova.
