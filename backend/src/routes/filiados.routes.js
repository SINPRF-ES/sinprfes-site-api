// src/routes/filiados.routes.js
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");

const multer = require("multer");
const authMiddleware = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");

const filiadosController = require("../controllers/filiados.controller");
const imageOptimizer = require("../middlewares/imageOptimizer");

// =============================================================================
// Upload (avatar)
// =============================================================================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // aceita original maior
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) return cb(null, true);
    return cb(new Error("Arquivo inválido. Envie uma imagem."), false);
  },
});

// =============================================================================
// ROTAS DO PRÓPRIO USUÁRIO (/me)
// =============================================================================
router.get("/me", authMiddleware, filiadosController.getMe);

router.put("/me", authMiddleware, filiadosController.atualizarMeusDados);

router.post(
  "/me/avatar",
  authMiddleware,
  upload.single("avatar"),
  imageOptimizer({ width: 200, height: 200, fit: "cover" }),
  filiadosController.uploadAvatarMe
);

router.delete("/me/avatar", authMiddleware, filiadosController.removerAvatarMe);

router.delete(
  "/me/dependentes",
  authMiddleware,
  filiadosController.excluirDependentesMe
);

router.post("/2fa/desativar", authMiddleware, filiadosController.desativar2fa);

// =============================================================================
// ROTAS GERAIS (LISTA / CRIAÇÃO) — perfis de gestão
// =============================================================================
router.get("/",
  authMiddleware,
  requirePermission("LIST_FILIADOS"),
  filiadosController.listarFiliados
);

router.post("/",
  authMiddleware,
  requirePermission("CREATE_FILIADO"),
  filiadosController.criarFiliado
);

// =============================================================================
// ROTAS ESPECÍFICAS POR ID
// =============================================================================
router.get("/:id", authMiddleware, filiadosController.getFiliadoById);

router.put(
  "/:id",
  authMiddleware,
  requirePermission("EDIT_FILIADO"),
  filiadosController.atualizarFiliado
);

router.post(
  "/:id/avatar",
  authMiddleware,
  requirePermission("EDIT_FILIADO"),
  upload.single("avatar"),
  imageOptimizer({ width: 200, height: 200, fit: "cover" }),
  filiadosController.uploadAvatarPorId
);

router.delete(
  "/:id/avatar",
  authMiddleware,
  requirePermission("EDIT_FILIADO"),
  filiadosController.removerAvatarPorId
);

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

router.delete(
  "/:id/dependentes",
  authMiddleware,
  requirePermission("EDIT_FILIADO"),
  filiadosController.excluirDependentes
);

module.exports = router;
