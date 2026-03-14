// src/routes/publicacoes.routes.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const publicacoesController = require("../controllers/publicacoes.controller");

// Todas as rotas de publicações requerem autenticação
router.get("/", authMiddleware, publicacoesController.listar);
router.get("/arquivo/:id", authMiddleware, publicacoesController.visualizar);

module.exports = router;