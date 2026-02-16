// src/routes/votacoes.routes.js
const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const controller = require("../controllers/votacoes.controller");

// Listar votações (autenticado)
router.get("/", auth, requirePermission("VOTACAO_VOTAR"), controller.listar);

// Detalhe
router.get("/:id", auth, requirePermission("VOTACAO_VOTAR"), controller.detalhe);

// Votar
router.post("/:id/votar", auth, requirePermission("VOTACAO_VOTAR"), controller.votar);

// ADMIN/DIRETORIA: criar
router.post("/", auth, requirePermission("VOTACAO_GERENCIAR"), controller.criar);

// ADMIN/DIRETORIA: abrir
router.post("/:id/abrir", auth, requirePermission("VOTACAO_GERENCIAR"), controller.abrir);

// ADMIN/DIRETORIA: encerrar
router.post("/:id/encerrar", auth, requirePermission("VOTACAO_GERENCIAR"), controller.encerrar);

// ADMIN/DIRETORIA: resultado (opcional, útil no painel)
router.get("/:id/resultado", auth, requirePermission("VOTACAO_GERENCIAR"), controller.resultado);

module.exports = router;
