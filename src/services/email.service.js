// src/services/email.service.js
// ============================================================
// Responsável por envio de e-mails de Filiação e Ressarcimento
// ============================================================

const nodemailer = require("nodemailer");

// Cria transporter SMTP
function criarTransporter() {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error("❌ Config SMTP incompleta nas variáveis de ambiente.");
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

/**
 * Envia e-mail de Filiação com PDF anexo
 */
async function enviarEmailFichaFiliacao(dados, pdfBuffer) {
  const {
    MAIL_FROM,
    MAIL_TO_FILIACAO,
  } = process.env;

  if (!MAIL_FROM || !MAIL_TO_FILIACAO) {
    throw new Error("❌ MAIL_FROM ou MAIL_TO_FILIACAO não configurados.");
  }

  const transporter = criarTransporter();

  const subject = `Ficha de Filiação - ${dados.nome || ""} (${dados.cpf || ""})`;

  const mailOptions = {
    from: MAIL_FROM,
    to: MAIL_TO_FILIACAO,
    subject,
    text: `Segue em anexo a ficha de filiação de ${dados.nome || ""}, CPF ${dados.cpf || ""}.`,
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

/**
 * Envia o e-mail de pedido de ressarcimento:
 *  - Apenas o PDF consolidado (pedido + anexos)
 *  - Para o sindicato
 *  - Com cópia para o filiado
 */
async function enviarEmailRessarcimento(dados, pdfBuffer) {
  const {
    MAIL_FROM,
    MAIL_TO_RESSARCIMENTO,
    MAIL_TO_FILIACAO,
  } = process.env;

  // Caixinha oficial do sindicato
  const mailSindicato = MAIL_TO_RESSARCIMENTO || MAIL_TO_FILIACAO;

  if (!MAIL_FROM || !mailSindicato) {
    throw new Error("❌ MAIL_FROM ou MAIL_TO_RESSARCIMENTO não configurados.");
  }

  const transporter = criarTransporter();

  const subject = `Pedido de Ressarcimento - ${dados.nome || ""} (${dados.cpf || ""})`;

  const corpoEmail = `
Pedido de ressarcimento de despesas sindicais.

Nome: ${dados.nome || ""}
CPF: ${dados.cpf || ""}
Período: ${dados.data_inicio || ""} a ${dados.data_fim || ""}
Local: ${dados.local || ""}

Valor de diárias: R$ ${(parseFloat(dados.valor_diarias || 0)).toFixed(2)}
Valor de km: R$ ${(parseFloat(dados.valor_km || 0)).toFixed(2)}
Outros gastos: R$ ${(parseFloat(dados.valor_outros || 0)).toFixed(2)}

TOTAL: R$ ${(parseFloat(dados.valor_total || 0)).toFixed(2)}

O PDF em anexo contém:
 - resumo da atividade,
 - quadro financeiro completo,
 - dados bancários,
 - declaração de assinatura eletrônica,
 - comprovantes anexos incorporados.
`;

  const mailOptions = {
    from: MAIL_FROM,
    to: mailSindicato,
    cc: dados.email_destino || undefined, // cópia para o filiado
    subject,
    text: corpoEmail,
    attachments: [
      {
        filename: "pedido_ressarcimento.pdf",
        content: pdfBuffer,
      },
    ],
  };

  const info = await transporter.sendMail(mailOptions);
  console.log("📧 E-mail de ressarcimento enviado. MessageId:", info.messageId);
}

module.exports = {
  enviarEmailFichaFiliacao,
  enviarEmailRessarcimento,
};
