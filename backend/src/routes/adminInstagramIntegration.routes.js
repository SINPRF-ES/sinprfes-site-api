const express = require("express");

const auth = require("../middlewares/auth");
const { ehPerfilGestao } = require("../shared/canon");
const {
  buildAuthorizationUrl,
  getStatus,
  handleOAuthCallback,
  getCurrentUser,
} = require("../services/instagramOfficialService");

const router = express.Router();

const authorize = (req, res, next) => {
  const perfil = (req.user?.perfil_acesso || "").toUpperCase();
  if (ehPerfilGestao(perfil)) return next();
  return res.status(403).json({ ok: false, error: "forbidden" });
};

router.get("/auth-url", auth, authorize, (req, res) => {
  try {
    const { url } = buildAuthorizationUrl();
    return res.json({ ok: true, authUrl: url });
  } catch (error) {
    return res.status(400).json({ ok: false, error: "instagram_official_not_configured" });
  }
});

router.get("/callback", auth, authorize, async (req, res) => {
  try {
    const status = await handleOAuthCallback({
      code: req.query.code,
      state: req.query.state,
    });
    return res.json({ ok: true, configured: status.configured, hasAccessToken: status.hasAccessToken });
  } catch (error) {
    return res.status(400).json({ ok: false, error: "instagram_oauth_callback_failed" });
  }
});

router.get("/status", auth, authorize, async (_req, res) => {
  const status = getStatus();

  if (!status.hasAccessToken) {
    return res.json({ ok: true, ...status, profile: null });
  }

  try {
    const profile = await getCurrentUser();
    return res.json({ ok: true, ...status, profile });
  } catch (_error) {
    return res.json({ ok: true, ...status, profile: null });
  }
});

module.exports = router;
