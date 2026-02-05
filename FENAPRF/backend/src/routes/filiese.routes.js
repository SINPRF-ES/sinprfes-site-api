// src/routes/filiese.routes.js
const express = require("express");
const router = express.Router();

const filieseController = require("../controllers/filiese.controller");
const { publicFormLimiter } = require("../middlewares/securityRateLimit");

// Rota pública para receber formulário de filiação
router.post("/filiese", publicFormLimiter, filieseController.enviarFichaFiliacao);

module.exports = router;
