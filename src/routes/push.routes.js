// src/routes/push.routes.js
const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const controller = require("../controllers/push.controller");

// Qualquer logado pode registrar/remover o token do próprio device
router.post("/register", auth, controller.register);
router.post("/unregister", auth, controller.unregister);

// Admin/Diretoria podem disparar broadcast manual (opcional)
router.post(
  "/broadcast",
  auth,
  requirePermission("VOTACAO_GERENCIAR"),
  controller.broadcast
);

module.exports = router;
