// src/routes/diagnostico.routes.js
const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const controller = require("../controllers/diagnostico.controller");
const { diagnosticLimiter } = require("../middlewares/assembleiaRateLimit");

const authorize = (req, res, next) => {
  const perfil = (req.user.perfil_acesso || "").toUpperCase();
  // Durante o desenvolvimento, permitir que ADMIN, DIRETORIA e COLABORADOR gerenciem logs
  if (perfil === 'ADMIN' || perfil === 'DIRETORIA' || perfil === 'COLABORADOR') {
    return next();
  }
  return res.status(403).json({ error: "Acesso restrito à gestão" });
};

router.post("/limpar-logs", auth, authorize, diagnosticLimiter, controller.limparLogs);
router.post("/log", auth, controller.registrarLog);

module.exports = router;
