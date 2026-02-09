const express = require("express");
const router = express.Router();
const logisticaController = require("../controllers/logistica.controller");
const authMiddleware = require("../middlewares/auth");
const roleMiddleware = require("../middlewares/roleMiddleware");

// Todas as rotas de logística exigem autenticação
router.use(authMiddleware);

// --- EVENTOS ---
router.get("/eventos", logisticaController.listarEventos);
router.post("/eventos", roleMiddleware(["LOGISTICA_GERENCIAR"]), logisticaController.criarEvento);
router.put("/eventos/:id", roleMiddleware(["LOGISTICA_GERENCIAR"]), logisticaController.atualizarEvento);

// --- INSCRIÇÕES ---
router.get("/eventos/:eventoId/inscricoes", logisticaController.listarInscricoes);
router.post("/inscricoes", logisticaController.registrarMinhaInscricao);
router.delete("/eventos/:eventoId/minha-inscricao", logisticaController.cancelarMinhaInscricao);

// --- GESTÃO DE INSCRIÇÕES ---
router.put("/inscricoes/:id", roleMiddleware(["LOGISTICA_GERENCIAR"]), logisticaController.atualizarInscricaoTerceiro);
router.delete("/inscricoes/:id", roleMiddleware(["LOGISTICA_GERENCIAR"]), logisticaController.cancelarInscricaoTerceiro);

// --- EXPORTAÇÃO ---
router.get("/eventos/:eventoId/exportar/pdf", roleMiddleware(["LOGISTICA_GERENCIAR"]), logisticaController.exportarPdf);
router.get("/eventos/:eventoId/exportar/xls", roleMiddleware(["LOGISTICA_GERENCIAR"]), logisticaController.exportarXls);

module.exports = router;
