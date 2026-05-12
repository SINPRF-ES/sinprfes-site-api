// src/routes/reports.routes.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const reportsController = require("../controllers/reports.controller");
const { resourceIntensiveLimiter } = require("../middlewares/securityRateLimit");

router.post(
  "/generate",
  authMiddleware,
  requirePermission("RELATORIOS_VER"),
  resourceIntensiveLimiter,
  reportsController.generateReport
);

router.post(
  "/preview",
  authMiddleware,
  requirePermission("RELATORIOS_VER"),
  resourceIntensiveLimiter,
  reportsController.previewReport
);

router.get(
  "/history",
  authMiddleware,
  requirePermission("RELATORIOS_VER"),
  reportsController.getHistory
);


router.get(
  "/efetivo-manual",
  authMiddleware,
  requirePermission("RELATORIOS_VER"),
  reportsController.getEfetivoManual
);

router.put(
  "/efetivo-manual",
  authMiddleware,
  requirePermission("REPASSE_GERENCIAR"),
  reportsController.upsertEfetivoManual
);

module.exports = router;
