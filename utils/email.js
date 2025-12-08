require("dotenv").config();
const nodemailer = require("nodemailer");

function criarTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false, // Gmail Workspace usa STARTTLS (porta 587)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Envia ficha de filiação + PDF para o sindicato.
 */
async function enviarEmailFichaFiliacao(dados, pdfBuffer) {
  const transporter = criarTransporter();

  const info = await transporter.sendMail({
    from: `"SINPRF-ES" <${process.env.MAIL_FROM}>`,
    to: process.env.MAIL_TO_FILIACAO,
    subject: `[SITE] Nova solicitação de filiação – ${dados.nome} (${dados.cpf})`,
    headers: {
      "X-SINPRF-Origem": "site-filiacao",
    },
    text: `Nova solicitação de filiação. Nome: ${dados.nome} – CPF: ${dados.cpf}`,
    html: `
      <h2>Nova solicitação de filiação</h2>
      <p><strong>Nome:</strong> ${dados.nome}</p>
      <p><strong>CPF:</strong> ${dados.cpf}</p>
      <p><strong>E-mail:</strong> ${dados.email1}</p>
      <p>A ficha completa está em anexo.</p>
    `,
    attachments: [
      {
        filename: `ficha_filiacao_${dados.cpf}.pdf`,
        content: pdfBuffer,
      },
    ],
  });

  console.log("📧 E-mail enviado com sucesso! ID:", info.messageId);
}

module.exports = { enviarEmailFichaFiliacao };
