// src/routes/reports.routes.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const reportsController = require("../controllers/reports.controller");

router.post(
  "/generate",
  authMiddleware,
  requirePermission("RELATORIOS_VER"),
  reportsController.generateReport
);

router.post(
  "/preview",
  authMiddleware,
  requirePermission("RELATORIOS_VER"),
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
