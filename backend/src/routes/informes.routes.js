const express = require("express");
const router = express.Router();
const informesController = require("../controllers/informes.controller");
const authMiddleware = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const multer = require("multer");
const imageOptimizer = require("../middlewares/imageOptimizer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

function escopoInterno(req, _res, next) {
  req.audienciaEscopo = "INTERNA";
  return next();
}

router.get("/", authMiddleware, escopoInterno, informesController.listar);
router.get("/ref/:publicRef", authMiddleware, escopoInterno, informesController.detalharPorRef);
router.get("/:id", authMiddleware, escopoInterno, informesController.detalhar);

router.post(
  "/",
  authMiddleware,
  escopoInterno,
  requirePermission("NOTICIAS_GERENCIAR"),
  informesController.criar
);

router.put(
  "/:id",
  authMiddleware,
  escopoInterno,
  requirePermission("NOTICIAS_GERENCIAR"),
  informesController.atualizar
);

router.post(
  "/:id/publicar",
  authMiddleware,
  escopoInterno,
  requirePermission("NOTICIAS_GERENCIAR"),
  informesController.publicar
);

router.post(
  "/:id/arquivar",
  authMiddleware,
  escopoInterno,
  requirePermission("NOTICIAS_GERENCIAR"),
  informesController.arquivar
);

router.delete(
  "/:id",
  authMiddleware,
  escopoInterno,
  requirePermission("NOTICIAS_GERENCIAR"),
  informesController.excluir
);

router.post(
  "/:id/midias",
  authMiddleware,
  escopoInterno,
  requirePermission("NOTICIAS_GERENCIAR"),
  upload.single("file"),
  imageOptimizer({ width: 300, height: 300 }),
  informesController.adicionarMidia
);

router.post(
  "/:id/midias_external",
  authMiddleware,
  escopoInterno,
  requirePermission("NOTICIAS_GERENCIAR"),
  informesController.adicionarMidiaExterna
);


router.put(
  "/:id/capa",
  authMiddleware,
  escopoInterno,
  requirePermission("NOTICIAS_GERENCIAR"),
  informesController.definirCapa
);

router.delete(
  "/midias/:midiaId",
  authMiddleware,
  escopoInterno,
  requirePermission("NOTICIAS_GERENCIAR"),
  informesController.removerMidia
);

router.post(
  "/upload-signature",
  authMiddleware,
  escopoInterno,
  requirePermission("NOTICIAS_GERENCIAR"),
  informesController.obterAssinaturaUpload
);

module.exports = router;
