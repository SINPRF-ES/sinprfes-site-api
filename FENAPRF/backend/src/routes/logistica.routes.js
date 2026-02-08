// src/routes/logistica.routes.js
const express = require("express");
const router = express.Router();
const logisticaController = require("../controllers/logistica.controller");
const authMiddleware = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");

// Middleware de autenticação obrigatório para todas as rotas
router.use(authMiddleware);

/**
 * ROTAS DE EVENTOS
 */

// Listar eventos (todos os usuários logados)
router.get("/eventos", logisticaController.listarEventos);

// Obter detalhe de um evento
router.get("/eventos/:id", logisticaController.obterEvento);

// Criar evento (apenas Gestão)
router.post("/eventos", requirePermission("LOGISTICA_GERENCIAR"), logisticaController.criarEvento);

// Atualizar evento (apenas Gestão)
router.put("/eventos/:id", requirePermission("LOGISTICA_GERENCIAR"), logisticaController.atualizarEvento);

// Cancelar evento (apenas Gestão)
router.delete("/eventos/:id", requirePermission("LOGISTICA_GERENCIAR"), logisticaController.cancelarEvento);

/**
 * ROTAS DE INSCRIÇÕES
 */

// Listar todas as inscrições de um evento
router.get("/eventos/:id/inscricoes", logisticaController.listarInscricoesPorEvento);

// Criar própria inscrição
router.post("/eventos/:id/inscrever", logisticaController.inscreverProprio);

// Atualizar inscrição (Própria ou Gestão)
router.put("/inscricoes/:id", logisticaController.atualizarInscricao);

// Cancelar inscrição (Própria ou Gestão)
router.delete("/inscricoes/:id", logisticaController.cancelarInscricao);

// Exportar inscrições (PDF / XLS) - Apenas Gestão
router.get("/eventos/:id/exportar", requirePermission("LOGISTICA_GERENCIAR"), logisticaController.exportarInscricoes);

module.exports = router;
