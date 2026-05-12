const express = require('express');
const auth = require('../middlewares/auth');
const requirePermission = require('../middlewares/requirePermission');
const controller = require('../modules/consulta-processual/controller/consultaProcessual.controller');
const { resourceIntensiveLimiter } = require('../middlewares/securityRateLimit');

const router = express.Router();

router.get('/me', auth, resourceIntensiveLimiter, controller.consultarMe);
router.get('/debug/me', auth, requirePermission('EDIT_CONTENT'), resourceIntensiveLimiter, controller.consultarDebugMe);

module.exports = router;
