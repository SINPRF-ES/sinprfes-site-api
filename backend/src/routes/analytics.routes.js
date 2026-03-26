const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const controller = require('../controllers/analytics.controller');

router.post('/hit', controller.registrarAcesso);
router.get('/resumo', auth, controller.obterResumo);

module.exports = router;
