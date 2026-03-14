// src/controllers/auth.controller.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const { v4: uuidv4 } = require("uuid");
const { normalizarCpf } = require("../utils/format");
const log = require("../utils/log");
const Textos = require("../utils/textos"); // 🟢 TEXTOS

const {
  buscarPorCpf,
  buscarPorId,
  salvarTwoFaSecret,
  registrarUltimoAcesso,
  listarParaPerfil,
} = require("../services/filiados.service");
const authService = require("../services/auth.service");
const rolesConfig = require("../config/roles.config");

function gerarToken(filiado) {
  const perfil = filiado.perfil_acesso || "FILIADO";

  return jwt.sign(
    {
      id: filiado.id,
      cpf: filiado.cpf,
      nome: filiado.nome,
      perfil_acesso: perfil,
    },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
}

exports.login = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  try {
    const { cpf, senha, token_2fa } = req.body || {};

    if (!cpf || !senha) {
      return res
        .status(400)
        .json({ error: Textos.AUTH.INFORME_CREDENCIAIS, requestId }); // ✨
    }

    const cpfNormalizado = normalizarCpf(cpf);
    const filiado = await buscarPorCpf(cpfNormalizado);

    if (!filiado || !filiado.senha_hash) {
      log.warn("AuthLoginFalha", { cpf: cpfNormalizado, motivo: "CredenciaisInvalidas", requestId });
      return res
        .status(400)
        .json({ error: Textos.AUTH.CREDENCIAIS_INVALIDAS, requestId }); // ✨
    }

    // Verificação de Estado do Cadastro (Arquivado)
    if (filiado.arquivado_em) {
        log.warn("AuthLoginBloqueado", { cpf: cpfNormalizado, status: "arquivado", requestId });
        return res
          .status(403)
          .json({ error: Textos.AUTH.CADASTRO_INATIVO, requestId });
    }

    const senhaOk = await bcrypt.compare(senha, filiado.senha_hash);

    if (!senhaOk) {
      log.warn("AuthLoginFalha", { cpf: cpfNormalizado, motivo: "SenhaIncorreta", requestId });
      return res
        .status(400)
        .json({ error: Textos.AUTH.CREDENCIAIS_INVALIDAS, requestId }); // ✨
    }

    // Se tiver 2FA cadastrado, exige o token
    if (filiado.twofa_secret) {
      if (!token_2fa) {
        return res.status(400).json({
          error: Textos.AUTH.CODIGO_2FA_REQUERIDO, // ✨
          requires_2fa: true,
          requestId
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
          error: Textos.AUTH.CODIGO_2FA_INVALIDO, // ✨
          requestId
        });
      }
    }

    await registrarUltimoAcesso(filiado.id);

    const token = gerarToken(filiado);

    // Geração do Refresh Token para Sessão Persistente
    const deviceInfo = {
      deviceId: req.body.device_id,
      deviceName: req.body.device_name,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
      platform: req.body.platform,
    };

    const refreshToken = await authService.createRefreshToken(filiado.id, deviceInfo);

    log.info("AuthLoginSucesso", { 
      userId: filiado.id, 
      perfil: filiado.perfil_acesso,
      ip: req.ip,
      requestId,
      hasRefreshToken: true
    });

    const perfil = (filiado.perfil_acesso || "FILIADO").toUpperCase();
    const permissions = rolesConfig[perfil] || [];

    return res.json({
      message: Textos.SUCESSO.LOGIN_REALIZADO, // ✨
      token,
      refreshToken,
      perfil_acesso: perfil,
      permissions,
      requestId
    });
  } catch (err) {
    log.error("AuthLoginErroInterno", { error: err, requestId });
    return res.status(500).json({ error: Textos.ERROS_INTERNOS.LOGIN, requestId }); // ✨
  }
};

