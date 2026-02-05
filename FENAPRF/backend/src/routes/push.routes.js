// src/routes/push.routes.js
const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const pushController = require("../controllers/push.controller");
const campaignController = require("../controllers/pushCampaign.controller");
const { pushCampaignLimiter } = require("../middlewares/securityRateLimit");

// Qualquer logado pode registrar/remover o token do próprio device
router.post("/register", auth, pushController.register);
router.post("/unregister", auth, pushController.unregister);

// Campanhas de Push
router.get(
  "/campaigns",
  auth,
  requirePermission("PUSH_GERENCIAR"),
  campaignController.listCampaigns
);

router.post(
  "/campaigns/send",
  auth,
  requirePermission("PUSH_GERENCIAR"),
  pushCampaignLimiter,
  campaignController.sendCampaign
);

router.get(
  "/health",
  auth,
  requirePermission("PUSH_GERENCIAR"),
  campaignController.pushHealth
);

// Admin/Diretoria podem disparar broadcast manual (legacy/simples)
router.post(
  "/broadcast",
  auth,
  requirePermission("VOTACAO_GERENCIAR"),
  pushController.broadcast
);

module.exports = router;
