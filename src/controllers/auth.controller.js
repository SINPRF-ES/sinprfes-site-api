// src/controllers/auth.controller.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
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
  try {
    const { cpf, senha, token_2fa } = req.body || {};

    if (!cpf || !senha) {
      return res
        .status(400)
        .json({ error: Textos.AUTH.INFORME_CREDENCIAIS }); // ✨
    }

    const cpfNormalizado = normalizarCpf(cpf);
    const filiado = await buscarPorCpf(cpfNormalizado);

    if (!filiado || !filiado.senha_hash) {
      log.warn("AuthLoginFalha", { cpf: cpfNormalizado, motivo: "CredenciaisInvalidas" });
      return res
        .status(400)
        .json({ error: Textos.AUTH.CREDENCIAIS_INVALIDAS }); // ✨
    }

    // Verificação de Situação Funcional (Case Insensitive)
    if (filiado.situacao) {
      if (filiado.situacao.toUpperCase() !== "ATIVO") {
        log.warn("AuthLoginBloqueado", { cpf: cpfNormalizado, situacao: filiado.situacao });
        return res
          .status(400)
          .json({ error: Textos.AUTH.CADASTRO_INATIVO }); // ✨
      }
    }

    const senhaOk = await bcrypt.compare(senha, filiado.senha_hash);

    if (!senhaOk) {
      log.warn("AuthLoginFalha", { cpf: cpfNormalizado, motivo: "SenhaIncorreta" });
      return res
        .status(400)
        .json({ error: Textos.AUTH.CREDENCIAIS_INVALIDAS }); // ✨
    }

    // Se tiver 2FA cadastrado, exige o token
    if (filiado.twofa_secret) {
      if (!token_2fa) {
        return res.status(400).json({
          error: Textos.AUTH.CODIGO_2FA_REQUERIDO, // ✨
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
        log.warn("AuthLogin2FAFalha", { cpf: cpfNormalizado });
        return res.status(400).json({
          error: Textos.AUTH.CODIGO_2FA_INVALIDO, // ✨
        });
      }
    }

    await registrarUltimoAcesso(filiado.id);

    const token = gerarToken(filiado);

    log.info("AuthLoginSucesso", { 
      userId: filiado.id, 
      perfil: filiado.perfil_acesso,
      ip: req.ip 
    });

    return res.json({
      message: Textos.SUCESSO.LOGIN_REALIZADO, // ✨
      token,
      perfil_acesso: filiado.perfil_acesso || "FILIADO",
    });
  } catch (err) {
    log.error("AuthLoginErroInterno", err);
    return res.status(500).json({ error: Textos.ERROS_INTERNOS.LOGIN }); // ✨
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

    log.info("Auth2FAAtivado", { userId });

    return res.json({
      message: "2FA ativado com sucesso. Configure no app autenticador.", // Mantido
      secret_base32: secret.base32,
      otpauth_url: secret.otpauth_url,
    });
  } catch (err) {
    log.error("Auth2FAAtivarErro", err);
    return res.status(500).json({ error: Textos.ERROS_INTERNOS.ATUALIZAR_DADOS }); // ✨
  }
};

exports.me = async (req, res) => {
  try {
    const userId = req.user.id;
    const filiado = await buscarPorId(userId);

    if (!filiado) {
      return res.status(404).json({ error: Textos.FILIADOS.FILIADO_NAO_ENCONTRADO }); // ✨
    }

    const { senha_hash, twofa_secret, ...limpo } = filiado;
    return res.json(limpo);
  } catch (err) {
    log.error("AuthMeErro", err);
    return res.status(500).json({ error: Textos.ERROS_INTERNOS.CARREGAR_DADOS }); // ✨
  }
};

exports.listarFiliados = async (req, res) => {
  try {
    const perfil = req.user.perfil_acesso || "FILIADO";
    const lista = await listarParaPerfil(perfil);

    return res.json({
      perfil_acesso: perfil,
      total: lista.length,
      filiados: lista,
    });
  } catch (err) {
    log.error("AuthListarFiliadosErro", err);
    return res.status(500).json({ error: Textos.ERROS_INTERNOS.LISTAR_FILIADOS }); // ✨
  }
};