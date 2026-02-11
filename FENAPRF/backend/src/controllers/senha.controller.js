// src/controllers/senha.controller.js
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { enviarEmailBase } = require("../services/email.service");
const log = require("../utils/log");
const Textos = require("../utils/textos");

// FENAPRF: Usamos users.service
const usersService = require("../services/users.service");

function getEmailPrincipal(user) {
  if (user.email && user.email.trim() !== "") return user.email.trim();
  // Fallback para campos legados se ainda existirem
  if (user.email1 && user.email1.trim() !== "") return user.email1.trim();
  return null;
}

/**
 * Mascara e-mail no formato:
 * - antes do "@": primeira e última letra visíveis; resto "*"
 * - domínio (após "@"): primeira letra visível até o último "."; resto "*"
 * - TLD (após o último "."): mantém
 *
 * Ex: "marcelo.mfb@gmail.com" -> "m**********b@g****.com"
 */
function maskEmail(email) {
  if (!email || typeof email !== "string") return null;

  const e = email.trim();
  const at = e.indexOf("@");
  if (at <= 0 || at === e.length - 1) return null;

  const local = e.slice(0, at);
  const domainFull = e.slice(at + 1);

  // mantém tudo após o último ponto como "final após o '.'"
  const lastDot = domainFull.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === domainFull.length - 1) {
    // sem ponto no domínio: mascara só domínio inteiro
    const domMasked =
      domainFull.length === 1
        ? domainFull
        : domainFull[0] + "*".repeat(Math.max(0, domainFull.length - 1));
    return `${maskLocal(local)}@${domMasked}`;
  }

  const domainName = domainFull.slice(0, lastDot); // ex: "gmail"
  const tld = domainFull.slice(lastDot + 1); // ex: "com" (ou "org.br" não é capturado aqui; ver abaixo)

  // Se for domínio com múltiplos pontos (ex: "example.org.br"),
  // usando lastDot, o "tld" vira "br", e o "final após o '.'" será só "br".
  // Você pediu "o final após o '.'" — interpretando como após o último ponto.
  const maskedLocal = maskLocal(local);

  const maskedDomainName =
    domainName.length <= 1
      ? domainName
      : domainName[0] + "*".repeat(domainName.length - 1);

  return `${maskedLocal}@${maskedDomainName}.${tld}`;
}

function maskLocal(local) {
  if (!local) return "";
  const s = String(local);

  if (s.length === 1) return s;
  if (s.length === 2) return `${s[0]}*`;

  return `${s[0]}${"*".repeat(s.length - 2)}${s[s.length - 1]}`;
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
      requestId,
    });

    if (!cpf) {
      return res.status(400).json({ error: Textos.SENHA.INFORME_CPF });
    }

    const cpfLimpo = cpf.replace(/\D/g, "");
    const user = await usersService.buscarPorCpf(cpfLimpo);

    const mensagemPadrao = Textos.SENHA.MENSAGEM_RESET_PADRAO;

    // Se membro não existe, retornamos 200 para evitar enumeração de membros
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
    const token = crypto.randomBytes(24).toString("hex");
    const expiracao = new Date();
    expiracao.setHours(expiracao.getHours() + 1);

    // Salva no banco (users.token_acesso_temp e users.token_expiracao)
    await usersService.setResetToken(user.id, token, expiracao);

    log.info("SenhaResetTokenPersistido", { userId: user.id, requestId });

    // Link aponta para o sistema FENAPRF
    const baseUrl = process.env.APP_BASE_URL || "https://fenaprf-sistema.onrender.com";
    const linkRedefinicao = `${baseUrl.replace(/\/$/, "")}/redefinir-senha.html?token=${encodeURIComponent(
      token
    )}`;

    const subject = "FENAPRF – Redefinição de senha";
    const corpoEmail =
      `Olá, ${user.name || user.nome}.\n\n` +
      `Recebemos uma solicitação para redefinir a senha da sua conta na FENAPRF.\n\n` +
      `Para criar uma nova senha, acesse o link abaixo (válido por 1 hora):\n\n` +
      `${linkRedefinicao}\n\n` +
      `Se você não fez esta solicitação, ignore este e-mail.\n\n` +
      `Atenciosamente,\nFENAPRF`;

    try {
      const resp = await enviarEmailBase(emailDestino, subject, corpoEmail);

      if (resp && resp.id) {
        log.info("SenhaResetEmailEnviado", {
          userId: user.id,
          requestId,
          emailId: resp.id,
        });
      } else {
        // Provider ausente/desabilitado (ex.: Resend não carregou, sem API key etc.)
        log.warn("SenhaResetEmailNaoEnviado", {
          userId: user.id,
          requestId,
          reason: "EMAIL_PROVIDER_UNAVAILABLE",
        });
      }
    } catch (e) {
      log.error("SenhaResetEmailFalha", {
        error: e.message,
        userId: user.id,
        requestId,
      });
    }

    return res.json({
      message: mensagemPadrao,
      // ✅ agora devolve o e-mail mascarado conforme solicitado
      email_destino: maskEmail(emailDestino),
    });
  } catch (err) {
    log.error("SenhaResetSolicitarErro", {
      error: err.message,
      stack: err.stack,
      requestId,
    });
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
      return res.status(400).json({ error: Textos.SENHA.TOKEN_E_SENHA_OBRIGATORIOS });
    }

    if (senha_nova.length < 6) {
      return res.status(400).json({ error: Textos.SENHA.SENHA_MUITO_CURTA });
    }

    // Busca membro pelo token e verifica expiração
    const { rows: tokenRows } = await pool.query(
      "SELECT id FROM users WHERE token_acesso_temp = $1 AND token_expiracao > NOW()",
      [token]
    );

    if (tokenRows.length === 0) {
      // cuidado: não logar token cru em produção; mas mantive seu padrão
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

    return res.json({ message: Textos.SUCESSO.SENHA_REDEFINIDA });
  } catch (err) {
    log.error("SenhaResetConfirmarErro", {
      error: err.message,
      stack: err.stack,
      requestId,
    });
    next(err);
  }
};
