// src/controllers/senha.controller.js
const pool = require("../config/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { enviarEmailBase } = require("../services/email.service"); 
const authService = require("../services/auth.service");
const log = require("../utils/log");
const Textos = require ("../utils/textos"); // 🟢 TEXTOS
const { v4: uuidv4 } = require("uuid");
const { handleDbError } = require("../utils/dbError");

function getEmailPrincipal(row) {
  if (row.email1 && row.email1.trim() !== "") return row.email1.trim();
  if (row.email2 && row.email2.trim() !== "") return row.email2.trim();
  return null;
}

function mascararEmail(email) {
  const emailLimpo = String(email || "").trim();
  const [localPart = "", domainPart = ""] = emailLimpo.split("@");

  if (!localPart || !domainPart) {
    return "";
  }

  const localVisivel = localPart.slice(0, 3);
  const localMascarado = "*".repeat(Math.max(localPart.length - localVisivel.length, 0));

  const [dominio = "", ...restoDominio] = domainPart.split(".");
  const tld = restoDominio.join(".");
  const dominioVisivel = dominio.slice(0, 2);
  const dominioMascarado = "*".repeat(Math.max(dominio.length - dominioVisivel.length, 0));

  if (!tld) {
    return `${localVisivel}${localMascarado}@${dominioVisivel}${dominioMascarado}`;
  }

  return `${localVisivel}${localMascarado}@${dominioVisivel}${dominioMascarado}.${tld}`;
}

exports.solicitarResetSenha = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  try {
    const { cpf } = req.body || {};

    if (!cpf) {
      return res.status(400).json({ success: false, error: Textos.SENHA.INFORME_CPF, requestId }); // ✨
    }

    const cpfLimpo = cpf.replace(/\D/g, "");

    const query = `
      SELECT id, nome, cpf, email1, email2
      FROM filiados
      WHERE cpf = $1
    `;
    const { rows } = await pool.query(query, [cpfLimpo]);
    
    const mensagemPadrao = Textos.SENHA.MENSAGEM_RESET_PADRAO; // ✨

    if (rows.length === 0) {
      return res.json({
        success: true,
        message: mensagemPadrao,
        email_destino: null,
        requestId
      });
    }

    const user = rows[0];
    const emailDestino = getEmailPrincipal(user);

    if (!emailDestino) {
      log.warn("SenhaResetSemEmail", { requestId, userId: user.id });
      return res.json({
        success: true,
        message: Textos.SENHA.EMAIL_NAO_CADASTRADO, // ✨
        email_destino: null,
        requestId
      });
    }

    // 2. Gera token de reset de senha (1h)
    const token = jwt.sign(
      {
        id: user.id,
        cpf: user.cpf,
        tipo: "reset-senha",
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const baseUrl = process.env.APP_BASE_URL;
    if (!baseUrl) {
      log.error("SenhaController.AppBaseUrlMissing", { requestId });
      return res.status(500).json({ error: "Configuração de servidor incompleta (APP_BASE_URL)." });
    }
    const linkRedefinicao = `${baseUrl.replace(/\/$/, "")}/redefinir-senha.html?token=${encodeURIComponent(
      token
    )}`;

    const subject = "SINPRF-ES – Redefinição de senha da área do filiado";
    const corpoEmail = 
        `Olá, ${user.nome}.\n\n` +
        `Recebemos uma solicitação para redefinir a senha da sua área do filiado no SINPRF-ES.\n\n` +
        `Para criar uma nova senha, acesse o link abaixo (válido por 1 hora):\n\n` +
        `${linkRedefinicao}\n\n` +
        `Se você não fez esta solicitação, ignore este e-mail.\n\n` +
        `Atenciosamente,\nSINPRF-ES`;

    await enviarEmailBase(emailDestino, subject, corpoEmail);
    
    log.info("SenhaResetEmailEnviado", { requestId, userId: user.id, email: emailDestino });

    return res.json({
      success: true,
      message: mensagemPadrao,
      email_destino: mascararEmail(emailDestino),
      requestId
    });
  } catch (err) {
    log.error("SenhaResetSolicitarErro", { error: err.message, requestId });
    return res.status(500).json({
      success: false,
      error: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS, // ✨ Reutilizando esta mensagem
      requestId
    });
  }
};

exports.resetarSenha = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  try {
    const { token, senha_nova } = req.body || {};

    if (!token || !senha_nova) {
      return res.status(400).json({
        success: false,
        error: Textos.SENHA.TOKEN_E_SENHA_OBRIGATORIOS, // ✨
        requestId
      });
    }

    if (senha_nova.length < 6) {
      return res.status(400).json({
        success: false,
        error: Textos.SENHA.SENHA_MUITO_CURTA, // ✨
        requestId
      });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      log.warn("SenhaResetTokenInvalido", { error: err.message, requestId });
      return res.status(400).json({
        success: false,
        error: Textos.SENHA.TOKEN_SENHA_EXPIRADO, // ✨
        requestId
      });
    }

    if (payload.tipo !== "reset-senha") {
      return res.status(400).json({
        success: false,
        error: Textos.SENHA.TOKEN_TIPO_INVALIDO, // ✨
        requestId
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

    // Revoga todas as sessões ativas ao trocar a senha por segurança
    await authService.revokeAllRefreshTokens(userId, "Password Change");

    log.info("SenhaAlteradaSucesso", { requestId, userId });

    return res.json({
      success: true,
      message: Textos.SUCESSO.SENHA_REDEFINIDA, // ✨
      requestId
    });
  } catch (err) {
    return handleDbError(err, res, requestId, Textos.ERROS_INTERNOS.RESET_SENHA);
  }
};
