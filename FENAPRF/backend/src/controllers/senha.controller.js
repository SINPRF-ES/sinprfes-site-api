// src/controllers/senha.controller.js
const pool = require("../config/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { enviarEmailBase } = require("../services/email.service");
const log = require("../utils/log");
const Textos = require ("../utils/textos"); // 🟢 TEXTOS

function getEmailPrincipal(row) {
  if (row.email && row.email.trim() !== "") return row.email.trim();
  // Fallback para campos legados se ainda existirem em alguma view/tabela
  if (row.email1 && row.email1.trim() !== "") return row.email1.trim();
  return null;
}

exports.solicitarResetSenha = async (req, res) => {
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

    const query = `
      SELECT id, name as nome, cpf, email
      FROM users
      WHERE cpf = $1
    `;
    const { rows } = await pool.query(query, [cpfLimpo]);

    const mensagemPadrao = Textos.SENHA.MENSAGEM_RESET_PADRAO;

    if (rows.length === 0) {
      log.warn("SenhaResetUserNaoEncontrado", { requestId });
      return res.json({
        message: mensagemPadrao,
        email_destino: null,
      });
    }

    const user = rows[0];
    const emailDestino = getEmailPrincipal(user);

    if (!emailDestino) {
      log.warn("SenhaResetSemEmail", { userId: user.id });
      return res.json({
        message: Textos.SENHA.EMAIL_NAO_CADASTRADO,
        email_destino: null,
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

    // PERSISTÊNCIA NO BANCO (FENAPRF)
    const expiracao = new Date();
    expiracao.setHours(expiracao.getHours() + 1);

    await pool.query(
        `UPDATE users SET token_acesso_temp = $1, token_expiracao = $2 WHERE id = $3`,
        [token, expiracao, user.id]
    );

    log.info("SenhaResetTokenPersistido", { userId: user.id, requestId });

    const baseUrl = process.env.APP_BASE_URL || "https://fenaprf.org.br";
    const linkRedefinicao = `${baseUrl.replace(/\/$/, "")}/redefinir-senha.html?token=${encodeURIComponent(
      token
    )}`;

    const subject = "FENAPRF – Redefinição de senha";
    const corpoEmail =
        `Olá, ${user.nome}.\n\n` +
        `Recebemos uma solicitação para redefinir a senha da sua conta na FENAPRF.\n\n` +
        `Para criar uma nova senha, acesse o link abaixo (válido por 1 hora):\n\n` +
        `${linkRedefinicao}\n\n` +
        `Se você não fez esta solicitação, ignore este e-mail.\n\n` +
        `Atenciosamente,\nFENAPRF`;

    // Envio de e-mail (se falhar, não travamos o retorno de sucesso para o usuário)
    try {
        await enviarEmailBase(emailDestino, subject, corpoEmail);
    } catch (e) {
        log.error("SenhaResetEmailFalha", { error: e.message, userId: user.id });
    }

    log.info("SenhaResetEmailEnviado", { userId: user.id, email: emailDestino });

    return res.json({
      message: mensagemPadrao,
      email_destino: emailDestino,
    });
  } catch (err) {
    log.error("SenhaResetSolicitarErro", err);
    return res.status(500).json({
      error: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS,
    });
  }
};

exports.resetarSenha = async (req, res) => {
  try {
    const { token, senha_nova } = req.body || {};

    if (!token || !senha_nova) {
      return res.status(400).json({
        error: Textos.SENHA.TOKEN_E_SENHA_OBRIGATORIOS,
      });
    }

    if (senha_nova.length < 6) {
      return res.status(400).json({
        error: Textos.SENHA.SENHA_MUITO_CURTA,
      });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      log.warn("SenhaResetTokenInvalido", { error: err.message });
      return res.status(400).json({
        error: Textos.SENHA.TOKEN_SENHA_EXPIRADO,
      });
    }

    if (payload.tipo !== "reset-senha") {
      return res.status(400).json({
        error: Textos.SENHA.TOKEN_TIPO_INVALIDO,
      });
    }

    const userId = payload.id;
    const requestId = req.requestId;

    log.info("SenhaResetConfirmacaoIniciada", { userId, requestId });

    // VALIDAR TOKEN NO BANCO (FENAPRF)
    const { rows } = await pool.query(
        "SELECT id FROM users WHERE id = $1 AND token_acesso_temp = $2 AND token_expiracao > NOW()",
        [userId, token]
    );

    if (rows.length === 0) {
        log.warn("SenhaResetTokenInvalidoNoDB", { userId, requestId });
        return res.status(400).json({ error: "Link de redefinição inválido ou expirado. Por favor, solicite novamente." });
    }

    const senhaHash = await bcrypt.hash(senha_nova, 10);

    const updateSql = `
      UPDATE users
      SET password_hash = $1, token_acesso_temp = NULL, token_expiracao = NULL, updated_at = NOW()
      WHERE id = $2
    `;
    await pool.query(updateSql, [senhaHash, userId]);

    log.info("SenhaAlteradaSucesso", { userId });

    return res.json({
      message: Textos.SUCESSO.SENHA_REDEFINIDA,
    });
  } catch (err) {
    log.error("SenhaResetConfirmarErro", err);
    return res.status(500).json({
      error: Textos.ERROS_INTERNOS.RESET_SENHA,
    });
  }
};
