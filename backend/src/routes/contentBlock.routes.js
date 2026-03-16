// src/routes/contentBlock.routes.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const contentBlockController = require("../controllers/contentBlock.controller");
const multer = require("multer");
const imageOptimizer = require("../middlewares/imageOptimizer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

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

router.post("/upload-media",
  authMiddleware,
  requirePermission("EDIT_CONTENT"),
  upload.single("file"),
  imageOptimizer({ width: 300, height: 300 }),
  contentBlockController.uploadMedia
);

module.exports = router;
