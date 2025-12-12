// src/middlewares/auth.js
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Token não informado." });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Validação mínima do payload
    if (!payload || !payload.id) {
      return res.status(401).json({ error: "Token inválido." });
    }

    // ✅ Consulta o banco para garantir que o usuário ainda existe
    // e para aplicar regras de bloqueio/arquivamento no nível do auth.
    const { rows } = await pool.query(
      `
      SELECT id, cpf, nome, perfil_acesso, bloqueado, arquivado_em
      FROM filiados
      WHERE id = $1
      LIMIT 1
      `,
      [payload.id]
    );

    const userDb = rows[0];

    if (!userDb) {
      return res.status(401).json({ error: "Usuário não encontrado." });
    }

    // ✅ Bloqueio administrativo (ex.: desligado do portal)
    if (userDb.bloqueado) {
      return res.status(403).json({ error: "Acesso bloqueado. Contate o sindicato." });
    }

    // ✅ Arquivamento administrativo (separado da situação funcional)
    if (userDb.arquivado_em) {
      return res.status(403).json({ error: "Cadastro arquivado. Acesso indisponível. Contate o sindicato." });
    }

    // Preferir dados do banco (autoridade) em vez do payload antigo
    req.user = {
      id: userDb.id,
      cpf: userDb.cpf,
      nome: userDb.nome,
      perfil_acesso: (userDb.perfil_acesso || "FILIADO").toUpperCase(),
    };

    return next();
  } catch (err) {
    console.error("Erro no middleware de auth:", err);
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
};
