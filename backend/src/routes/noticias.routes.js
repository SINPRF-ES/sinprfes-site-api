const express = require("express");
const router = express.Router();
const noticiasController = require("../controllers/noticias.controller");
const authMiddleware = require("../middlewares/auth");
const optionalAuth = require("../middlewares/optionalAuth");
const requirePermission = require("../middlewares/requirePermission");
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for videos
});

function escopoPublico(req, _res, next) {
  req.audienciaEscopo = "PUBLICA";
  return next();
}

// Leitura
router.get("/", escopoPublico, optionalAuth, noticiasController.listar);
router.get("/:id", escopoPublico, optionalAuth, noticiasController.detalhar);

// Gestão
router.post("/",
  escopoPublico,
  authMiddleware,
  requirePermission("NOTICIAS_GERENCIAR"),
  noticiasController.criar
);

router.put("/:id",
  escopoPublico,
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
