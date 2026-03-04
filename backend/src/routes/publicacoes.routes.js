// src/routes/publicacoes.routes.js
const express = require("express");
const router = express.Router();
const publicacoesController = require("../controllers/publicacoes.controller");
// Rota GET /api/publicacoes (Pública para app/site consumir sem token)
router.get("/", publicacoesController.listar);
router.get("/arquivo/:id", publicacoesController.visualizar);

module.exports = router;