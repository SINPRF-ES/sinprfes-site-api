// src/routes/filiados.routes.js
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");

const multer = require("multer");
const authMiddleware = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");

const filiadosController = require("../controllers/filiados.controller");

const sharp = require("sharp");

// =============================================================================
// Upload (avatar)
// =============================================================================
const avatarsDir = path.join(process.cwd(), "public", "uploads", "avatars");
fs.mkdirSync(avatarsDir, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // aceita original maior
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) return cb(null, true);
    return cb(new Error("Arquivo inválido. Envie uma imagem."), false);
  },
});

async function converterAvatarParaWebp(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) return next();

    const who = req.params.id ? `id${req.params.id}` : `me${req.user?.id || "0"}`;
    const filename = `${who}-${Date.now()}.webp`;
    const outPath = path.join(avatarsDir, filename); // mantido por compatibilidade, mas não será usado

    let quality = 82;
    let buffer = await sharp(req.file.buffer)
      .rotate()
      .resize(200, 200, { fit: "cover" })
      .webp({ quality })
      .toBuffer();

    const MAX = 2 * 1024 * 1024;
    while (buffer.length > MAX && quality > 55) {
      quality -= 7;
      buffer = await sharp(req.file.buffer)
        .rotate()
        .resize(200, 200, { fit: "cover" })
        .webp({ quality })
        .toBuffer();
    }

    if (buffer.length > MAX) {
      return res.status(413).json({
        error: "Não foi possível otimizar a imagem abaixo de 2MB.",
      });
    }

    // Não persiste em disco (filesystem do Render é efêmero). Mantém em memória para upload no storage.
    req.file.buffer = buffer;
    req.file.filename = filename;
    req.file.mimetype = "image/webp";
    req.file.size = buffer.length;

    next();
  } catch (err) {
    next(err);
  }
}

// =============================================================================
// ROTAS DO PRÓPRIO USUÁRIO (/me)
// =============================================================================
router.get("/me", authMiddleware, filiadosController.getMe);

router.put("/me", authMiddleware, filiadosController.atualizarMeusDados);

router.post(
  "/me/avatar",
  authMiddleware,
  upload.single("avatar"),
  converterAvatarParaWebp,
  filiadosController.uploadAvatarMe
);

router.delete("/me/avatar", authMiddleware, filiadosController.removerAvatarMe);

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
  converterAvatarParaWebp,
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

module.exports = router;
