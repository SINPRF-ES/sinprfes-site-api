// src/routes/filiese.routes.js
const express = require("express");
const router = express.Router();

const filieseController = require("../controllers/filiese.controller");

// Rota pública para receber formulário de filiação
router.post("/filiese", filieseController.enviarFichaFiliacao);

module.exports = router;
