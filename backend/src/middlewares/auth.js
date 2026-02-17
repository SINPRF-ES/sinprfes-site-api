// src/middlewares/auth.js
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const Textos = require("../utils/textos");

module.exports = async (req, res, next) => {
  const requestId = req.requestId;
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: Textos.AUTH.TOKEN_NAO_INFORMADO, requestId });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      return res.status(401).json({ error: Textos.AUTH.TOKEN_INVALIDO, requestId });
    }

    if (!payload || !payload.id) {
      return res.status(401).json({ error: Textos.AUTH.TOKEN_INVALIDO, requestId });
    }

    const { rows } = await pool.query(
      "SELECT id, cpf, nome, perfil_acesso, bloqueado, arquivado_em FROM filiados WHERE id = $1 LIMIT 1",
      [payload.id]
    );

    const userDb = rows[0];

    if (!userDb) {
      return res.status(401).json({ error: Textos.AUTH.TOKEN_INVALIDO, requestId });
    }

    if (userDb.bloqueado) {
      return res.status(403).json({ error: Textos.AUTH.ACESSO_BLOQUEADO, requestId });
    }

    if (userDb.arquivado_em) {
      return res.status(403).json({ error: Textos.AUTH.CADASTRO_INATIVO, requestId });
    }

    req.user = {
      id: userDb.id,
      cpf: userDb.cpf,
      nome: userDb.nome,
      perfil_acesso: (userDb.perfil_acesso || "FILIADO").toUpperCase(),
    };

    return next();
  } catch (err) {
    return res.status(401).json({ error: Textos.AUTH.TOKEN_INVALIDO, requestId });
  }
};
