// src/middlewares/requirePermission.js
const roles = require("../config/roles.config");

/**
 * Middleware de ACL (Access Control List).
 * Verifica se o perfil do usuário (req.user.perfil_acesso) possui a permissão requerida.
 * * Uso: router.get("/rota-protegida", authMiddleware, requirePermission("PERMISSAO_REQUERIDA"), controller.funcao);
 */
function requirePermission(permission) {
  return (req, res, next) => {
    // 1. Obtém o perfil do usuário logado (garantido pelo authMiddleware)
    const role = (req.user.perfil_acesso || "FILIADO").toUpperCase();

    // 2. Valida se o perfil existe no nosso mapa de roles
    if (!roles[role]) {
      return res.status(403).json({ error: "Perfil de acesso inválido ou desconhecido." });
    }

    const permissions = roles[role];

    // 3. Verifica se tem permissão global ('*') ou a permissão específica
    if (permissions.includes("*") || permissions.includes(permission)) {
      return next();
    }

    // 4. Acesso negado
    return res.status(403).json({ error: "Acesso negado. Permissão insuficiente." });
  };
}

module.exports = requirePermission;