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