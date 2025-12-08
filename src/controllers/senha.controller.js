// src/controllers/senha.controller.js
const pool = require("../config/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");

/**
 * Util: obtém e-mail principal do filiado
 * priorizando email1, depois email2.
 */
function getEmailPrincipal(row) {
  if (row.email1 && row.email1.trim() !== "") return row.email1.trim();
  if (row.email2 && row.email2.trim() !== "") return row.email2.trim();
  return null;
}

/**
 * Util: cria transporter de e-mail com base nas variáveis de ambiente
 */
function criarTransporter() {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
  } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn("⚠ SMTP não configurado corretamente. Não será possível enviar e-mails de reset de senha.");
    return null;
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
    connectionTimeout: 20000,
    socketTimeout: 20000,
  });
}

/**
 * POST /api/senha/recuperar
 * Corpo: { cpf: "..." }
 *
 * Se CPF existir e tiver e-mail, envia link de redefinição.
 * Sempre responde 200 (mesma mensagem), mas se achou o filiado
 * devolve também o e-mail usado para o envio.
 */
exports.solicitarResetSenha = async (req, res) => {
  try {
    const { cpf } = req.body || {};

    if (!cpf) {
      return res.status(400).json({ error: "Informe o CPF." });
    }

    const cpfLimpo = cpf.replace(/\D/g, "");

    const query = `
      SELECT id, nome, cpf, email1, email2
      FROM filiados
      WHERE cpf = $1
    `;
    const { rows } = await pool.query(query, [cpfLimpo]);

    // Sempre envia mensagem genérica para não expor se CPF existe ou não.
    const mensagemPadrao =
      "Se houver um cadastro para este CPF, um e-mail com link de redefinição de senha foi enviado.";

    if (rows.length === 0) {
      return res.json({
        message: mensagemPadrao,
        email_destino: null,
      });
    }

    const user = rows[0];
    const emailDestino = getEmailPrincipal(user);

    if (!emailDestino) {
      return res.json({
        message:
          "CPF localizado, mas não há e-mail válido cadastrado. " +
          "Por favor, entre em contato com a secretaria do sindicato pela página de contato.",
        email_destino: null,
      });
    }

    // Gera token de reset de senha (1h)
    const token = jwt.sign(
      {
        id: user.id,
        cpf: user.cpf,
        tipo: "reset-senha",
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const baseUrl = process.env.APP_BASE_URL || "https://sinprfes.org.br";
    const linkRedefinicao = `${baseUrl.replace(/\/$/, "")}/redefinir-senha.html?token=${encodeURIComponent(
      token
    )}`;

    const transporter = criarTransporter();
    if (!transporter) {
      console.warn("⚠ Não foi possível criar transporter SMTP. Reset não enviado.");
      // Mesmo assim responde ok (pra não travar o usuário)
      return res.json({
        message:
          "Não foi possível enviar o e-mail agora. Tente novamente mais tarde ou contate a secretaria.",
        email_destino: null,
      });
    }

    const from = process.env.MAIL_FROM || process.env.SMTP_USER;

    const mailOptions = {
      from,
      to: emailDestino,
      subject: "SINPRF-ES – Redefinição de senha da área do filiado",
      text:
        `Olá, ${user.nome}.\n\n` +
        `Recebemos uma solicitação para redefinir a senha da sua área do filiado no SINPRF-ES.\n\n` +
        `Para criar uma nova senha, acesse o link abaixo (válido por 1 hora):\n\n` +
        `${linkRedefinicao}\n\n` +
        `Se você não fez esta solicitação, ignore este e-mail.\n\n` +
        `Atenciosamente,\nSINPRF-ES`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("📧 E-mail de reset enviado:", info.messageId, "para", emailDestino);

    return res.json({
      message: mensagemPadrao,
      email_destino: emailDestino,
    });
  } catch (err) {
    console.error("💥 Erro em POST /api/senha/recuperar:", err);
    return res.status(500).json({
      error: "Erro interno ao processar a solicitação de redefinição de senha.",
    });
  }
};

/**
 * POST /api/senha/resetar
 * Corpo: { token: "...", senha_nova: "..." }
 *
 * Valida o token e grava nova senha em senha_hash.
 */
exports.resetarSenha = async (req, res) => {
  try {
    const { token, senha_nova } = req.body || {};

    if (!token || !senha_nova) {
      return res.status(400).json({
        error: "Token e nova senha são obrigatórios.",
      });
    }

    if (senha_nova.length < 6) {
      return res.status(400).json({
        error: "A nova senha deve ter pelo menos 6 caracteres.",
      });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.error("Token de reset inválido/expirado:", err);
      return res.status(400).json({
        error: "Link de redefinição inválido ou expirado. Solicite novamente.",
      });
    }

    if (payload.tipo !== "reset-senha") {
      return res.status(400).json({
        error: "Token de redefinição inválido.",
      });
    }

    const userId = payload.id;

    const senhaHash = await bcrypt.hash(senha_nova, 10);

    const updateSql = `
      UPDATE filiados
      SET senha_hash = $1, atualizado_em = NOW()
      WHERE id = $2
    `;
    await pool.query(updateSql, [senhaHash, userId]);

    return res.json({
      message: "Senha redefinida com sucesso. Você já pode fazer login com a nova senha.",
    });
  } catch (err) {
    console.error("💥 Erro em POST /api/senha/resetar:", err);
    return res.status(500).json({
      error: "Erro interno ao redefinir a senha.",
    });
  }
};
