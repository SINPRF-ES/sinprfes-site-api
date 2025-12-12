// src/routes/filiados.routes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");

const filiadosController = require("../controllers/filiados.controller");

// ==============================================================================
// ROTAS DO PRÓPRIO USUÁRIO (/me)
// ==============================================================================

router.get(
  "/me",
  authMiddleware,
  requirePermission("VIEW_SELF"),
  filiadosController.getMe
);

router.put(
  "/me",
  authMiddleware,
  requirePermission("EDIT_SELF"),
  filiadosController.atualizarMeusDados
);

router.post(
  "/2fa/desativar",
  authMiddleware,
  requirePermission("EDIT_SELF"),
  filiadosController.desativar2fa
);

// ==============================================================================
// ROTAS GERAIS DE FILIADOS
// ==============================================================================

router.get("/", authMiddleware, filiadosController.listarFiliados);

router.post(
  "/",
  authMiddleware,
  requirePermission("EDIT_FILIADO"),
  filiadosController.criarFiliado
);

// ==============================================================================
// ROTAS ESPECÍFICAS POR ID
// ==============================================================================

router.put(
  "/:id",
  authMiddleware,
  requirePermission("EDIT_FILIADO"),
  filiadosController.atualizarFiliado
);

// ✅ NOVO: Arquivar / Desarquivar
router.post(
  "/:id/arquivar",
  authMiddleware,
  requirePermission("EDIT_FILIADO"),
  filiadosController.arquivarFiliado
);

router.post(
  "/:id/desarquivar",
  authMiddleware,
  requirePermission("EDIT_FILIADO"),
  filiadosController.desarquivarFiliado
);

module.exports = router;
