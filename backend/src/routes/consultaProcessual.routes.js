const express = require('express');
const auth = require('../middlewares/auth');
const requirePermission = require('../middlewares/requirePermission');
const controller = require('../modules/consulta-processual/controller/consultaProcessual.controller');

const router = express.Router();

router.get('/me', auth, controller.consultarMe);
router.get('/debug/me', auth, requirePermission('EDIT_CONTENT'), controller.consultarDebugMe);

module.exports = router;
