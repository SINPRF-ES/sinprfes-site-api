// src/routes/publicacoes.routes.js
const express = require("express");
const router = express.Router();
const publicacoesController = require("../controllers/publicacoes.controller");
const authMiddleware = require("../middlewares/auth");

// Rota GET /api/publicacoes (Protegida pelo login)
router.get("/", authMiddleware, publicacoesController.listar);
router.get("/arquivo/:id", authMiddleware, publicacoesController.visualizar);

module.exports = router;