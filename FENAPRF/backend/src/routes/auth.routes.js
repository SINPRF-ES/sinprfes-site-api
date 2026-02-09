// src/routes/auth.routes.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const controller = require("../controllers/auth.controller");
const { loginLimiter } = require("../middlewares/securityRateLimit");

// Login
router.post("/login", loginLimiter, controller.login);

// Ativar 2FA (precisa estar logado)
// 🟢 CORREÇÃO AUTOMÁTICA: rotas para validar login com 2FA
router.post("/2fa", loginLimiter, controller.login);
router.post("/login/2fa", loginLimiter, controller.login);

router.post("/2fa/ativar", authMiddleware, controller.ativar2fa);

// Dados do próprio membro
router.get("/me", authMiddleware, controller.me);

// Lista de users (com regra de perfil)
router.get("/users", authMiddleware, controller.listarUsers);

module.exports = router;
