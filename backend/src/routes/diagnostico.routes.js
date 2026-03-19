// src/routes/diagnostico.routes.js
const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const controller = require("../controllers/diagnostico.controller");
const { diagnosticLimiter } = require("../middlewares/assembleiaRateLimit");
const { ehPerfilGestao } = require("../shared/canon");

const authorize = (req, res, next) => {
  const perfil = (req.user.perfil_acesso || "").toUpperCase();
  if (ehPerfilGestao(perfil)) {
    return next();
  }
  return res.status(403).json({ error: "Acesso restrito a administradores ou diretoria" });
};

router.post("/limpar-logs", auth, authorize, diagnosticLimiter, controller.limparLogs);
router.post("/log", auth, controller.registrarLog);

module.exports = router;
