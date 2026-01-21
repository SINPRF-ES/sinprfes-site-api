// src/routes/assembleias.routes.js
const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const controller = require("../controllers/assembleias.controller");

// Todos autenticados podem listar e ver detalhes (respeitando regra de estado no service)
router.get("/", auth, controller.listar);
router.get("/:id", auth, controller.detalhe);

// DIRETORIA/ADMIN podem criar, abrir e encerrar
router.post("/", auth, requirePermission("DIRETORIA"), controller.criar);
router.patch("/:id/abrir", auth, requirePermission("DIRETORIA"), controller.abrir);
router.patch("/:id/encerrar", auth, requirePermission("DIRETORIA"), controller.encerrar);

 // Presença e Quórum
 router.post("/:id/quorum", auth, requirePermission("DIRETORIA"), controller.gerarTokenQuorum);
 router.post("/:id/checkin", auth, controller.checkin); // Check-in é aberto a todos com token

module.exports = router;
