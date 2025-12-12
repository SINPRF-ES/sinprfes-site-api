// src/routes/filiados.routes.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const router = express.Router();

const authMiddleware = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");

const filiadosController = require("../controllers/filiados.controller");

// =============================================================================
// Upload (avatar)
// =============================================================================
const avatarsDir = path.join(process.cwd(), "public", "uploads", "avatars");
fs.mkdirSync(avatarsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarsDir),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || "").toLowerCase();
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
    const who = req.params.id ? `id${req.params.id}` : `me${req.user?.id || "0"}`;
    cb(null, `${who}-${Date.now()}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
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

router.post("/me/avatar", authMiddleware, upload.single("avatar"), filiadosController.uploadAvatarMe);

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
  filiadosController.uploadAvatarPorId
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
