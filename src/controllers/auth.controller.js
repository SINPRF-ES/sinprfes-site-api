// src/controllers/auth.controller.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const { normalizarCpf } = require("../utils/format");
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
        .json({ error: "Informe CPF e senha para entrar." });
    }

    const cpfNormalizado = normalizarCpf(cpf);
    const filiado = await buscarPorCpf(cpfNormalizado);

    if (!filiado || !filiado.senha_hash) {
      return res
        .status(400)
        .json({ error: "CPF ou senha inválidos." });
    }

    if (filiado.situacao && filiado.situacao !== "Ativo") {
      return res
        .status(400)
        .json({ error: "Seu cadastro não está ativo na base do sindicato." });
    }

    const senhaOk = await bcrypt.compare(senha, filiado.senha_hash);

    if (!senhaOk) {
      return res
        .status(400)
        .json({ error: "CPF ou senha inválidos." });
    }

    // Se tiver 2FA cadastrado, exige o token
    if (filiado.twofa_secret) {
      if (!token_2fa) {
        return res.status(400).json({
          error: "É necessário informar o código de 2FA.",
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
        return res.status(400).json({
          error: "Código 2FA inválido.",
        });
      }
    }

    await registrarUltimoAcesso(filiado.id);

    const token = gerarToken(filiado);

    return res.json({
      message: "Login realizado com sucesso.",
      token,
      perfil_acesso: filiado.perfil_acesso || "FILIADO",
    });
  } catch (err) {
    console.error("💥 Erro em /api/auth/login:", err);
    return res.status(500).json({ error: "Erro interno ao realizar login." });
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
        .json({ error: "Não foi possível ativar o 2FA." });
    }

    return res.json({
      message: "2FA ativado com sucesso. Configure no app autenticador.",
      secret_base32: secret.base32,
      otpauth_url: secret.otpauth_url,
    });
  } catch (err) {
    console.error("💥 Erro em /api/auth/2fa/ativar:", err);
    return res.status(500).json({ error: "Erro interno ao ativar 2FA." });
  }
};

exports.me = async (req, res) => {
  try {
    const userId = req.user.id;

    const filiado = await buscarPorId(userId);

    if (!filiado) {
      return res.status(404).json({ error: "Filiado não encontrado." });
    }

    // Não retornar hash nem segredo 2FA
    const {
      senha_hash,
      twofa_secret,
      ...limpo
    } = filiado;

    return res.json(limpo);
  } catch (err) {
    console.error("💥 Erro em /api/auth/me:", err);
    return res.status(500).json({ error: "Erro interno ao carregar seus dados." });
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
    console.error("💥 Erro em /api/auth/filiados:", err);
    return res.status(500).json({ error: "Erro interno ao listar filiados." });
  }
};
