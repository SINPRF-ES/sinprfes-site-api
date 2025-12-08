// src/routes/filiese.routes.js
const express = require("express");
const router = express.Router();
const controller = require("../controllers/filiese.controller");

// POST /api/filiese
router.post("/", controller.enviar);

module.exports = router;
