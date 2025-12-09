// src/services/email.service.js
const nodemailer = require("nodemailer");

/**
 * Cria transporter compartilhado.
 * Contém configurações de SMTP, segurança e timeouts.
 */
function criarTransporter() {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
  } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log("⚠️ SMTP não configurado corretamente; não será enviado e-mail.");
    throw new Error("SMTP não configurado.");
  }

  const portNumber = Number(SMTP_PORT) || 587;
  const isSecure = portNumber === 465;

  return nodemailer.createTransport({
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
    // Mantém timeouts de 20 segundos para conexão/socket
    connectionTimeout: 20000, 
    socketTimeout: 20000,
  });
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
 * - Apenas o PDF consolidado (pedido + anexos)
 * - Para o sindicato
 * - Com cópia para o filiado
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

/**
 * E-mail de boas-vindas para novo filiado criado no painel.
 * Orienta a usar "Esqueci minha senha" para definir a senha.
 */
async function enviarEmailBoasVindasFiliado(dados) {
  const { MAIL_FROM } = process.env;

  if (!MAIL_FROM) {
    console.log("⚠️ MAIL_FROM não configurado; não será enviado e-mail de boas-vindas.");
    return;
  }

  if (!dados.email1) {
    console.log("⚠️ Novo filiado sem email1; não será enviado e-mail de boas-vindas.");
    return;
  }

  const transporter = criarTransporter();

  const primeiroNome = (dados.nome || "").split(" ")[0] || "Colega";
  const subject = `Bem-vindo ao SINPRF-ES – acesso à Área do Filiado`;

  const corpo = `
Olá, ${primeiroNome}!

Seu cadastro foi criado no sistema do SINPRF-ES.

Para definir sua senha de acesso à Área do Filiado, siga estes passos:

1) Acesse https://sinprfes.org.br/login.html
2) Clique em "Esqueci minha senha".
3) Informe seu CPF ${dados.cpf || ""} e siga as instruções enviadas ao seu e-mail.

Qualquer dúvida, fale com a secretaria do sindicato.

SINPRF-ES
`;

  const mailOptions = {
    from: MAIL_FROM,
    to: dados.email1,
    subject,
    text: corpo,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log("📧 E-mail de boas-vindas enviado. MessageId:", info.messageId);
}

module.exports = {
  criarTransporter, // EXPORTADO para ser usado pelo senha.controller
  enviarEmailFichaFiliacao,
  enviarEmailRessarcimento,
  enviarEmailBoasVindasFiliado,
};