const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const repasseController = require("../controllers/repasse.controller");

// Acesso restrito via middleware de permissão
const checkPermission = (perm) => {
  return (req, res, next) => {
    if (!req.user || !req.user.permissoes || (!req.user.permissoes.includes(perm) && !req.user.permissoes.includes("*"))) {
      return res.status(403).json({ success: false, message: "Acesso negado." });
    }
    next();
  };
};

router.get("/", auth, checkPermission("REPASSE_GERENCIAR"), repasseController.getRepasseAno);
router.post("/", auth, checkPermission("REPASSE_GERENCIAR"), repasseController.updateRepasseMes);
router.get("/responsaveis", auth, checkPermission("REPASSE_GERENCIAR"), repasseController.listarResponsaveis);

module.exports = router;
