// src/routes/jogos.routes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth");
const jogosController = require("../controllers/jogos.controller");

// Rota para pré-inscrição do filiado
router.post("/inscricao", authMiddleware, jogosController.registrarInscricao);

// Rota para listar todas as pré-inscrições (Acesso restrito pelo controller)
router.get("/inscricoes", authMiddleware, jogosController.listarInscricoes);

module.exports = router;