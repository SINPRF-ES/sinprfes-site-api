// src/routes/publicacoes.routes.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const publicacoesController = require("../controllers/publicacoes.controller");
const { stateLimiter } = require("../middlewares/assembleiaRateLimit");

// Todas as rotas de publicações requerem autenticação
// Sentinel: Aplicando stateLimiter para proteger listagem de recursos do Google Drive (Queries)
router.get("/", authMiddleware, stateLimiter, publicacoesController.listar);
router.get("/arquivo/:id", authMiddleware, stateLimiter, publicacoesController.visualizar);

module.exports = router;