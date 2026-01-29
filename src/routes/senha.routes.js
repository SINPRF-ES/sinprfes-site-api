// src/routes/senha.routes.js
const express = require("express");
const router = express.Router();

const senhaController = require("../controllers/senha.controller");
const { passwordResetLimiter } = require("../middlewares/securityRateLimit");

// Esqueci minha senha / primeiro acesso via e-mail
router.post("/recuperar", passwordResetLimiter, senhaController.solicitarResetSenha);

// Redefinição de senha via link com token
router.post("/resetar", passwordResetLimiter, senhaController.resetarSenha);

module.exports = router;
