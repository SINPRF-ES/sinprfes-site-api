// src/services/email.service.js
const { Resend } = require("resend");

// 1. Inicializa o cliente Resend com a chave API
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Função de envio base, usada pelo senha.controller.js (sem anexo).
 */
async function enviarEmailBase(to, subject, text, cc = undefined) {
  const { MAIL_FROM } = process.env;

  if (!process.env.RESEND_API_KEY) {
    throw new Error("❌ RESEND_API_KEY não configurada.");
  }
  if (!MAIL_FROM) {
    throw new Error("❌ MAIL_FROM não configurado.");
  }

  const payload = {
    from: MAIL_FROM,
    to: to,
    subject: subject,
    text: text,
  };
  
  if (cc) {
    payload.cc = cc;
  }

  const { data, error } = await resend.emails.send(payload);

  if (error) {
    console.error("💥 Erro ao enviar e-mail com Resend:", error);
    // Lança um erro para que o controller possa capturá-lo
    throw new Error(`Falha no envio do e-mail: ${error.name || error.message}`);
  }

  console.log("📧 E-mail Resend enviado. Id:", data.id);
  return data;
}

/**
 * Envia o e-mail para o sindicato com a ficha de filiação em PDF anexa.
 */
async function enviarEmailFichaFiliacao(dados, pdfBuffer) {
  const {
    MAIL_FROM,
    MAIL_TO_FILIACAO,
  } = process.env;

  if (!MAIL_FROM || !MAIL_TO_FILIACAO) {
    throw new Error("❌ MAIL_FROM ou MAIL_TO_FILIACAO não configurados.");
  }

  const subject = `Ficha de Filiação - ${dados.nome || ""} (${dados.cpf || ""})`;

  const payload = {
    from: MAIL_FROM,
    to: MAIL_TO_FILIACAO,
    subject,
    text: `Segue em anexo a ficha de filiação de ${dados.nome || ""}, CPF ${dados.cpf || ""}.`,
    attachments: [
      {
        filename: "ficha_filiacao.pdf",
        content: pdfBuffer.toString("base64"), // Resend usa Base64 para anexos
      },
    ],
  };

  const { data, error } = await resend.emails.send(payload);
  
  if (error) {
    console.error("💥 Erro ao enviar e-mail de filiação com Resend:", error);
    throw new Error(`Falha no envio do e-mail: ${error.name || error.message}`);
  }

  console.log("📧 E-mail de filiação enviado. Id:", data.id);
}

/**
 * Envia o e-mail de pedido de ressarcimento:
 */
async function enviarEmailRessarcimento(dados, pdfBuffer) {
  const {
    MAIL_FROM,
    MAIL_TO_RESSARCIMENTO,
    MAIL_TO_FILIACAO,
  } = process.env;

  const mailSindicato = MAIL_TO_RESSARCIMENTO || MAIL_TO_FILIACAO;

  if (!MAIL_FROM || !mailSindicato) {
    throw new Error("❌ MAIL_FROM ou MAIL_TO_RESSARCIMENTO não configurados.");
  }
  
  const subject = `Pedido de Ressarcimento - ${dados.nome || ""} (${dados.cpf || ""})`;

  const corpoEmail = `
Pedido de ressarcimento de despesas sindicais.
// ... (resto do corpo do e-mail)
`;
  
  const payload = {
    from: MAIL_FROM,
    to: mailSindicato,
    cc: dados.email_destino || undefined, 
    subject,
    text: corpoEmail,
    attachments: [
      {
        filename: "pedido_ressarcimento.pdf",
        content: pdfBuffer.toString("base64"),
      },
    ],
  };

  const { data, error } = await resend.emails.send(payload);

  if (error) {
    console.error("💥 Erro ao enviar e-mail de ressarcimento com Resend:", error);
    throw new Error(`Falha no envio do e-mail: ${error.name || error.message}`);
  }

  console.log("📧 E-mail de ressarcimento enviado. Id:", data.id);
}

/**
 * E-mail de boas-vindas para novo filiado.
 */
async function enviarEmailBoasVindasFiliado(dados) {
  const { MAIL_FROM } = process.env;

  if (!MAIL_FROM || !dados.email1) {
    console.log("⚠️ E-mail de boas-vindas não enviado por falta de MAIL_FROM ou email1 do filiado.");
    return;
  }

  const primeiroNome = (dados.nome || "").split(" ")[0] || "Colega";
  const subject = `Bem-vindo ao SINPRF-ES – acesso à Área do Filiado`;

  const corpo = `
Olá, ${primeiroNome}!
// ... (resto do corpo do e-mail)
`;

  await enviarEmailBase(dados.email1, subject, corpo);
}

module.exports = {
  enviarEmailBase,
  enviarEmailFichaFiliacao,
  enviarEmailRessarcimento,
  enviarEmailBoasVindasFiliado,
};