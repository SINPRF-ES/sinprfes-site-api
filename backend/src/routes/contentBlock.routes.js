// src/routes/contentBlock.routes.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const contentBlockController = require("../controllers/contentBlock.controller");

// Público: Ver blocos (GET /api/content-blocks?page=home)
router.get("/", contentBlockController.getBlocks);

// Privado: Criar bloco (POST /api/content-blocks)
router.post("/",
  authMiddleware,
  requirePermission("EDIT_CONTENT"),
  contentBlockController.createBlock
);

// Privado: Editar blocos (PUT /api/content-blocks/:id)
router.put("/:id",
  authMiddleware,
  requirePermission("EDIT_CONTENT"),
  contentBlockController.updateBlock
);

router.post("/upload-signature",
  authMiddleware,
  requirePermission("EDIT_CONTENT"),
  contentBlockController.obterAssinaturaUpload
);

module.exports = router;
