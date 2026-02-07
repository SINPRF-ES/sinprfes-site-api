// src/controllers/senha.controller.js
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { enviarEmailBase } = require("../services/email.service");
const log = require("../utils/log");
const Textos = require ("../utils/textos");

// FENAPRF: Usamos users.service
const usersService = require("../services/users.service");

function getEmailPrincipal(user) {
  if (user.email && user.email.trim() !== "") return user.email.trim();
  // Fallback para campos legados se ainda existirem
  if (user.email1 && user.email1.trim() !== "") return user.email1.trim();
  return null;
}

/**
 * Solicitação de reset de senha.
 * Gera um token hexadecimal seguro e salva no banco.
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
    const user = await usersService.buscarPorCpf(cpfLimpo);

    const mensagemPadrao = Textos.SENHA.MENSAGEM_RESET_PADRAO;

    // Se usuário não existe, retornamos 200 para evitar enumeração de usuários
    if (!user) {
      log.warn("SenhaResetUserNaoEncontrado", { requestId });
      return res.json({
        message: mensagemPadrao,
        email_destino: null,
      });
    }

    const emailDestino = getEmailPrincipal(user);

    if (!emailDestino) {
      log.warn("SenhaResetSemEmail", { userId: user.id, requestId });
      // Retornamos 200 conforme solicitado, mas informamos que não há e-mail
      return res.json({
        message: Textos.SENHA.EMAIL_NAO_CADASTRADO,
        email_destino: null,
      });
    }

    // Gera token seguro (hex) em vez de JWT para evitar problemas de tamanho e complexidade
    const token = crypto.randomBytes(24).toString('hex');
    const expiracao = new Date();
    expiracao.setHours(expiracao.getHours() + 1);

    // Salva no banco (users.token_acesso_temp e users.token_expiracao)
    await usersService.setResetToken(user.id, token, expiracao);

    log.info("SenhaResetTokenPersistido", { userId: user.id, requestId });

    // Link aponta para o sistema FENAPRF
    const baseUrl = process.env.APP_BASE_URL || "https://fenaprf-sistema.onrender.com";
    const linkRedefinicao = `${baseUrl.replace(/\/$/, "")}/redefinir-senha.html?token=${encodeURIComponent(token)}`;

    const subject = "FENAPRF – Redefinição de senha";
    const corpoEmail =
        `Olá, ${user.name || user.nome}.\n\n` +
        `Recebemos uma solicitação para redefinir a senha da sua conta na FENAPRF.\n\n` +
        `Para criar uma nova senha, acesse o link abaixo (válido por 1 hora):\n\n` +
        `${linkRedefinicao}\n\n` +
        `Se você não fez esta solicitação, ignore este e-mail.\n\n` +
        `Atenciosamente,\nFENAPRF`;

    try {
        await enviarEmailBase(emailDestino, subject, corpoEmail);
        log.info("SenhaResetEmailEnviado", { userId: user.id, requestId });
    } catch (e) {
        log.error("SenhaResetEmailFalha", { error: e.message, userId: user.id, requestId });
    }

    return res.json({
      message: mensagemPadrao,
      email_destino: emailDestino,
    });
  } catch (err) {
    log.error("SenhaResetSolicitarErro", { error: err.message, stack: err.stack, requestId });
    next(err);
  }
};

/**
 * Efetivação do reset de senha.
 */
exports.resetarSenha = async (req, res, next) => {
  const { token, senha_nova } = req.body || {};
  const requestId = req.requestId;

  try {
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

    // Busca usuário pelo token e verifica expiração
    const { rows: tokenRows } = await pool.query(
        "SELECT id FROM users WHERE token_acesso_temp = $1 AND token_expiracao > NOW()",
        [token]
    );

    if (tokenRows.length === 0) {
        log.warn("SenhaResetTokenInvalidoOuExpirado", { token, requestId });
        return res.status(400).json({
          error: Textos.SENHA.TOKEN_SENHA_EXPIRADO,
        });
    }

    const userId = tokenRows[0].id;
    const senhaHash = await bcrypt.hash(senha_nova, 10);

    // Atualiza senha e limpa tokens
    await usersService.setPassword(userId, senhaHash);

    log.info("SenhaAlteradaSucesso", { userId, requestId });

    return res.json({
      message: Textos.SUCESSO.SENHA_REDEFINIDA,
    });
  } catch (err) {
    log.error("SenhaResetConfirmarErro", { error: err.message, requestId });
    next(err);
  }
};
