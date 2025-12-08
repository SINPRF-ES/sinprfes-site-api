// src/routes/filiados.routes.js
const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const filiadosController = require("../controllers/filiados.controller");

// Dados completos do próprio filiado logado
router.get("/me", auth, filiadosController.getMe);

// Lista de filiados (visão depende do perfil)
router.get("/", auth, filiadosController.listarFiliados);

module.exports = router;
