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
router.post("/", auth, requirePermission("VOTACAO_GERENCIAR"), controller.criar);
router.patch("/:id/abrir", auth, requirePermission("VOTACAO_GERENCIAR"), controller.abrir);
router.patch("/:id/encerrar", auth, requirePermission("VOTACAO_GERENCIAR"), controller.encerrar);

// Presença e Quórum
router.post("/:id/quorum", auth, requirePermission("VOTACAO_GERENCIAR"), controller.gerarTokenQuorum);
router.post("/:id/checkin", auth, controller.checkin);

// Votações
router.post("/:id/votacao", auth, requirePermission("VOTACAO_GERENCIAR"), controller.iniciarVotacao);
router.post("/:id/votacao/:vid/votar", auth, controller.votar);

// Interação
router.post("/:id/pedir-palavra", auth, controller.pedirPalavra);
router.post("/:id/propostas", auth, controller.criarProposta);
router.post("/:id/mesa", auth, requirePermission("VOTACAO_GERENCIAR"), controller.definirMesa);

module.exports = router;
