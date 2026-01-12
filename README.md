SINPRF-ES – Sistema de Filiação, Área Restrita e API

Backend e frontend oficiais do Sindicato dos Policiais Rodoviários Federais do Espírito Santo (SINPRF-ES).

O sistema contempla:

🌐 Site público (HTML + CSS + JS)

🔐 Área restrita de filiados e gestão

🧠 API REST em Node.js (Express)

🗄️ Banco de dados PostgreSQL (Railway)

📄 Geração automática de PDF

✉️ Envio de e-mails

👥 Gestão de filiados, dependentes e status cadastral

🖼️ Upload de avatar (Cloudinary)

🚀 Tecnologias utilizadas

Node.js + Express

PostgreSQL (Railway)

JWT (autenticação)

Bcrypt (hash de senha)

PDFKit (geração de PDF)

Nodemailer (SMTP)

Cloudinary (armazenamento de imagens / avatares)

Arquitetura MVC + Services

Hospedagem backend: Render

Site estático: /public

📁 Estrutura da aplicação

Esta estrutura é canônica e deve ser mantida para organização e manutenção futura.

server.js
app.js
public/
  js/
  css/
  img/
src/
  controllers/
  services/
  routes/
  middleware/
  utils/
scripts/

⚙️ Como rodar localmente
1. Instalar dependências
npm install

2. Criar arquivo .env
PORT=3000

DATABASE_URL=postgres://usuario:senha@host:porta/database

JWT_SECRET=uma_chave_segura

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=sinprfes@sinprfes.org.br
SMTP_PASS=senha
MAIL_FROM=sinprfes@sinprfes.org.br
MAIL_TO_FILIACAO=sinprfes@sinprfes.org.br

# Cloudinary (avatar)
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name

3. Rodar o servidor
node server.js

🔐 Autenticação e perfis
Perfis existentes

FILIADO

FUNCIONARIO

DIRETORIA

ADMIN

Regras gerais

Autenticação via JWT

Expiração automática de sessão

2FA opcional (Google Authenticator)

Preparado para Login gov.br (futuro)

👤 Regras de acesso por perfil
👤 FILIADO

Pode:

Visualizar seus próprios dados completos

Atualizar seus próprios dados permitidos

Cadastrar/alterar seus próprios dependentes

Visualizar outros filiados apenas com nome e telefone

Não pode:

Alterar dados de terceiros

Criar, arquivar ou desarquivar usuários

🛠️ Perfis de gestão (FUNCIONARIO / DIRETORIA / ADMIN)

Podem:

Visualizar todos os dados

Criar novos filiados

Editar qualquer cadastro

Arquivar e desarquivar cadastros

Gerenciar dependentes de qualquer filiado

👨‍👩‍👧‍👦 Dependentes (até 5 por filiado)

Cada filiado pode possuir até 5 dependentes, armazenados diretamente na tabela filiados.

Campos por dependente

Para cada dependente N (1 a 5):

depN_nome – Nome completo

depN_cpf – CPF (11 dígitos, somente números)

depN_data_nascimento – Data de nascimento (DATE)

depN_parentesco – Parentesco / relação

Regras de validação

Dependentes são opcionais

Regra cruzada obrigatória:

Se CPF for informado → Nome é obrigatório

Se Nome for informado → CPF é obrigatório

CPF deve ter 11 dígitos

Data, quando informada, deve ser válida

Parentesco pode ser selecionado ou informado livremente

Frontend

Campos exibidos em um único card

Máscaras em tempo real:

CPF: apenas números, máximo 11

Data: dd/mm/aaaa

Conversão automática para o backend:

Data → yyyy-mm-dd

CPF → somente números

📡 Endpoints principais
Endpoint	Método	Descrição
/api/primeiro-acesso/iniciar	POST	Inicia fluxo do primeiro acesso
/api/primeiro-acesso/confirmar	POST	Define senha inicial
/api/login	POST	Login + JWT
/api/filiados/me	GET	Dados do usuário autenticado
/api/filiados/me	PUT	Atualiza dados próprios (inclui dependentes)
/api/filiados	GET	Lista filiados (perfil define visibilidade)
/api/filiados	POST	Criação de novo filiado (gestão)
/api/filiados/:id	PUT	Atualização por gestão
/api/filiados/:id/arquivar	POST	Arquiva cadastro
/api/filiados/:id/desarquivar	POST	Desarquiva cadastro
/api/filiados/me/avatar	POST/DELETE	Upload / remoção de avatar
/api/filiados/:id/avatar	POST/DELETE	Avatar por gestão
/api/filiese	POST	Solicitação pública de filiação (PDF + e-mail)
📨 Envio de e-mail + PDF

Cada solicitação pública de filiação gera:

📄 PDF automático (PDFKit)

✉️ E-mail enviado ao sindicato, com o PDF em anexo

Se o SMTP não estiver configurado corretamente:

O sistema não quebra

Um aviso é registrado no console

🖼️ Avatares (Cloudinary)

Upload de imagens pequenas (ex.: 200×200)

Armazenadas no Cloudinary

URL persistente (não se perde em deploy)

Transformações fixas aplicadas para economizar créditos

📌 Scripts úteis
Limpeza / manutenção
node scripts/cleanup.js

🔒 Segurança

Hash de senha com Bcrypt

JWT com expiração

2FA opcional

Controle rigoroso de permissões por perfil

Nenhuma exclusão física de registros (histórico preservado)

📞 Suporte

Em caso de dúvidas técnicas ou manutenção:

Marcelo Fávero Brandão
Desenvolvedor responsável pelo sistema

📦 Padrão de imports do backend

Este backend utiliza CommonJS (require() / module.exports).

Padrão adotado: imports sem extensão

require("./routes/auth.routes");


Motivo:

Compatível com o resolver do Node

Menos ruído em diffs

Estável em produção

Alternativa futura (ESM)

Caso o projeto migre para "type": "module":

Recomenda-se padronizar imports com extensão explícita (.js)

⚠️ Não misturar estilos. Qualquer migração deve ser global e testada.

FIM DO README