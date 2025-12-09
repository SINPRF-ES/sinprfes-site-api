// src/routes/filiados.routes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth");
const filiadosController = require("../controllers/filiados.controller");

// /api/filiados/me
router.get("/me", authMiddleware, filiadosController.getMe);
router.put("/me", authMiddleware, filiadosController.atualizarMeusDados);

// /api/filiados
router.get("/", authMiddleware, filiadosController.listarFiliados);
router.post("/", authMiddleware, filiadosController.criarFiliado);

// /api/filiados/:id
router.put("/:id", authMiddleware, filiadosController.atualizarFiliado);

module.exports = router;
