const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const jogosController = require("../controllers/jogos.controller");

// Cria/atualiza a pré-inscrição do filiado
router.post("/inscricao", authMiddleware, jogosController.registrarInscricao);

// 🔵 NOVO: obtém a PRÓPRIA pré-inscrição do filiado logado
router.get("/inscricao", authMiddleware, jogosController.obterMinhaInscricao);

// 🔴 NOVO: cancela a PRÓPRIA pré-inscrição do filiado logado
router.delete("/inscricao", authMiddleware, jogosController.cancelarInscricao);

// Lista todas as pré-inscrições (somente perfis com permissão)
router.get(
  "/inscricoes",
  authMiddleware,
  requirePermission("JOGOS_GERENCIAR"),
  jogosController.listarInscricoes
);

module.exports = router;
