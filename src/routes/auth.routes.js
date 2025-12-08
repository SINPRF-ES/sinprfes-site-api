// src/routes/auth.routes.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const controller = require("../controllers/auth.controller");

// Login
router.post("/login", controller.login);

// Ativar 2FA (precisa estar logado)
router.post("/2fa/ativar", authMiddleware, controller.ativar2fa);

// Dados do próprio usuário
router.get("/me", authMiddleware, controller.me);

// Lista de filiados (com regra de perfil)
router.get("/filiados", authMiddleware, controller.listarFiliados);

module.exports = router;