exports.ativar2fa = async (req, res) => {
  try {
    const userId = req.user.id;

    const secret = speakeasy.generateSecret({
      name: "SINPRF-ES (Área Restrita)",
    });

    const atualizado = await salvarTwoFaSecret(userId, secret.base32);

    if (!atualizado) {
      return res
        .status(400)
        .json({ error: "Não foi possível ativar o 2FA." }); // Mantido, pois é uma mensagem específica de falha de DB
    }

    log.info("Auth2FAAtivado", { userId, requestId: req.requestId });

    return res.json({
      message: "2FA ativado com sucesso. Configure no app autenticador.", // Mantido
      secret_base32: secret.base32,
      otpauth_url: secret.otpauth_url,
    });
  } catch (err) {
    log.error("Auth2FAAtivarErro", { error: err, requestId: req.requestId, userId: req.user?.id });
    return res.status(500).json({ error: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS }); // ✨
  }
};

exports.refresh = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token não informado.", requestId });
    }

    const tokenRecord = await authService.verifyRefreshToken(refreshToken);

    if (!tokenRecord) {
      log.warn("AuthRefreshFalha", { ip: req.ip, reason: "InvalidOrExpired", requestId });
      return res.status(401).json({ error: "Sessão expirada. Por favor, faça login novamente.", requestId });
    }

    const filiado = await buscarPorId(tokenRecord.filiado_id);
    if (!filiado || filiado.arquivado_em) {
      return res.status(401).json({ error: "Usuário inativo ou não encontrado.", requestId });
    }

    // Gera novo Access Token
    const accessToken = gerarToken(filiado);

    // Rotaciona o Refresh Token
    const deviceInfo = {
      deviceId: req.body.device_id || tokenRecord.device_id,
      deviceName: req.body.device_name || tokenRecord.device_name,
      userAgent: req.headers["user-agent"] || tokenRecord.user_agent,
      ip: req.ip,
      platform: req.body.platform || tokenRecord.platform,
    };

    const newRefreshToken = await authService.rotateRefreshToken(tokenRecord.id, filiado.id, deviceInfo);

    log.info("AuthRefreshSucesso", { userId: filiado.id, requestId });

    return res.json({
      token: accessToken,
      refreshToken: newRefreshToken,
      requestId
    });
  } catch (err) {
    log.error("AuthRefreshErroInterno", { error: err, requestId });
    return res.status(500).json({ error: Textos.ERROS_INTERNOS.LOGIN, requestId });
  }
};

exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      // Valida o token antes de revogar para garantir segurança
      const tokenRecord = await authService.verifyRefreshToken(refreshToken);
      if (tokenRecord) {
        await authService.revokeRefreshToken(tokenRecord.id, "Logout");
      }
    }
    return res.json({ message: "Logout realizado com sucesso." });
  } catch (err) {
    log.error("AuthLogoutErro", { error: err });
    return res.status(500).json({ error: "Erro ao realizar logout." });
  }
};

exports.me = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  try {
    const filiado = await buscarPorId(atorId);

    if (!filiado) {
      log.warn("AuthMeNaoEncontrado", { requestId, atorId });
      return res.status(404).json({ error: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO, requestId });
    }

    const { senha_hash, twofa_secret, ...limpo } = filiado;
    const perfil = (limpo.perfil_acesso || "FILIADO").toUpperCase();
    const permissions = rolesConfig[perfil] || [];

    log.info("AuthMeSucesso", { requestId, atorId, perfil });
    return res.json({ ...limpo, permissions, requestId });
  } catch (err) {
    log.error("AuthMeErro", { error: err, requestId, userId: atorId });
    return res.status(500).json({ error: Textos.ERROS_INTERNOS.CARREGAR_DADOS, requestId });
  }
};

exports.listarFiliados = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ error: "Não autenticado", requestId });

  try {
    const perfil = req.user.perfil_acesso || "FILIADO";
    const lista = await listarParaPerfil(perfil);

    log.info("AuthListarFiliadosSucesso", { requestId, atorId, perfil, total: lista.length });
    return res.json({
      perfil_acesso: perfil,
      total: lista.length,
      filiados: lista,
      requestId
    });
  } catch (err) {
    log.error("AuthListarFiliadosErro", { error: err, requestId, userId: atorId });
    return res.status(500).json({ error: Textos.ERROS_INTERNOS.LISTAR_FILIADOS, requestId });
  }
};