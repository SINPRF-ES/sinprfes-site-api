// src/routes/eventoVotacoes.routes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const controller = require("../controllers/eventoVotacoes.controller");

// listar votações do evento
router.get("/:id/votacoes", authMiddleware, controller.listar);

// detalhe
router.get("/:id/votacoes/:votacaoId", authMiddleware, controller.detalhe);

// criar votação sim/não (diretoria)
router.post("/:id/votacoes", authMiddleware, requirePermission("EVENTOS_GERENCIAR"), controller.criarSimNao);

// abrir votação (diretoria)
router.post("/:id/votacoes/:votacaoId/abrir", authMiddleware, requirePermission("EVENTOS_GERENCIAR"), controller.abrir);

// votar (participante)
router.post("/:id/votacoes/:votacaoId/votar", authMiddleware, controller.votar);

module.exports = router;
