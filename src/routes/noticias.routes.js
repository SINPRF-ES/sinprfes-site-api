const express = require("express");
const router = express.Router();
const noticiasController = require("../controllers/noticias.controller");
const authMiddleware = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for videos
});

// Leitura
router.get("/", authMiddleware, noticiasController.listar);
router.get("/:id", authMiddleware, noticiasController.detalhar);

// Gestão
router.post("/",
  authMiddleware,
  requirePermission("NOTICIAS_GERENCIAR"),
  noticiasController.criar
);

router.put("/:id",
  authMiddleware,
  requirePermission("NOTICIAS_GERENCIAR"),
  noticiasController.atualizar
);

router.post("/:id/publicar",
  authMiddleware,
  requirePermission("NOTICIAS_GERENCIAR"),
  noticiasController.publicar
);

router.delete("/:id",
  authMiddleware,
  requirePermission("NOTICIAS_GERENCIAR"),
  noticiasController.excluir
);

// Mídias
router.post("/:id/midias",
  authMiddleware,
  requirePermission("NOTICIAS_GERENCIAR"),
  upload.single("file"),
  noticiasController.adicionarMidia
);

router.post("/:id/midias_external",
  authMiddleware,
  requirePermission("NOTICIAS_GERENCIAR"),
  noticiasController.adicionarMidiaExterna
);

router.delete("/midias/:midiaId",
  authMiddleware,
  requirePermission("NOTICIAS_GERENCIAR"),
  noticiasController.removerMidia
);

router.post("/upload-signature",
  authMiddleware,
  requirePermission("NOTICIAS_GERENCIAR"),
  noticiasController.obterAssinaturaUpload
);

module.exports = router;
