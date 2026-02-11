// src/routes/publicacoes.routes.js
const express = require("express");
const router = express.Router();
const publicacoesController = require("../controllers/publicacoes.controller");
const authMiddleware = require("../middlewares/auth");
const multer = require("multer");

// Configuração básica do multer para upload em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // Limite de 20MB
});

// Rota GET /api/publicacoes (Protegida pelo login)
router.get("/", authMiddleware, publicacoesController.listar);

/**
 * 🟢 NOVA ROTA: Download/Visualização direta do arquivo no Drive
 * Utilizada pelo mobile para exibir PDFs nativamente
 */
router.get("/arquivo/:id", authMiddleware, publicacoesController.visualizar);

/**
 * 🛠️ ROTAS DE GESTÃO (Protegidas e restritas a ADMIN/COLABORADOR no controller)
 */

// Criar pasta
router.post("/folders", authMiddleware, publicacoesController.createFolder);

// Upload de arquivo
router.post("/upload", authMiddleware, upload.single("file"), publicacoesController.uploadFile);

// Renomear item
router.patch("/items/:id/rename", authMiddleware, publicacoesController.renameItem);

// Mover item
router.patch("/items/:id/move", authMiddleware, publicacoesController.moveItem);

// Excluir item (soft delete)
router.post("/items/:id/delete", authMiddleware, publicacoesController.deleteItem);

module.exports = router;