// src/routes/assembleias.routes.js
const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const controller = require("../controllers/assembleias.controller");

// Todos autenticados podem listar e ver detalhes
router.get("/", auth, controller.listar);
router.get("/:id", auth, controller.detalhe);
router.get("/:id/estado", auth, controller.estadoCompleto);

// DIRETORIA/ADMIN podem criar, abrir e encerrar
router.post("/", auth, requirePermission("DIRETORIA"), controller.criar);
router.patch("/:id/abrir", auth, requirePermission("DIRETORIA"), controller.abrir);
router.patch("/:id/encerrar", auth, requirePermission("DIRETORIA"), controller.encerrar);

// Presença e Quórum
router.post("/:id/quorum", auth, requirePermission("DIRETORIA"), controller.gerarTokenQuorum);
router.post("/:id/checkin", auth, controller.checkin);

// Votações
router.post("/:id/votacao", auth, requirePermission("DIRETORIA"), controller.iniciarVotacao);
router.post("/:id/votacao/:vid/votar", auth, controller.votar);

// Interação
router.post("/:id/pedir-palavra", auth, controller.pedirPalavra);
router.post("/:id/propostas", auth, controller.criarProposta);
router.post("/:id/mesa", auth, requirePermission("DIRETORIA"), controller.definirMesa);

module.exports = router;
