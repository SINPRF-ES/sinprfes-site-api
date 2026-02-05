const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const repasseController = require("../controllers/repasse.controller");

router.get("/", auth, requirePermission("REPASSE_GERENCIAR"), repasseController.getRepasseAno);
router.post("/", auth, requirePermission("REPASSE_GERENCIAR"), repasseController.updateRepasseMes);
router.get("/responsaveis", auth, requirePermission("REPASSE_GERENCIAR"), repasseController.listarResponsaveis);

module.exports = router;
