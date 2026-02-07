// src/controllers/auth.controller.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const { normalizarCpf } = require("../utils/format");
const log = require("../utils/log");
const Textos = require("../utils/textos");

const {
  buscarPorCpf,
  buscarPorId,
  salvarTwoFaSecret,
  registrarUltimoAcesso,
  listarParaPerfil,
} = require("../services/filiados.service");

/**
 * Geração de Token JWT assinado com JWT_SECRET.
 */
function gerarToken(filiado) {
  const perfil = (filiado.perfil_acesso || "CONSELHEIRO").toUpperCase();

  return jwt.sign(
    {
      id: filiado.id,
      cpf: filiado.cpf,
      nome: filiado.nome || filiado.name,
      perfil_acesso: perfil,
    },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
}

/**
 * LOGIN: Autenticação via CPF e Senha.
 */
exports.login = async (req, res, next) => {
  const { cpf, senha, token_2fa } = req.body || {};
  const requestId = req.requestId;

  try {
    log.info("AuthLoginIniciado", {
      cpf: cpf ? `${cpf.substring(0, 3)}.***.***-**` : null,
      requestId
    });

    if (!cpf || !senha) {
      return res
        .status(400)
        .json({ error: Textos.AUTH.INFORME_CREDENCIAIS });
    }

    // A) Normalizar CPF (somente dígitos)
    const cpfNormalizado = normalizarCpf(cpf);

    // B) Buscar em public.users por CPF
    const filiado = await buscarPorCpf(cpfNormalizado);

    // C) Se não achar: 401
    if (!filiado) {
      log.warn("AuthLoginFalha", {
        cpf: cpfNormalizado ? `${cpfNormalizado.substring(0, 3)}.***.***-**` : null,
        motivo: "UserNaoEncontrado",
        requestId
      });
      return res
        .status(401)
        .json({ error: Textos.AUTH.CREDENCIAIS_INVALIDAS });
    }

    // D) Se password_hash é NULL ou 'PENDENTE': 403 (senha pendente)
    if (!filiado.senha_hash || filiado.senha_hash === 'PENDENTE') {
        log.warn("AuthLoginPendente", { userId: filiado.id, requestId });
        return res.status(403).json({
            error: "Sua senha ainda não foi definida ou está pendente. Por favor, utilize a opção 'Esqueci minha senha' ou o link de primeiro acesso enviado por e-mail."
        });
    }

    // Verificação de Estado do Cadastro (Arquivado)
    if (filiado.arquivado_em) {
        log.warn("AuthLoginBloqueado", { cpf: cpfNormalizado, status: "arquivado", requestId });
        return res
          .status(403)
          .json({ error: Textos.AUTH.CADASTRO_INATIVO });
    }

    // E) Comparação de senha com bcrypt
    // Se falhar (erro no bcrypt), o catch vai capturar e o errorHandler retornará 500
    const senhaOk = await bcrypt.compare(senha, filiado.senha_hash);

    if (!senhaOk) {
      log.warn("AuthLoginFalha", { userId: filiado.id, motivo: "SenhaIncorreta", requestId });
      // Ideal é retornar 401 se senha errada
      return res
        .status(401)
        .json({ error: Textos.AUTH.CREDENCIAIS_INVALIDAS });
    }

    // F) 2FA (se ativo)
    if (filiado.twofa_secret) {
      if (!token_2fa) {
        return res.status(400).json({
          error: Textos.AUTH.CODIGO_2FA_REQUERIDO,
          requires_2fa: true,
        });
      }

      const valido = speakeasy.totp.verify({
        secret: filiado.twofa_secret,
        encoding: "base32",
        token: token_2fa,
        window: 1,
      });

      if (!valido) {
        log.warn("AuthLogin2FAFalha", { cpf: cpfNormalizado, requestId });
        return res.status(400).json({
          error: Textos.AUTH.CODIGO_2FA_INVALIDO,
        });
      }
    }

    await registrarUltimoAcesso(filiado.id);

    // G) JWT assinado com JWT_SECRET
    const token = gerarToken(filiado);

    log.info("AuthLoginSucesso", {
      userId: filiado.id,
      perfil: filiado.perfil_acesso,
      requestId
    });

    return res.json({
      message: Textos.SUCESSO.LOGIN_REALIZADO,
      token,
      refreshToken: token,
      perfil_acesso: filiado.perfil_acesso || "CONSELHEIRO",
    });
  } catch (err) {
    // Erros inesperados ou falha no bcrypt.compare: 500 COM LOG via global handler
    log.error("AuthLoginErroInterno", { error: err.message, stack: err.stack, requestId });
    next(err);
  }
};

exports.ativar2fa = async (req, res, next) => {
  const requestId = req.requestId;
  try {
    const userId = req.user.id;
    const secret = speakeasy.generateSecret({ name: "FENAPRF" });
    const atualizado = await salvarTwoFaSecret(userId, secret.base32);

    if (!atualizado) {
      return res.status(400).json({ error: "Não foi possível ativar o 2FA." });
    }

    log.info("Auth2FAAtivado", { userId, requestId });

    return res.json({
      message: "2FA ativado com sucesso.",
      secret_base32: secret.base32,
      otpauth_url: secret.otpauth_url,
    });
  } catch (err) {
    log.error("Auth2FAAtivarErro", { error: err.message, requestId });
    next(err);
  }
};

exports.me = async (req, res, next) => {
  const requestId = req.requestId;
  try {
    const userId = req.user.id;
    const filiado = await buscarPorId(userId);

    if (!filiado) {
      return res.status(404).json({ error: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO });
    }

    const { senha_hash, password_hash, twofa_secret, ...limpo } = filiado;
    return res.json(limpo);
  } catch (err) {
    log.error("AuthMeErro", { error: err.message, requestId });
    next(err);
  }
};

exports.listarFiliados = async (req, res, next) => {
  const requestId = req.requestId;
  try {
    const perfil = req.user.perfil_acesso || "FILIADO";
    const lista = await listarParaPerfil(perfil);

    return res.json({
      perfil_acesso: perfil,
      total: lista.length,
      filiados: lista,
    });
  } catch (err) {
    log.error("AuthListarFiliadosErro", { error: err.message, requestId });
    next(err);
  }
};
