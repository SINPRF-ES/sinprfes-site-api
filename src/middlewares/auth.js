// src/middlewares/auth.js
const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Token não informado." });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Payload vem do login: { id, cpf, nome, perfil_acesso }
    req.user = {
      id: payload.id,
      cpf: payload.cpf,
      nome: payload.nome,
      perfil_acesso: payload.perfil_acesso || "FILIADO",
    };

    return next();
  } catch (err) {
    console.error("Erro no middleware de auth:", err);
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
};
