const rolesConfig = require("../config/roles.config");

/**
 * requirePermission("SOME_PERMISSION")
 * - Exige que o auth middleware tenha populado req.user
 * - Lê perfil a partir de req.user.perfil_acesso (fonte de verdade do seu auth.js)
 * - Suporta curinga "*" no roles.config (ex.: ADMIN: ["*"])
 */
function requirePermission(permission) {
  return (req, res, next) => {
    const user = req.user;

    // auth.js popula req.user com { id, cpf, nome, perfil_acesso }
    const perfilAcesso = user && (user.perfil_acesso || user.perfil || user.role);

    if (!user || !perfilAcesso) {
      return res.status(401).json({ error: "Usuário não autenticado." });
    }

    const perfil = String(perfilAcesso).toUpperCase();
    const permissoes = rolesConfig[perfil];

    if (!Array.isArray(permissoes)) {
      return res.status(403).json({
        error: "Perfil sem permissões configuradas.",
      });
    }

    // ✅ CURINGA: perfil com "*" tem todas as permissões
    if (permissoes.includes("*")) return next();

    // ✅ Permissão específica
    if (permissoes.includes(permission)) return next();

    return res.status(403).json({
      error: "Permissão insuficiente.",
      permissionRequired: permission,
    });
  };
}

module.exports = requirePermission;
