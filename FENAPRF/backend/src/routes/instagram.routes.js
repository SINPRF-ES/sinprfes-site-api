// src/routes/instagram.routes.js
const express = require("express");
const router = express.Router();
const instagramController = require("../controllers/instagram.controller");

// Rota pública para o frontend consumir
router.get("/", instagramController.getFeed);

module.exports = router;