const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const repasseController = require("../controllers/repasse.controller");

router.get("/", auth, requirePermission("REPASSE_GERENCIAR"), repasseController.getRepasseAno);
router.post("/", auth, requirePermission("REPASSE_GERENCIAR"), repasseController.updateRepasseMes);

router.get("/resumo", auth, requirePermission("REPASSE_GERENCIAR"), repasseController.getResumo);
router.put("/config", auth, requirePermission("REPASSE_GERENCIAR"), repasseController.updateConfig);

router.post("/eventos", auth, requirePermission("REPASSE_GERENCIAR"), repasseController.criarEvento);
router.put("/eventos/:id", auth, requirePermission("REPASSE_GERENCIAR"), repasseController.atualizarEvento);
router.post("/eventos/:id/abrir", auth, requirePermission("REPASSE_GERENCIAR"), repasseController.abrirEvento);
router.post("/eventos/:id/encerrar", auth, requirePermission("REPASSE_GERENCIAR"), repasseController.encerrarEvento);

router.get("/eventos", auth, requirePermission("REPASSE_GERENCIAR"), repasseController.listarEventos);
router.post("/eventos/:id/alocar", auth, requirePermission("REPASSE_GERENCIAR"), repasseController.alocarMeuRecurso);

router.get("/responsaveis", auth, requirePermission("REPASSE_GERENCIAR"), repasseController.listarResponsaveis);

router.get("/movimentos", auth, requirePermission("REPASSE_GERENCIAR"), repasseController.listarMovimentos);
router.post("/movimentos", auth, requirePermission("REPASSE_GERENCIAR"), repasseController.criarMovimento);
router.put("/movimentos/:id", auth, requirePermission("REPASSE_GERENCIAR"), repasseController.atualizarMovimento);
router.delete("/movimentos/:id", auth, requirePermission("REPASSE_GERENCIAR"), repasseController.excluirMovimento);

module.exports = router;
