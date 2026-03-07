const express = require('express');
const auth = require('../middlewares/auth');
const requirePermission = require('../middlewares/requirePermission');
const controller = require('../modules/consulta-processual/controller/consultaProcessual.controller');

const router = express.Router();

router.get('/me', auth, requirePermission('CONSULTA_PROCESSUAL_CONSULTAR'), controller.consultarMe);

module.exports = router;
