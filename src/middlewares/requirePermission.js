const rolesConfig = require("../config/roles.config");
const Textos = require("../utils/textos");

function requirePermission(permission) {
  return (req, res, next) => {
    const user = req.user;
    const perfilAcesso = user && (user.perfil_acesso || user.perfil || user.role);

    if (!user || !perfilAcesso) {
      return res.status(401).json({ error: Textos.AUTH.TOKEN_INVALIDO });
    }

    const perfil = String(perfilAcesso).toUpperCase();
    const permissoes = rolesConfig[perfil];

    if (!Array.isArray(permissoes)) {
      return res.status(403).json({ error: Textos.AUTH.PERMISSAO_INSUFICIENTE });
    }

    if (permissoes.includes("*")) return next();
    if (permissoes.includes(permission)) return next();

    return res.status(403).json({
      error: Textos.AUTH.PERMISSAO_INSUFICIENTE,
      permissionRequired: permission,
    });
  };
}

module.exports = requirePermission;
