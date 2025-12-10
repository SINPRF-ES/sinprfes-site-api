// src/routes/filiados.routes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");

const filiadosController = require("../controllers/filiados.controller");

// ==============================================================================
// ROTAS DO PRÓPRIO USUÁRIO (/me)
// ==============================================================================

// Ver meus dados
router.get(
  "/me",
  authMiddleware,
  requirePermission("VIEW_SELF"),
  filiadosController.getMe
);

// Atualizar meus dados
router.put(
  "/me",
  authMiddleware,
  requirePermission("EDIT_SELF"),
  filiadosController.atualizarMeusDados
);

// 🟢 NOVA ROTA: Desativar 2FA
router.post(
  "/2fa/desativar",
  authMiddleware,
  requirePermission("EDIT_SELF"),
  filiadosController.desativar2fa
);

// ==============================================================================
// ROTAS GERAIS DE FILIADOS
// ==============================================================================

// Listar filiados (Aberto, filtro interno no controller)
router.get("/", authMiddleware, filiadosController.listarFiliados);

// Criar novo filiado (Requer permissão especial)
router.post(
  "/",
  authMiddleware,
  requirePermission("EDIT_FILIADO"),
  filiadosController.criarFiliado
);

// ==============================================================================
// ROTAS ESPECÍFICAS POR ID
// ==============================================================================

// Atualizar outro filiado
router.put(
  "/:id",
  authMiddleware,
  requirePermission("EDIT_FILIADO"),
  filiadosController.atualizarFiliado
);

module.exports = router;