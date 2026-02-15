// src/controllers/auth.controller.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../config/db");
const { normalizarCpf } = require("../utils/format");
const log = require("../utils/log");
const Textos = require("../utils/textos");

// FENAPRF: Usamos users.service
const usersService = require("../services/users.service");

/**
 * Geração de Token JWT de Acesso (curto: 15 min).
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
    { expiresIn: "15m" }
  );
}

/**
 * Geração de Refresh Token (opaco, 30 dias).
 */
function gerarRefreshToken() {
  return crypto.randomBytes(40).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * LOGIN: Autenticação com suporte a Refresh Token e DeviceId.
 */
exports.login = async (req, res, next) => {
  const { cpf, senha, deviceId } = req.body || {};
  const requestId = req.requestId;

  try {
    log.info("AuthLoginIniciado", {
      cpf: cpf ? `${cpf.substring(0, 3)}.***.***-**` : null,
      deviceId,
      requestId
    });

    if (!cpf || !senha) {
      return res
        .status(400)
        .json({ error: Textos.AUTH.INFORME_CREDENCIAIS });
    }

    const cpfNormalizado = normalizarCpf(cpf);
    const user = await usersService.buscarPorCpf(cpfNormalizado);

    if (!user) {
      log.warn("AuthLoginFalha", { cpf: cpfNormalizado, motivo: "UserNaoEncontrado", requestId });
      return res.status(401).json({ error: Textos.AUTH.CREDENCIAIS_INVALIDAS });
    }

    if (user.bloqueado || user.arquivado_em) {
      return res.status(403).json({ error: Textos.AUTH.CADASTRO_INATIVO });
    }

    if (!user.senha_hash || user.senha_hash === 'PENDENTE') {
      return res.status(403).json({
        error: "Sua senha ainda não foi definida. Use 'Esqueci minha senha'."
      });
    }

    const senhaOk = await bcrypt.compare(senha, user.senha_hash);
    if (!senhaOk) {
      log.warn("AuthLoginFalha", { userId: user.id, motivo: "SenhaIncorreta", requestId });
      return res.status(401).json({ error: Textos.AUTH.CREDENCIAIS_INVALIDAS });
    }

    await usersService.registrarUltimoAcesso(user.id);

    const accessToken = gerarToken(user);
    const refreshToken = gerarRefreshToken();

    // Persistir sessão (refresh token)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await pool.query(
      `INSERT INTO auth_sessions (user_id, token_hash, device_id, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [user.id, hashToken(refreshToken), deviceId || null, expiresAt]
    );

    log.info("AuthLoginSucesso", { userId: user.id, deviceId, requestId });

    // FENAPRF: Usar helper centralizado para projeção segura
    const userResponse = usersService.formatUserResponse(user);

    return res.json({
      message: Textos.SUCESSO.LOGIN_REALIZADO,
      token: accessToken,
      refreshToken: refreshToken,
      perfil_acesso: user.perfil_acesso || "CONSELHEIRO",
      user: userResponse
    });
  } catch (err) {
    log.error("AuthLoginErroInterno", { error: err.message, requestId });
    next(err);
  }
};

/**
 * REFRESH: Renova o Access Token usando um Refresh Token válido.
 * Implementa rotação do Refresh Token com transação atômica.
 */
exports.refresh = async (req, res, next) => {
  const { refreshToken, deviceId } = req.body || {};
  const requestId = req.requestId;
  const atorId = req.user?.id;

  if (!refreshToken) {
    return res.status(400).json({ error: "Refresh token não informado." });
  }

  const client = await pool.connect();
  try {
    const tokenHash = hashToken(refreshToken);

    // Busca a sessão ativa
    const { rows } = await client.query(
      `SELECT s.*, u.id as user_id, u.cpf, u.name, u.perfil_acesso, u.bloqueado, u.arquivado_em,
              u.email, u.uf, u.cargo, u.cargo_mandato_inicio, u.cargo_mandato_fim, u.avatar_url,
              u.data_nascimento, u.sexo, u.perfil_acesso2, u.cargo2, u.uf2
       FROM auth_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );

    const sessao = rows[0];

    if (!sessao) {
      log.warn("AuthRefreshFalha", { reason: "TokenInvalidoOuExpirado", requestId, userId: atorId });
      return res.status(401).json({ error: "Sessão expirada. Faça login novamente." });
    }

    if (sessao.device_id && deviceId && sessao.device_id !== deviceId) {
       log.error("AuthRefreshDeviceIdMismatch", {
           userId: sessao.user_id,
           atorId,
           expected: sessao.device_id,
           received: deviceId,
           requestId
       });
       return res.status(409).json({ error: "Sessão inválida neste dispositivo." });
    }

    if (sessao.bloqueado || sessao.arquivado_em) {
      return res.status(403).json({ error: Textos.AUTH.CADASTRO_INATIVO });
    }

    // Rotação: Atômica via Transação
    await client.query("BEGIN");

    const newRefreshToken = gerarRefreshToken();
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 30);

    await client.query(
      `UPDATE auth_sessions
       SET revoked_at = NOW(), last_seen_at = NOW()
       WHERE id = $1`,
      [sessao.id]
    );

    await client.query(
      `INSERT INTO auth_sessions (user_id, token_hash, device_id, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [sessao.user_id, hashToken(newRefreshToken), deviceId || sessao.device_id, newExpiresAt]
    );

    await client.query("COMMIT");

    const accessToken = gerarToken({
      id: sessao.user_id,
      cpf: sessao.cpf,
      name: sessao.name,
      perfil_acesso: sessao.perfil_acesso
    });

    log.info("AuthRefreshSucesso", { userId: sessao.user_id, atorId, requestId });

    // FENAPRF: Retornar também o usuário atualizado no refresh para reidratação
    const userResponse = usersService.formatUserResponse(sessao);

    return res.json({
      token: accessToken,
      refreshToken: newRefreshToken,
      user: userResponse
    });
  } catch (err) {
    if (client) await client.query("ROLLBACK");
    log.error("AuthRefreshErro", { error: err.message, requestId, userId: atorId });
    next(err);
  } finally {
    client.release();
  }
};

/**
 * LOGOUT: Revoga o Refresh Token atual.
 */
exports.logout = async (req, res, next) => {
  const { refreshToken } = req.body || {};
  const requestId = req.requestId;
  const atorId = req.user?.id;

  try {
    if (refreshToken) {
      await pool.query(
        "UPDATE auth_sessions SET revoked_at = NOW() WHERE token_hash = $1",
        [hashToken(refreshToken)]
      );
    }
    return res.json({ success: true });
  } catch (err) {
    log.error("AuthLogoutErro", { error: err.message, requestId, userId: atorId });
    next(err);
  }
};

/**
 * LOGOUT ALL: Revoga todas as sessões do usuário.
 */
exports.logoutAll = async (req, res, next) => {
  const requestId = req.requestId;
  const atorId = req.user?.id;

  try {
    if (!atorId) return res.status(401).json({ message: "Sessão inválida ou ator não identificado." });

    await pool.query(
      "UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1",
      [atorId]
    );
    return res.json({ success: true });
  } catch (err) {
    log.error("AuthLogoutAllErro", { error: err.message, requestId, userId: atorId });
    next(err);
  }
};

/**
 * ME: Dados do próprio membro logado.
 */
exports.me = async (req, res, next) => {
  const requestId = req.requestId;
  const atorId = req.user?.id;
  try {
    if (!atorId) return res.status(401).json({ message: "Sessão inválida ou ator não identificado." });

    const user = await usersService.buscarPorId(atorId);

    if (!user) {
      return res.status(404).json({ error: Textos.USERS.USER_NAO_ENCONTRADO });
    }

    const safeUser = usersService.formatUserResponse(user);

    log.info("AuthMeSucesso", { userId: user.id, requestId, atorId });
    return res.json(safeUser);
  } catch (err) {
    log.error("AuthMeErro", { error: err.message, requestId, userId: atorId });
    next(err);
  }
};

/**
 * LISTAR: Listagem de membros para perfis autorizados.
 */
exports.listarUsers = async (req, res, next) => {
  const requestId = req.requestId;
  const atorId = req.user?.id;
  try {
    if (!atorId) return res.status(401).json({ message: "Sessão inválida ou ator não identificado." });

    const perfil = req.user.perfil_acesso || "CONSELHEIRO";
    const lista = await usersService.listarParaPerfil(perfil);

    return res.json({
      perfil_acesso: perfil,
      total: lista.length,
      users: lista,
    });
  } catch (err) {
    log.error("AuthListarUsersErro", { error: err.message, requestId, userId: atorId });
    next(err);
  }
};
