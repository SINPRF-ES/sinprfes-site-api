// src/controllers/senha.controller.js
const pool = require("../config/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { enviarEmailBase } = require("../services/email.service");
const log = require("../utils/log");
const Textos = require ("../utils/textos");

function getEmailPrincipal(row) {
  if (row.email && row.email.trim() !== "") return row.email.trim();
  if (row.email1 && row.email1.trim() !== "") return row.email1.trim();
  return null;
}

/**
 * Solicitação de reset de senha.
 * Grava token_acesso_temp + token_expiracao em users.
 */
exports.solicitarResetSenha = async (req, res, next) => {
  const { cpf } = req.body || {};
  const requestId = req.requestId;

  try {
    log.info("SenhaResetSolicitada", {
        cpf: cpf ? `${cpf.substring(0, 3)}.***.***-**` : null,
        requestId
    });

    if (!cpf) {
      return res.status(400).json({ error: Textos.SENHA.INFORME_CPF });
    }

    const cpfLimpo = cpf.replace(/\D/g, "");

    // Busca apenas em public.users (Isolamento FENAPRF)
    const query = `
      SELECT id, name as nome, cpf, email
      FROM users
      WHERE cpf = $1
    `;
    const { rows: userRows } = await pool.query(query, [cpfLimpo]);

    const mensagemPadrao = Textos.SENHA.MENSAGEM_RESET_PADRAO;

    if (userRows.length === 0) {
      log.warn("SenhaResetUserNaoEncontrado", { requestId });
      return res.json({
        message: mensagemPadrao,
        email_destino: null,
      });
    }

    const user = userRows[0];
    const emailDestino = getEmailPrincipal(user);

    if (!emailDestino) {
      log.warn("SenhaResetSemEmail", { userId: user.id, requestId });
      return res.json({
        message: Textos.SENHA.EMAIL_NAO_CADASTRADO,
        email_destino: null,
      });
    }

    // Gera token de reset de senha (1h)
    const token = jwt.sign(
      { id: user.id, cpf: user.cpf, tipo: "reset-senha" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Grava token_acesso_temp + token_expiracao em users (Requirement D)
    const expiracao = new Date();
    expiracao.setHours(expiracao.getHours() + 1);

    await pool.query(
        `UPDATE users SET token_acesso_temp = $1, token_expiracao = $2 WHERE id = $3`,
        [token, expiracao, user.id]
    );

    log.info("SenhaResetTokenPersistido", { userId: user.id, requestId });

    const baseUrl = process.env.APP_BASE_URL || "https://fenaprf-sistema.onrender.com";
    const linkRedefinicao = `${baseUrl.replace(/\/$/, "")}/redefinir-senha.html?token=${encodeURIComponent(token)}`;

    const subject = "FENAPRF – Redefinição de senha";
    const corpoEmail =
        `Olá, ${user.nome}.\n\n` +
        `Recebemos uma solicitação para redefinir a senha da sua conta na FENAPRF.\n\n` +
        `Para criar uma nova senha, acesse o link abaixo (válido por 1 hora):\n\n` +
        `${linkRedefinicao}\n\n` +
        `Se você não fez esta solicitação, ignore este e-mail.\n\n` +
        `Atenciosamente,\nFENAPRF`;

    try {
        await enviarEmailBase(emailDestino, subject, corpoEmail);
    } catch (e) {
        log.error("SenhaResetEmailFalha", { error: e.message, userId: user.id, requestId });
    }

    log.info("SenhaResetEmailEnviado", { userId: user.id, requestId });

    return res.json({
      message: mensagemPadrao,
      email_destino: emailDestino,
    });
  } catch (err) {
    // Log stacktrace com requestId se falhar (Requirement D)
    log.error("SenhaResetSolicitarErro", { error: err.message, stack: err.stack, requestId });
    next(err);
  }
};

/**
 * Efetivação do reset de senha.
 */
exports.resetarSenha = async (req, res, next) => {
  const requestId = req.requestId;
  try {
    const { token, senha_nova } = req.body || {};

    if (!token || !senha_nova) {
      return res.status(400).json({ error: Textos.SENHA.TOKEN_E_SENHA_OBRIGATORIOS });
    }

    if (senha_nova.length < 6) {
      return res.status(400).json({ error: Textos.SENHA.SENHA_MUITO_CURTA });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      log.warn("SenhaResetTokenInvalido", { error: err.message, requestId });
      return res.status(400).json({ error: Textos.SENHA.TOKEN_SENHA_EXPIRADO });
    }

    if (payload.tipo !== "reset-senha") {
      return res.status(400).json({ error: Textos.SENHA.TOKEN_TIPO_INVALIDO });
    }

    const userId = payload.id;

    // Validar token no banco (Requirement D)
    const { rows: tokenRows } = await pool.query(
        "SELECT id FROM users WHERE id = $1 AND token_acesso_temp = $2 AND token_expiracao > NOW()",
        [userId, token]
    );

    if (tokenRows.length === 0) {
        log.warn("SenhaResetTokenInvalidoNoDB", { userId, requestId });
        return res.status(400).json({ error: "Link de redefinição inválido ou expirado." });
    }

    const senhaHash = await bcrypt.hash(senha_nova, 10);

    const updateSql = `
      UPDATE users
      SET password_hash = $1, token_acesso_temp = NULL, token_expiracao = NULL, updated_at = NOW()
      WHERE id = $2
    `;
    await pool.query(updateSql, [senhaHash, userId]);

    log.info("SenhaAlteradaSucesso", { userId, requestId });

    return res.json({ message: Textos.SUCESSO.SENHA_REDEFINIDA });
  } catch (err) {
    log.error("SenhaResetConfirmarErro", { error: err.message, stack: err.stack, requestId });
    next(err);
  }
};
