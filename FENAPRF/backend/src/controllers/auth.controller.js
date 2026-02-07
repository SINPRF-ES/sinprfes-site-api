// src/controllers/auth.controller.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { normalizarCpf } = require("../utils/format");
const log = require("../utils/log");
const Textos = require("../utils/textos");

// FENAPRF: Usamos users.service em vez de users.service
const usersService = require("../services/users.service");

/**
 * Geração de Token JWT com payload mínimo.
 */
function gerarToken(user) {
  const perfil = (user.perfil_acesso || "CONSELHEIRO").toUpperCase();

  return jwt.sign(
    {
      id: user.id,
      cpf: user.cpf,
      nome: user.name || user.nome,
      perfil_acesso: perfil,
    },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
}

/**
 * LOGIN: Autenticação exclusiva via public.users
 */
exports.login = async (req, res, next) => {
  const { cpf, senha } = req.body || {};
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
    const user = await usersService.buscarPorCpf(cpfNormalizado);

    // 1. Se usuário não existe -> 401
    if (!user) {
      log.warn("AuthLoginFalha", {
        cpf: cpfNormalizado ? `${cpfNormalizado.substring(0, 3)}.***.***-**` : null,
        motivo: "UserNaoEncontrado",
        requestId
      });
      return res
        .status(401)
        .json({ error: Textos.AUTH.CREDENCIAIS_INVALIDAS });
    }

    // 2. Se bloqueado=true ou arquivado_em não null -> 403
    if (user.bloqueado || user.arquivado_em) {
        log.warn("AuthLoginBloqueado", { userId: user.id, requestId });
        return res
          .status(403)
          .json({ error: Textos.AUTH.CADASTRO_INATIVO });
    }

    // 3. Se password_hash é null ou 'PENDENTE' -> 403
    if (!user.senha_hash || user.senha_hash === 'PENDENTE') {
        log.warn("AuthLoginPendente", { userId: user.id, requestId });
        return res.status(403).json({
            error: "Sua senha ainda não foi definida ou está pendente. Por favor, utilize a opção 'Esqueci minha senha' para definir sua primeira senha."
        });
    }

    // 4. Validar senha com bcrypt compare
    // Nota: senha_hash é alias para password_hash no service
    const senhaOk = await bcrypt.compare(senha, user.senha_hash);

    if (!senhaOk) {
      log.warn("AuthLoginFalha", { userId: user.id, motivo: "SenhaIncorreta", requestId });
      return res
        .status(401)
        .json({ error: Textos.AUTH.CREDENCIAIS_INVALIDAS });
    }

    await usersService.registrarUltimoAcesso(user.id);

    const token = gerarToken(user);

    log.info("AuthLoginSucesso", {
      userId: user.id,
      perfil: user.perfil_acesso,
      requestId
    });

    return res.json({
      message: Textos.SUCESSO.LOGIN_REALIZADO,
      token,
      refreshToken: token, // Alias simples para FENAPRF
      perfil_acesso: user.perfil_acesso || "CONSELHEIRO",
    });
  } catch (err) {
    log.error("AuthLoginErroInterno", { error: err.message, requestId });
    next(err);
  }
};

/**
 * ME: Dados do próprio usuário logado.
 */
exports.me = async (req, res, next) => {
  const requestId = req.requestId;
  try {
    const userId = req.user.id;
    const user = await usersService.buscarPorId(userId);

    if (!user) {
      return res.status(404).json({ error: Textos.USERS.USER_NAO_ENCONTRADO });
    }

    // Sanitização do payload (remover senhas)
    const { senha_hash, password_hash, twofa_secret, ...limpo } = user;
    return res.json(limpo);
  } catch (err) {
    log.error("AuthMeErro", { error: err.message, requestId });
    next(err);
  }
};

/**
 * LISTAR: Listagem de usuários para perfis autorizados.
 */
exports.listarUsers = async (req, res, next) => {
  const requestId = req.requestId;
  try {
    const perfil = req.user.perfil_acesso || "CONSELHEIRO";
    const lista = await usersService.listarParaPerfil(perfil);

    return res.json({
      perfil_acesso: perfil,
      total: lista.length,
      users: lista,
    });
  } catch (err) {
    log.error("AuthListarUsersErro", { error: err.message, requestId });
    next(err);
  }
};

// 2FA removido conforme solicitado (referência a twofa_secret e campos de users)
exports.ativar2fa = async (req, res) => {
    return res.status(400).json({ error: "Funcionalidade não disponível para este ambiente." });
};
