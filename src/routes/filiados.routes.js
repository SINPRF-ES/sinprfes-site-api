// src/routes/filiados.routes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth");
// 🟢 NOVO: Importar o middleware de permissão
const requirePermission = require("../middlewares/requirePermission");

const filiadosController = require("../controllers/filiados.controller");

// ==============================================================================
// ROTAS DO PRÓPRIO USUÁRIO (/me)
// ==============================================================================

// Ver meus dados
// Requer: VIEW_SELF (Filiados e todos os outros perfis possuem)
router.get(
  "/me",
  authMiddleware,
  requirePermission("VIEW_SELF"),
  filiadosController.getMe
);

// Atualizar meus dados
// Requer: EDIT_SELF (Filiados e todos os outros perfis possuem)
router.put(
  "/me",
  authMiddleware,
  requirePermission("EDIT_SELF"),
  filiadosController.atualizarMeusDados
);

// ==============================================================================
// ROTAS GERAIS DE FILIADOS
// ==============================================================================

// Listar filiados
// Acesso: Aberto a todos os logados (authMiddleware).
// O controller define internamente se retorna tudo (Admin/Staff) ou lista reduzida (Filiado).
router.get("/", authMiddleware, filiadosController.listarFiliados);

// Criar novo filiado
// Requer: EDIT_FILIADO (Admin, Diretoria, Funcionário)
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
// Requer: EDIT_FILIADO (Admin, Diretoria, Funcionário)
router.put(
  "/:id",
  authMiddleware,
  requirePermission("EDIT_FILIADO"),
  filiadosController.atualizarFiliado
);

module.exports = router;