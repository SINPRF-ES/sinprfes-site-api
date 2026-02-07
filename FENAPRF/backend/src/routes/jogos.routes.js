const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth");
const jogosController = require("../controllers/jogos.controller");

// Cria/atualiza a pré-inscrição do user
router.post("/inscricao", authMiddleware, jogosController.registrarInscricao);

// 🔵 NOVO: obtém a PRÓPRIA pré-inscrição do user logado
router.get("/inscricao", authMiddleware, jogosController.obterMinhaInscricao);

// 🔴 NOVO: cancela a PRÓPRIA pré-inscrição do user logado
router.delete("/inscricao", authMiddleware, jogosController.cancelarInscricao);

// Lista todas as pré-inscrições (somente perfis com permissão)
router.get("/inscricoes", authMiddleware, jogosController.listarInscricoes);

module.exports = router;
