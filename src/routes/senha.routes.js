// src/routes/senha.routes.js
const express = require("express");
const router = express.Router();

const senhaController = require("../controllers/senha.controller");

// Esqueci minha senha / primeiro acesso via e-mail
router.post("/recuperar", senhaController.solicitarResetSenha);

// Redefinição de senha via link com token
router.post("/resetar", senhaController.resetarSenha);

module.exports = router;
