const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const controller = require('../controllers/analytics.controller');
const { resourceIntensiveLimiter, analyticsHitLimiter } = require('../middlewares/securityRateLimit');

router.post('/hit', analyticsHitLimiter, controller.registrarAcesso);
router.get('/resumo', auth, controller.obterResumo);
router.post('/sync-cloudflare', resourceIntensiveLimiter, auth, controller.sincronizarCloudflare);

module.exports = router;
