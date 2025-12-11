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
/**
 * Envia o e-mail de pedido de ressarcimento:
 *  - TO: sindicato (MAIL_TO_RESSARCIMENTO ou MAIL_TO_FILIACAO)
 *  - CC: filiado (se houver e-mail disponível)
 */
async function enviarEmailRessarcimento(dados, pdfBuffer) {
  const {
    MAIL_FROM,
    MAIL_TO_RESSARCIMENTO,
    MAIL_TO_FILIACAO,
  } = process.env;

  if (!process.env.RESEND_API_KEY) {
    throw new Error("❌ RESEND_API_KEY não configurada.");
  }

  // E-mail institucional que SEMPRE receberá o pedido
  const mailSindicato = MAIL_TO_RESSARCIMENTO || MAIL_TO_FILIACAO;

  if (!MAIL_FROM || !mailSindicato) {
    throw new Error("❌ MAIL_FROM ou MAIL_TO_RESSARCIMENTO não configurados.");
  }

  // Tenta descobrir e-mail do filiado:
  // 1) campo específico do pedido (email_destino)
  // 2) e-mail 1 do cadastro
  // 3) e-mail 2 do cadastro
  const emailFiliado =
    (dados.email_destino && String(dados.email_destino).trim()) ||
    (dados.email1 && String(dados.email1).trim()) ||
    (dados.email2 && String(dados.email2).trim()) ||
    "";

  if (!emailFiliado) {
    // Apenas log – não impede o envio para o sindicato
    console.warn(
      "⚠️ RessarcimentoSemEmailDestino",
      JSON.stringify({ filiadoId: dados.id_filiado })
    );
  }

  const subject = `Pedido de Ressarcimento - ${dados.nome || ""} (${dados.cpf || ""})`;

  const corpoEmail = `
Prezado(a) ${dados.nome || "filiado(a)"},

Seu pedido de ressarcimento de despesas sindicais foi registrado na plataforma do SINPRF/ES.

Resumo do pedido:
- Período da atividade: ${dados.data_inicio || "-"} a ${dados.data_fim || "-"}
- Local / destino: ${dados.local || "-"}
- Valor total solicitado: R$ ${(dados.valor_total || 0).toFixed
    ? dados.valor_total.toFixed(2)
    : Number(dados.valor_total || 0).toFixed(2)}

Este e-mail foi gerado automaticamente. Em anexo, segue o PDF consolidado com os dados do pedido, para sua conferência.

Atenciosamente,
SINPRF-ES
`;

  // Monta payload para Resend
  const payload = {
    from: MAIL_FROM,
    to: mailSindicato,
    // copia opcional para o filiado
    cc: emailFiliado || undefined,
    subject,
    text: corpoEmail,
    attachments: [
      {
        filename: "pedido_ressarcimento.pdf",
        content: pdfBuffer.toString("base64"), // Resend exige Base64 para anexos
      },
    ],
  };

  const { data, error } = await resend.emails.send(payload);

  if (error) {
    console.error("💥 Erro ao enviar e-mail de ressarcimento com Resend:", error);
    throw new Error(`Falha no envio do e-mail: ${error.name || error.message}`);
  }

  console.log("📧 E-mail de ressarcimento enviado. Id:", data.id, {
    to: mailSindicato,
    cc: emailFiliado || "(sem cópia para filiado)",
  });
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