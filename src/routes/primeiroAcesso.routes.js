// src/routes/primeiroAcesso.routes.js
const express = require("express");
const router = express.Router();
const controller = require("../controllers/primeiroAcesso.controller");

router.post("/iniciar", controller.iniciar);
router.post("/confirmar", controller.confirmar);

module.exports = router;
