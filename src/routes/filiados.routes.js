// src/routes/filiados.routes.js
const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const filiadosController = require("../controllers/filiados.controller");

// Dados completos do próprio filiado logado
router.get("/me", auth, filiadosController.getMe);

// Atualizar dados do próprio filiado (contato)
router.put("/me", auth, filiadosController.atualizarMe);

// Lista de filiados (visão depende do perfil)
router.get("/", auth, filiadosController.listarFiliados);

// Atualizar dados de um filiado específico (regra por perfil)
router.put("/:id", auth, filiadosController.atualizarFiliado);

module.exports = router;
