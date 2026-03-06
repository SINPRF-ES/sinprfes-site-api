const express = require("express");
const router = express.Router();
const informesController = require("../controllers/informes.controller");
const authMiddleware = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.get("/", authMiddleware, informesController.listar);
router.get("/:id", authMiddleware, informesController.detalhar);

router.post(
  "/",
  authMiddleware,
  requirePermission("NOTICIAS_GERENCIAR"),
  informesController.criar
);

router.put(
  "/:id",
  authMiddleware,
  requirePermission("NOTICIAS_GERENCIAR"),
  informesController.atualizar
);

router.post(
  "/:id/publicar",
  authMiddleware,
  requirePermission("NOTICIAS_GERENCIAR"),
  informesController.publicar
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission("NOTICIAS_GERENCIAR"),
  informesController.excluir
);

router.post(
  "/:id/midias",
  authMiddleware,
  requirePermission("NOTICIAS_GERENCIAR"),
  upload.single("file"),
  informesController.adicionarMidia
);

router.post(
  "/:id/midias_external",
  authMiddleware,
  requirePermission("NOTICIAS_GERENCIAR"),
  informesController.adicionarMidiaExterna
);

router.delete(
  "/midias/:midiaId",
  authMiddleware,
  requirePermission("NOTICIAS_GERENCIAR"),
  informesController.removerMidia
);

router.post(
  "/upload-signature",
  authMiddleware,
  requirePermission("NOTICIAS_GERENCIAR"),
  informesController.obterAssinaturaUpload
);

module.exports = router;
