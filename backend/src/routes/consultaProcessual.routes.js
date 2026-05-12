const express = require('express');
const auth = require('../middlewares/auth');
const requirePermission = require('../middlewares/requirePermission');
const controller = require('../modules/consulta-processual/controller/consultaProcessual.controller');
const { resourceIntensiveLimiter } = require('../middlewares/securityRateLimit');

const router = express.Router();

router.get('/me', resourceIntensiveLimiter, auth, controller.consultarMe);
router.get('/debug/me', resourceIntensiveLimiter, auth, requirePermission('EDIT_CONTENT'), controller.consultarDebugMe);

module.exports = router;
