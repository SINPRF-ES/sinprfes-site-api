const jwt = require("jsonwebtoken");
const pool = require("../config/db");

module.exports = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return next();
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload || !payload.id) return next();

    const { rows } = await pool.query(
      "SELECT id, cpf, nome, perfil_acesso, bloqueado, arquivado_em, situacao_sindical FROM filiados WHERE id = $1 LIMIT 1",
      [payload.id]
    );

    const userDb = rows[0];
    if (!userDb || userDb.bloqueado || userDb.arquivado_em || userDb.situacao_sindical !== "FILIADO_SINPRF_ES") {
      return next();
    }

    req.user = {
      id: userDb.id,
      cpf: userDb.cpf,
      nome: userDb.nome,
      perfil_acesso: (userDb.perfil_acesso || "FILIADO").toUpperCase(),
      situacao_sindical: userDb.situacao_sindical,
    };

    return next();
  } catch (_err) {
    return next();
  }
};
