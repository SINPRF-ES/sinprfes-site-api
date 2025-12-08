// src/services/email.service.js
const nodemailer = require("nodemailer");

/**
 * Envia o e-mail para o sindicato com a ficha de filiação em PDF anexa.
 */
async function enviarEmailFichaFiliacao(dados, pdfBuffer) {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    MAIL_FROM,
    MAIL_TO_FILIACAO,
  } = process.env;

  const debug = {
    host: SMTP_HOST,
    port: SMTP_PORT,
    user: SMTP_USER,
    mailFrom: MAIL_FROM,
    mailTo: MAIL_TO_FILIACAO,
    hasPass: !!SMTP_PASS,
  };
  console.log("🛠 SMTP DEBUG:", debug);

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !MAIL_TO_FILIACAO) {
    console.log("⚠️ SMTP não configurado corretamente; não será enviado e-mail.");
    return;
  }

  const portNumber = Number(SMTP_PORT) || 587;
  const isSecure = portNumber === 465;

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: portNumber,
    secure: isSecure,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 20000,
    socketTimeout: 20000,
  });

  const mailOptions = {
    from: MAIL_FROM || SMTP_USER,
    to: MAIL_TO_FILIACAO,
    subject: `Nova solicitação de filiação – ${dados.nome} (${dados.cpf})`,
    text:
      "Nova solicitação de filiação recebida pelo site do SINPRF-ES.\n\n" +
      `Nome: ${dados.nome}\n` +
      `CPF: ${dados.cpf}\n` +
      `Data de nascimento: ${dados.data_nascimento}\n` +
      `Telefone: ${dados.telefone1}\n` +
      `E-mail pessoal: ${dados.email_pessoal}\n` +
      `E-mail funcional: ${dados.email_funcional || "-"}\n` +
      `Lotação: ${dados.lotacao || "-"}\n\n` +
      `Endereço: ${dados.endereco}, ${dados.complemento || ""} - ${
        dados.bairro
      } - ${dados.cidade}/${dados.uf} - CEP ${dados.cep}\n\n` +
      "Ficha completa em anexo (PDF).",
    attachments: [
      {
        filename: "ficha_filiacao.pdf",
        content: pdfBuffer,
      },
    ],
  };

  const info = await transporter.sendMail(mailOptions);
  console.log("📧 E-mail de filiação enviado. MessageId:", info.messageId);
}

module.exports = {
  enviarEmailFichaFiliacao,
};
